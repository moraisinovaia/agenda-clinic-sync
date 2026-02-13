

# Plano de Seguranca - Fase 1: Validacao JWT nas Edge Functions do Frontend

## Contexto

O plano original de 13 passos foi analisado e reduzido a 3 acoes validas. O usuario vai executar manualmente os passos 1 (search_path) e 3 (senhas vazadas). Este plano cobre o passo 2: adicionar validacao JWT nas edge functions chamadas pelo frontend.

## Como funciona

O SDK do Supabase (`supabase.functions.invoke()`) **ja envia automaticamente** o token JWT do usuario logado no header `Authorization`. Hoje as funcoes simplesmente ignoram esse header. Vamos adicionar codigo para **validar esse token** antes de processar a requisicao.

## Funcoes a proteger (8)

Apos analise do codigo, **excluimos 2 funcoes da lista original de 10**:

| Funcao | Chamada pelo frontend? | Acao |
|--------|----------------------|------|
| `bloqueio-agenda` | Sim (BloqueioAgenda.tsx) | Proteger |
| `user-management` | Sim (UserApprovalPanel.tsx) | Proteger |
| `gmail-alerts` | Sim (AlertSystem.tsx) | Proteger |
| `notification-scheduler` | Sim (SmartNotificationDashboard.tsx) | Proteger |
| `system-logs` | Sim (SystemMonitorDashboard.tsx) | Proteger |
| `backup-system` | Sim (useBackupSystem.ts) | Proteger |
| `auto-backup` | Sim (useBackupSystem.ts) | Proteger |
| `fix-approved-users-emails` | Sim (Auth.tsx, UserApprovalPanel.tsx) | Proteger |
| `clinic-data` | **Nao encontrada no frontend** | NAO proteger |
| `create-test-user` | **Nao encontrada no frontend** | NAO proteger |

`clinic-data` e `create-test-user` nao sao chamadas por nenhum componente React. Protege-las com JWT as tornaria inacessiveis. Podem ser protegidas depois com API key se necessario.

## Detalhes tecnicos

### Padrao de validacao (adicionado apos CORS e antes da logica principal)

```text
// 1. Extrair header Authorization
// 2. Criar cliente Supabase com anon key + header do usuario
// 3. Validar token com getClaims()
// 4. Se invalido, retornar 401
// 5. Se valido, continuar com o fluxo existente
```

Usamos `getClaims()` (nao `getUser()`) porque:
- Nao faz round-trip ao servidor auth (mais rapido)
- Valida o JWT localmente usando as signing keys
- Retorna `sub` (user_id), `email`, `role`, `exp`

### Particularidades por funcao

**`bloqueio-agenda`** (556 linhas):
- Usa `SUPABASE_SERVICE_ROLE_KEY` para operacoes (bypassa RLS)
- A validacao JWT sera adicionada ANTES da criacao do cliente service role
- O cliente service role continua sendo usado para as operacoes (necessario para queries cross-tenant)

**`user-management`** (268 linhas):
- Ja tem verificacao de admin via RPC `verify_admin_access`
- A validacao JWT adiciona uma camada extra: primeiro valida que e um usuario autenticado, depois a funcao verifica se e admin

**`gmail-alerts`** (147 linhas):
- Usa Resend, nao cria cliente Supabase
- Precisa adicionar import do createClient e criacao do cliente apenas para validacao

**`notification-scheduler`** (452 linhas):
- Usa service role key para operacoes
- Validacao JWT adicionada antes

**`system-logs`** (138 linhas):
- Aceita GET e POST
- Validacao JWT adicionada para ambos os metodos

**`backup-system`** (284 linhas):
- Usa service role key
- Validacao JWT adicionada antes

**`auto-backup`** (233 linhas):
- Usa service role key
- Validacao JWT adicionada antes

**`fix-approved-users-emails`** (166 linhas):
- Usa service role key
- Validacao JWT adicionada antes

### O que NAO muda

- `verify_jwt = false` permanece no `config.toml` (padrao recomendado com signing-keys)
- As 10 funcoes do n8n/externas NAO sao alteradas (serao protegidas com API key na Fase 2)
- `clinic-data` e `create-test-user` NAO sao alteradas
- A logica interna de cada funcao permanece identica

### Sequencia de implementacao

1. Editar as 8 funcoes adicionando o bloco de validacao JWT
2. Todas as edicoes serao feitas em paralelo (sem dependencias entre elas)
3. Apos deploy automatico, testar via login no sistema

### Riscos

- **Risco baixo**: Se houver bug na validacao, usuarios logados recebem 401. Reversao e simples (remover o bloco de validacao).
- **Mitigacao**: O SDK do Supabase ja envia o token automaticamente, entao nenhuma mudanca e necessaria no frontend.

