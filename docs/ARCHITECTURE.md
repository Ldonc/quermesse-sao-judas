# Arquitetura

## Domínio
- **Usuário:** perfil em `profiles` vinculado ao `auth.users` do Supabase. Papel `admin` ou `collaborator`, com flag `active`.
- **Barraca:** `stalls`, que pode ser desativada sem apagar dados históricos. `profile_stalls` relaciona colaboradores às suas barracas.
- **Edição:** `events`, com datas de início e fim; um fechamento pertence a uma edição.
- **Fechamento:** `closings`, com valor, foto, data, observações e status.
- **Retorno:** `closing_feedback`, registro sem valor e comprovante para acompanhamento pelo colaborador.
- **Compartilhamento:** `report_shares`, snapshot financeiro individual revogável.
- **Auditoria:** `audit_log`, alimentado por triggers para atualizações de fechamento e compartilhamento.

## Fluxo de fechamento
```mermaid
sequenceDiagram
  participant C as Colaborador
  participant U as Frontend
  participant S as Supabase
  participant A as Administrador
  C->>U: Informa barraca, data, valor e foto
  U->>S: Upload privado do comprovante
  U->>S: INSERT closing (RLS + verificação de evento)
  S->>S: Cria closing_feedback sem valor
  A->>U: Visualiza a fila de conferência
  U->>S: Lê comprovante via URL assinada temporária
  A->>S: Aprova ou pede correção
  S->>S: Valida transição e registra auditoria
  C->>U: Visualiza retorno sem valor
  C->>S: Reenvia com replaces_id, quando permitido
  S->>S: Valida original e evita reenvio duplicado
```

## Fronteiras de confiança
A tela de login e os botões não concedem permissões. A versão conectada usa JWT emitido pelo Auth, RLS em todas as tabelas públicas, privilégios SQL por coluna, políticas de Storage e uma Edge Function com validação da identidade e do perfil admin. A demo simula os fluxos para portfólio, mas **não implementa isolamento de segurança real**.

## Não foi feito
A integração com Power BI, os testes E2E contra o banco real e a infraestrutura completa de observabilidade não estão incluídos neste pacote. Não apresentar esses itens como prontos em entrevistas.
