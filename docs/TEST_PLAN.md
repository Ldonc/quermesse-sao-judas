# Plano de testes para homologação

## Demonstração local
1. Iniciar com `npm run dev` e entrar como administrador.
2. Verificar menu completo: Visão geral, Comparativos, Barracas, Conferência, Compartilhar, Equipe, Eventos, Auditoria.
3. Filtrar conferências por edição, barraca, status e busca; limpar filtros.
4. Comparar duas edições, conferir diferença absoluta, percentual e detalhamento por barraca.
5. Criar, editar, desativar e reativar uma barraca; conferir preservação de históricos.
6. Conceder relatório a um colaborador e revogá-lo; como colaborador, verificar que o relatório não aparece depois da revogação.
7. Como colaborador, criar fechamento fictício de uma barraca atribuída com imagem de teste; como admin, aprovar ou solicitar correção.
8. No reenvio V5.5, conferir que não é possível trocar data, barraca ou edição para contornar a correção.

## Backend real de homologação (obrigatório antes da produção)
1. Criar duas contas de colaboradores com barracas distintas, uma conta admin.
2. Tentar SELECT na tabela `closings` com token colaborador: deve retornar acesso negado ou nenhuma linha.
3. Tentar UPDATE em `profiles.role`, `report_shares` e `closings.amount` como colaborador: deve falhar.
4. Tentar visualização direta do comprovante privado via URL sem assinatura: deve falhar.
5. Tentar reenvio com replaces_id de outra pessoa/barraca/data: deve falhar.
6. Tentar duas novas submissões substituindo o mesmo original: segunda deve falhar.
7. Aprovar um fechamento, depois tentar alterá-lo outra vez: deve falhar.
8. Compartilhar relatório aprovado, verificar snapshot, revogar e confirmar bloqueio no próximo acesso.
9. Enviar convite por Edge Function como admin e depois com token colaborador: somente admin deve conseguir.
10. Simular erro de rede entre upload e INSERT de fechamento, verificar rastreabilidade e política para foto órfã.
11. Executar restore de backup para comprovar recuperação de dados.

## Testes automatizados
`npm test` cobre cálculos, filtros e mock local; `npm run scan:secrets` busca padrões de credenciais nos arquivos publicados. Esses testes não equivalem a um pentest, teste E2E ou garantia de produção.
