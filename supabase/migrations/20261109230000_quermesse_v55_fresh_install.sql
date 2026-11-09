-- Quermesse São Judas | v5.5 — instalação LIMPA em um projeto Supabase NOVO.
-- Inspirada na versão 5.5 verificada do banco original (09/11/2026).
-- NÃO aplique novamente ao banco de produção existente; as tabelas já existem nele.
-- Nunca inclua credenciais, e-mails reais, comprovantes ou dados pessoais neste arquivo.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'collaborator' CHECK(role IN ('admin','collaborator')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_email_lower_idx ON public.profiles(lower(email));

CREATE TABLE public.stalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🍽️',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK(char_length(trim(title)) BETWEEN 3 AND 140),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_on>=starts_on)
);
CREATE TABLE public.profile_stalls (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stall_id uuid NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,stall_id)
);

CREATE TABLE public.closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  stall_id uuid NOT NULL REFERENCES public.stalls(id),
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  closing_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK(amount>0 AND amount<=10000000),
  receipt_path text NOT NULL CHECK(char_length(receipt_path) BETWEEN 10 AND 400),
  note text CHECK(char_length(note)<=1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','correction')),
  review_note text CHECK(char_length(review_note)<=1000),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  replaces_id uuid REFERENCES public.closings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status<>'correction' OR (review_note IS NOT NULL AND length(trim(review_note))>0))
);
CREATE UNIQUE INDEX closings_once_per_replacement ON public.closings(replaces_id) WHERE replaces_id IS NOT NULL;
CREATE INDEX closings_event_stall_date ON public.closings(event_id,stall_id,closing_date);
CREATE INDEX closings_review_queue ON public.closings(status,created_at);
CREATE INDEX closings_submitted_by ON public.closings(submitted_by);

-- Colaboradores podem acompanhar o status sem consultar valores ou comprovantes.
CREATE TABLE public.closing_feedback (
  closing_id uuid PRIMARY KEY REFERENCES public.closings(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  stall_id uuid NOT NULL REFERENCES public.stalls(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  closing_date date NOT NULL,
  status text NOT NULL,
  review_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  stall_id uuid REFERENCES public.stalls(id),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  report_title text NOT NULL DEFAULT '',
  total numeric(14,2) NOT NULL DEFAULT 0,
  closing_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX report_shares_recipient ON public.report_shares(recipient_id,created_at DESC);
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Funções auxiliares. O papel é lido do banco, nunca de metadados editáveis pelo usuário.
CREATE FUNCTION private.is_admin(who uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=who AND p.role='admin' AND p.active); $$;
CREATE FUNCTION private.is_active_member(who uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=who AND p.active); $$;
CREATE FUNCTION private.can_submit(who uuid, ev uuid, st uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(
  SELECT 1 FROM public.profiles p
  JOIN public.profile_stalls ps ON ps.user_id=p.id AND ps.stall_id=st
  JOIN public.stalls s ON s.id=ps.stall_id AND s.active
  JOIN public.events e ON e.id=ev AND e.active
  WHERE p.id=who AND p.active AND p.role='collaborator'
); $$;
-- V5.5: corrige comparação de evento/barraca/data e impede reenvio repetido.
CREATE FUNCTION private.valid_resubmission(who uuid, original uuid, ev uuid, st uuid, d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(
  SELECT 1 FROM public.closing_feedback f
  JOIN public.closings c ON c.id=f.closing_id
  WHERE f.closing_id=original AND f.submitted_by=who AND c.submitted_by=who
    AND f.status='correction' AND c.status='correction'
    AND f.event_id=ev AND f.stall_id=st AND f.closing_date=d
    AND NOT EXISTS(SELECT 1 FROM public.closings newer WHERE newer.replaces_id=original)
); $$;

CREATE FUNCTION private.sync_closing_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
  INSERT INTO public.closing_feedback(closing_id,submitted_by,stall_id,event_id,closing_date,status,review_note)
  VALUES(new.id,new.submitted_by,new.stall_id,new.event_id,new.closing_date,new.status,new.review_note)
  ON CONFLICT(closing_id) DO UPDATE SET status=excluded.status,review_note=excluded.review_note,updated_at=now();
  RETURN new;
END $$;
CREATE TRIGGER trg_closing_feedback AFTER INSERT OR UPDATE OF status,review_note ON public.closings
FOR EACH ROW EXECUTE FUNCTION private.sync_closing_feedback();

CREATE FUNCTION private.finalize_resubmission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
  IF new.replaces_id IS NOT NULL THEN
    UPDATE public.closing_feedback SET status='resubmitted',updated_at=now()
    WHERE closing_id=new.replaces_id AND submitted_by=new.submitted_by AND status='correction';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_finalize_resubmission AFTER INSERT ON public.closings
FOR EACH ROW EXECUTE FUNCTION private.finalize_resubmission();

CREATE FUNCTION private.validate_closing_date() RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=new.event_id
    AND new.closing_date BETWEEN e.starts_on AND e.ends_on) THEN
    RAISE EXCEPTION 'Data fora do intervalo da quermesse';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_validate_closing_date BEFORE INSERT ON public.closings
FOR EACH ROW EXECUTE FUNCTION private.validate_closing_date();

-- V5.5: revisão restrita a pendentes e sem mudança dos campos financeiros.
CREATE FUNCTION private.validate_review_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $$ BEGIN
  IF old.status<>'pending' THEN
    RAISE EXCEPTION 'Somente fechamentos pendentes podem ser avaliados';
  END IF;
  IF new.status NOT IN('approved','correction') THEN
    RAISE EXCEPTION 'Transição de status não permitida';
  END IF;
  IF new.status='correction' AND (new.review_note IS NULL OR length(trim(new.review_note))<5) THEN
    RAISE EXCEPTION 'Descreva o motivo da correção com pelo menos 5 caracteres';
  END IF;
  IF new.status='approved' THEN new.review_note:=NULL; END IF;
  IF new.reviewed_by IS DISTINCT FROM auth.uid() OR new.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Revisão sem responsável ou data';
  END IF;
  IF ROW(new.event_id,new.stall_id,new.submitted_by,new.closing_date,new.amount,new.receipt_path,new.note,new.replaces_id)
     IS DISTINCT FROM
     ROW(old.event_id,old.stall_id,old.submitted_by,old.closing_date,old.amount,old.receipt_path,old.note,old.replaces_id) THEN
    RAISE EXCEPTION 'Campos financeiros e comprovantes são imutáveis após o envio';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_validate_review_transition BEFORE UPDATE OF status,review_note,reviewed_by,reviewed_at
ON public.closings FOR EACH ROW EXECUTE FUNCTION private.validate_review_transition();

-- Relatórios são snapshots: os valores só são calculados no servidor, no INSERT.
CREATE FUNCTION private.compute_report_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE ev_title text;stall_title text;rc int;rt numeric;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF new.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Remetente inválido'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.recipient_id AND active AND role='collaborator') THEN
    RAISE EXCEPTION 'Destinatário inválido';
  END IF;
  SELECT title INTO ev_title FROM public.events WHERE id=new.event_id;
  IF ev_title IS NULL THEN RAISE EXCEPTION 'Evento inválido'; END IF;
  IF new.stall_id IS NOT NULL THEN
    SELECT name INTO stall_title FROM public.stalls WHERE id=new.stall_id;
    IF stall_title IS NULL THEN RAISE EXCEPTION 'Barraca inválida'; END IF;
  END IF;
  SELECT count(*)::int,COALESCE(sum(amount),0) INTO rc,rt FROM public.closings
  WHERE event_id=new.event_id AND status='approved' AND (new.stall_id IS NULL OR stall_id=new.stall_id);
  IF rc=0 THEN RAISE EXCEPTION 'Não existem fechamentos aprovados para compartilhar'; END IF;
  new.report_title:=ev_title||' · '||COALESCE(stall_title,'Todas as barracas');
  new.closing_count:=rc;new.total:=rt;new.revoked_at:=NULL;new.created_at:=now();
  RETURN new;
END $$;
CREATE TRIGGER trg_report_snapshot BEFORE INSERT ON public.report_shares
FOR EACH ROW EXECUTE FUNCTION private.compute_report_snapshot();

-- V5.5 já inclui a correção da auditoria de compartilhamentos.
CREATE FUNCTION private.log_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE act text;ent uuid;detail jsonb;
BEGIN
  act:=TG_TABLE_NAME||'_'||lower(TG_OP);
  IF TG_OP='DELETE' THEN ent:=old.id; ELSE ent:=new.id; END IF;
  IF TG_TABLE_NAME='closings' THEN
    IF TG_OP='DELETE' THEN detail:=jsonb_build_object('status',old.status);
    ELSE detail:=jsonb_build_object('status',new.status); END IF;
  ELSIF TG_TABLE_NAME='report_shares' THEN
    IF TG_OP='DELETE' THEN detail:=jsonb_build_object('type',TG_TABLE_NAME,'revoked',old.revoked_at IS NOT NULL);
    ELSE detail:=jsonb_build_object('type',TG_TABLE_NAME,'revoked',new.revoked_at IS NOT NULL); END IF;
  ELSE detail:=jsonb_build_object('type',TG_TABLE_NAME); END IF;
  INSERT INTO public.audit_log(actor_id,action,entity_id,details)
  VALUES(auth.uid(),act,ent,detail);
  IF TG_OP='DELETE' THEN RETURN old; END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_closings_audit AFTER INSERT OR UPDATE ON public.closings
FOR EACH ROW EXECUTE FUNCTION private.log_change();
CREATE TRIGGER trg_shares_audit AFTER INSERT OR UPDATE ON public.report_shares
FOR EACH ROW EXECUTE FUNCTION private.log_change();

-- Segregação de acesso por perfil (RLS) nas oito tabelas públicas.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
USING(id=(SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
USING(private.is_admin((SELECT auth.uid()))) WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY stalls_read ON public.stalls FOR SELECT TO authenticated
USING(private.is_active_member((SELECT auth.uid())) AND (active OR private.is_admin((SELECT auth.uid()))));
CREATE POLICY stalls_admin_insert ON public.stalls FOR INSERT TO authenticated
WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY stalls_admin_update ON public.stalls FOR UPDATE TO authenticated
USING(private.is_admin((SELECT auth.uid()))) WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY events_read ON public.events FOR SELECT TO authenticated
USING(private.is_active_member((SELECT auth.uid())) AND (active OR private.is_admin((SELECT auth.uid()))));
CREATE POLICY events_admin_insert ON public.events FOR INSERT TO authenticated
WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY events_admin_update ON public.events FOR UPDATE TO authenticated
USING(private.is_admin((SELECT auth.uid()))) WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY assignments_read ON public.profile_stalls FOR SELECT TO authenticated
USING(user_id=(SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
CREATE POLICY assignments_admin_insert ON public.profile_stalls FOR INSERT TO authenticated
WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY assignments_admin_delete ON public.profile_stalls FOR DELETE TO authenticated
USING(private.is_admin((SELECT auth.uid())));
CREATE POLICY closings_admin_select ON public.closings FOR SELECT TO authenticated
USING(private.is_admin((SELECT auth.uid())));
CREATE POLICY closings_collab_insert ON public.closings FOR INSERT TO authenticated
WITH CHECK(
  submitted_by=(SELECT auth.uid())
  AND private.can_submit((SELECT auth.uid()),event_id,stall_id)
  AND status='pending' AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
  AND receipt_path LIKE ((SELECT auth.uid())::text||'/%')
  AND (replaces_id IS NULL OR private.valid_resubmission((SELECT auth.uid()),replaces_id,event_id,stall_id,closing_date))
);
CREATE POLICY closings_admin_update ON public.closings FOR UPDATE TO authenticated
USING(private.is_admin((SELECT auth.uid()))) WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY feedback_owner_read ON public.closing_feedback FOR SELECT TO authenticated
USING(submitted_by=(SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
CREATE POLICY shares_read ON public.report_shares FOR SELECT TO authenticated
USING(private.is_admin((SELECT auth.uid())) OR
 (recipient_id=(SELECT auth.uid()) AND revoked_at IS NULL AND private.is_active_member((SELECT auth.uid()))));
CREATE POLICY shares_admin_insert ON public.report_shares FOR INSERT TO authenticated
WITH CHECK(private.is_admin((SELECT auth.uid())) AND created_by=(SELECT auth.uid()));
CREATE POLICY shares_admin_update ON public.report_shares FOR UPDATE TO authenticated
USING(private.is_admin((SELECT auth.uid()))) WITH CHECK(private.is_admin((SELECT auth.uid())));
CREATE POLICY audit_admin_read ON public.audit_log FOR SELECT TO authenticated
USING(private.is_admin((SELECT auth.uid())));

-- Defesa adicional: acesso SQL limitado por colunas, além das políticas RLS.
REVOKE ALL ON public.profiles,public.stalls,public.events,public.profile_stalls,
  public.closings,public.closing_feedback,public.report_shares,public.audit_log FROM anon,authenticated;
GRANT SELECT ON public.profiles,public.stalls,public.events,public.profile_stalls,
  public.closing_feedback,public.report_shares TO authenticated;
GRANT SELECT,INSERT ON public.closings TO authenticated;
GRANT INSERT ON public.report_shares TO authenticated;
GRANT UPDATE(revoked_at) ON public.report_shares TO authenticated;
GRANT UPDATE(active,full_name) ON public.profiles TO authenticated;
GRANT INSERT ON public.stalls,public.events,public.profile_stalls TO authenticated;
GRANT UPDATE(name,emoji,active,sort_order) ON public.stalls TO authenticated;
GRANT UPDATE(title,starts_on,ends_on,active) ON public.events TO authenticated;
GRANT DELETE ON public.profile_stalls TO authenticated;
GRANT UPDATE(status,review_note,reviewed_by,reviewed_at) ON public.closings TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

INSERT INTO public.stalls(slug,name,emoji,sort_order) VALUES
('fogaca','Fogaça','🥟',1),('churrasco','Churrasco','🔥',2),
('hamburguer','Hambúrguer','🍔',3),('cachorro','Cachorro-quente','🌭',4),
('milho','Milho','🌽',5),('pipoca','Pipoca','🍿',6),
('algodao','Algodão-doce','🍭',7),('pernil','Lanche de pernil','🥪',8);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('closing-receipts','closing-receipts',false,8388608,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY receipts_collab_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='closing-receipts' AND
  (storage.foldername(name))[1]=(SELECT auth.uid())::text AND
  private.is_active_member((SELECT auth.uid())) AND
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='collaborator'));
CREATE POLICY receipts_admin_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='closing-receipts' AND private.is_admin((SELECT auth.uid())));
