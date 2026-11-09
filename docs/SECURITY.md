# Segurança — revisão antes de publicação e produção

## Antes do primeiro push público
- [ ] `git status --short` e `git diff --cached --name-only` não exibem `.env`, dumps, e-mails ou comprovantes.
- [ ] Nenhum token `sb_secret_`, chave `service_role` ou senha foi inserido em código ou no histórico Git.
- [ ] A demo está configurada com `VITE_DEMO_MODE=true` e sem variáveis de produção no hosting.
- [ ] Capturas de tela contêm somente dados fictícios.
- [ ] GitHub Secret Scanning / Push Protection habilitados quando disponíveis.
- [ ] Histórico Git anterior revisado; `.gitignore` não apaga segredos de commits antigos.

## Banco de homologação (projeto NOVO)
- [ ] `RLS` habilitada nas 8 tabelas públicas.
- [ ] Conta de colaborador não acessa `closings` via SELECT, nem via REST, mesmo alterando URL da API.
- [ ] `closing_feedback` retorna apenas entradas do usuário.
- [ ] `report_shares` só retorna snapshots não revogados para o destinatário.
- [ ] Nenhum colaborador consegue atualizar perfis, eventos, barracas, status ou compartilhamentos.
- [ ] Reenvio V5.5: rejeita troca de evento, barraca, data, usuário, status incorreto e segundo reenvio para o mesmo original.
- [ ] Revisão: rejeita aprovação de registro já concluído, correção sem justificativa e troca de valores/comprovantes.
- [ ] Verificar UPDATE e SELECT por coluna e não só as políticas RLS.
- [ ] Verificar permissões `EXECUTE` de funções `SECURITY DEFINER`; manter funções auxiliares fora dos schemas expostos.
- [ ] Verificar que nenhuma view pública ignora RLS.

## Arquivos
- [ ] Bucket `closing-receipts` privado; apenas administradores conseguem gerar URL assinada.
- [ ] Upload somente de colaboradores ativos em subdiretório do próprio usuário.
- [ ] Tipo JPEG, PNG ou WEBP e limite de 8 MB aplicados no frontend e Storage.
- [ ] Definir rotina de limpeza de imagens órfãs e de retenção/exclusão de comprovantes.

## Contas e operação
- [ ] Proteção contra senhas vazadas e senha forte ativadas em Auth, se disponível no plano.
- [ ] Convites reais por e-mail e redirecionamento permitidos configurados; teste com conta de homologação.
- [ ] Administradores com MFA quando possível.
- [ ] Backups automáticos e teste de restauração agendado.
- [ ] Política de privacidade/LGPD, retenção e responsáveis definidos pela igreja.
- [ ] HTTPS, domínio controlado, monitoramento e procedimentos de recuperação de acesso.

## Limitações conhecidas
- Uma publicação pública do frontend em modo conectado pode revelar URL e chave **publishable** do Supabase (normal); sua segurança depende das regras do backend.
- A demo usa memória/localStorage; não substitui autenticação nem RLS.
- O pacote não executa testes ofensivos nem certifica o ambiente operacional.
- Publicar o código completo não implica publicar dados privados do banco, mas migrações, políticas e Edge Functions incluídas ficam visíveis.
