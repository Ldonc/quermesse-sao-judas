# Publicar este projeto no GitHub

## Conferência de privacidade
Este pacote é destinado ao **código público e demonstração fictícia**. Não use a configuração da igreja e não coloque credenciais reais em `.env.example`.

Antes do primeiro `git add .`, execute:

```powershell
npm.cmd run scan:secrets
npm.cmd test
```

## Criar repositório público pelo GitHub CLI
Abra a pasta extraída no terminal do VS Code e execute:

```powershell
git init
git branch -M main
git add .
git status --short
git commit -m "feat: portfolio da quermesse V5.5 com frontend original refatorado"
gh repo create quermesse-sao-judas --public --source=. --remote=origin --push
```

**Revise a listagem de `git status --short` antes do commit.** Se aparecer qualquer `.env` real, comprovante, exportação ou dado pessoal, interrompa a publicação e remova o arquivo do índice. Um `gitignore` não apaga dados que já foram gravados no histórico.

## Mostrar o projeto no currículo
1. Configure a descrição do repositório no GitHub: `Sistema de gestão de quermesses com JavaScript, Supabase, PostgreSQL e RLS`.
2. Inclua tópicos (topics): `javascript`, `supabase`, `postgresql`, `rls`, `vite`, `portfolio`.
3. Abra `README.md` e confira o resultado visual na interface do GitHub.
4. Hospede apenas o **modo demonstração** com `VITE_DEMO_MODE=true` e adicione a URL no campo **Website** do repositório.
5. Adicione o link do GitHub ao seu currículo e, quando houver deploy, também o endereço da demo.

## Segurança de produção
A publicação do GitHub não implanta nem atualiza automaticamente o banco da igreja. Para mudanças em SQL, siga o processo controlado de migrações e homologação descrito em `docs/DEPLOY.md`.
