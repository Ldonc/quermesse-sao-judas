# Notas de versão — Quermesse São Judas V5.5 (frontend original refatorado)

**Data de preparação:** 09/11/2026

## Base da versão
- **Frontend:** proveniente do arquivo original `Quermesse_Sao_Judas_V5.html`, preservando a identidade visual, conteúdo e os fluxos de usuário. Refatorado em módulos ES para manutenção e portfólio.
- **Backend:** baseado nas migrações V5 + V5.5 do projeto Supabase e na Edge Function de convite. O SQL incluído é uma **instalação limpa para um projeto separado**, não uma atualização do banco já existente.

## Alterações
- Quebra do HTML monolítico em `index.html`, `styles.css`, `main.js`, views administrativas, views do colaborador, handlers e serviços.
- Separação de configuração da aplicação em `.env.example` para não embutir URL nem chave pública de um projeto particular no repositório.
- Simulação de portfólio com dados fictícios e botões de administrador/colaborador.
- Filtros por edição, barraca, status e texto na conferência.
- Cadastro, alteração de nome, ativação e desativação de barracas.
- Comparativo entre edições, incluindo diferença por barraca e percentuais.
- Exportação CSV de fechamentos aprovados para o administrador.
- README, arquitetura, checklist de segurança, plano de testes e roteiro de publicação no GitHub.

## Verificações realizadas
- `node --check` em módulos JS: **aprovado**.
- `npm test`: **15 testes aprovados** (analytics, mock local e renderização de views).
- `npm run scan:secrets`: **sem referências conhecidas ao projeto original e sem padrões detectados de chaves secretas**.

## O que ainda falta validar
- Build real do Vite: `npm install` não concluiu na sessão de geração por indisponibilidade de resolução de DNS para `registry.npmjs.org`.
- Teste visual em navegador: automação bloqueada por restrição do ambiente de geração.
- Testes E2E contra Supabase de homologação, incluindo autenticação, RLS, imagens, convites e recuperação de erro.

Não declare o sistema pronto para produção apenas com esses testes. Nenhuma alteração foi aplicada ao banco real da instituição.
