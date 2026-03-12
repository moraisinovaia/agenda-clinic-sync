

## Análise Minuciosa: Dois Problemas Identificados

### Problema 1: Clínicas do seletor não filtram por domínio/parceiro

**Causa**: A função RPC `get_clinicas_para_signup()` retorna TODAS as clínicas ativas, sem filtrar pelo parceiro do domínio. Resultado: domínio GT INOVA mostra clínicas do INOVAIA e vice-versa.

**Dados atuais**:
- GT INOVA: Clínica Olhos, Clínica Vênus
- INOVAIA: Clínica Orion, ENDOGASTRO, IPADO

**Solução**: Criar nova versão da RPC `get_clinicas_para_signup(p_parceiro TEXT)` que aceita o parceiro como parâmetro e filtra por `clientes.parceiro`. No frontend (Auth.tsx), detectar o parceiro pelo hostname e passá-lo à RPC. Em domínios genéricos (localhost, lovable.app), mostrar todas as clínicas.

### Problema 2: Erro ao criar usuário "ARLINDA"

**Investigação concluída**:
- Username "ARLINDA" NÃO existe na tabela profiles
- Email `moraisinovaiacloud+ARLINDA@gmail.com` NÃO existe em auth.users
- O `check_username_available` e `get_clinicas_para_signup` NÃO possuem `GRANT EXECUTE` explícito para o role `anon` (verificado via `information_schema.routine_privileges`)

**Causa provável**: A senha "endogastro124" pode estar sendo rejeitada pelo Supabase (HaveIBeenPwned check ou política de senha), mas a mensagem de erro genérica no Auth.tsx não captura o motivo real. O fallback na linha 242 mostra apenas "Erro ao criar conta. Tente novamente." sem o erro original.

**Solução**:
1. Garantir GRANTs explícitos para `anon` nas RPCs usadas no signup
2. Melhorar captura de erro no Auth.tsx para exibir a mensagem REAL do Supabase em vez do fallback genérico
3. Adicionar mapeamento para erros de senha fraca/leaked com sugestão específica

### Plano de Implementação

**1. Migration SQL**:
- Recriar `get_clinicas_para_signup(p_parceiro TEXT DEFAULT NULL)` com filtro opcional por parceiro
- Adicionar GRANTs explícitos para `anon` e `authenticated` em ambas RPCs
- Manter compatibilidade: sem parâmetro = retorna todas (domínios genéricos)

**2. Auth.tsx (signup form)**:
- Usar `detectPartnerByHostname()` / `isGenericDomain()` para detectar parceiro
- Passar parceiro à RPC `get_clinicas_para_signup` para filtrar clínicas
- Melhorar `handleSignup` para exibir `error.message` real quando não match nenhum padrão conhecido (em vez do genérico "Tente novamente")
- Adicionar mapeamento para erros "Database error", "username", "unique_violation"

**3. useAuth.tsx** (ajuste menor):
- Garantir que TODOS os caminhos de erro retornam a mensagem original para o caller poder decidir

### Detalhes Técnicos

```text
get_clinicas_para_signup(p_parceiro TEXT DEFAULT NULL)
├── p_parceiro = NULL → retorna TODAS ativas (domínio genérico)
└── p_parceiro = 'GT INOVA' → WHERE parceiro = 'GT INOVA'
```

Fluxo no Auth.tsx:
```text
useEffect (fetchClinicas)
├── isGenericDomain() → RPC sem parâmetro → todas clínicas
└── detectPartnerByHostname() → RPC com parceiro → clínicas filtradas
```

