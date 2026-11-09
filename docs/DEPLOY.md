# Execução, publicação e implantação

## 1. Apenas portfólio (recomendado para o GitHub público)
- `npm install`
- `npm run dev`
- Deixe `VITE_DEMO_MODE=true` (padrão mesmo sem arquivo `.env`).
- Para publicar em serviço estático (Vercel, Netlify, GitHub Pages com base URL configurada), execute `npm run build` e publique a pasta `dist/`.
- **Nunca vincule a demonstração à instância do Supabase usada pela igreja.**

## 2. Instância privada nova
Crie um projeto novo no painel Supabase. Copie `.env.example` para `.env` e use somente a URL e chave publishable daquela instância:

```dotenv
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No SQL Editor do projeto NOVO, execute a migração de instalação limpa `supabase/migrations/20261109230000_quermesse_v55_fresh_install.sql` (ou aplique com CLI de migrações conforme fluxo do seu projeto). **Jamais execute esse arquivo no banco da igreja existente: ele contém CREATE TABLE e pressupõe uma instância vazia.**

Deploy da Edge Function:

```bash
supabase login
supabase link --project-ref SEU-NOVO-REF
supabase functions deploy invite-collaborator
```

Confira o estado de autenticação no painel do Supabase e os nomes de credenciais esperados pela função. Os segredos devem existir **somente nas variáveis do lado servidor**, jamais no frontend nem no GitHub. Configure SMTP, domínios de redirecionamento e link correto do convite.

## 3. Primeiro administrador
1. No Auth, crie ou registre um usuário real e confirme o controle do endereço de e-mail.
2. Em processo de provisionamento administrativo **fora do código público**, associe o UUID verdadeiro desse usuário a um perfil `admin` em `public.profiles`.
3. Verifique que não há criação automática de administrador por cadastro e que usuários comuns não conseguem mudar sua própria role.
4. Faça login e valide os menus de administração e as regras de RLS.

> Não há conta nem senha `admin` predeterminadas. A operação administrativa inicial deve ser autorizada pelo responsável pelo projeto.

## 4. Antes de implantar na igreja
Execute integralmente `docs/SECURITY.md` e `docs/TEST_PLAN.md`. Inclua validação da equipe administrativa, política de backup, HTTPS e responsabilidades LGPD. A autenticação e os envios reais exigem conexão e configuração apropriada; não há operação offline.

## 5. Atualizações futuras
Com GitHub/CI, uma mudança no código frontend pode gerar novo build e deploy sem apagar o banco. Mudanças em estrutura SQL devem ser versionadas em migrações novas, revisadas e testadas em homologação, aplicadas à produção por procedimento controlado. **Nunca recrie o banco de produção do zero para atualizar a interface.**
