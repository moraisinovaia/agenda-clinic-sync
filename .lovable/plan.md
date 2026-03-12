

# Plano de Implementação — 3 Itens Pendentes do Frontend

## Contexto

O banco está pronto (nota 9/10). Faltam 3 ajustes no frontend para completar o suporte multi-clínica.

---

## Item 1: Adicionar `cliente_id` ao Logger

**Arquivo:** `src/utils/logger.ts`

**O que muda:**
- Importar o client Supabase
- Adicionar cache de `cliente_id` (via `profiles.cliente_id`) com TTL de 5 min
- Ao criar log entries, incluir `clienteId` no payload
- Alterar `sendToSupabase()` para chamar a edge function `system-logs` com URL completa e headers corretos (Authorization Bearer + apikey), em vez de `/api/logs` que não existe
- O `clienteId` será enviado no body do POST para que a edge function o persista na coluna `cliente_id` de `system_logs`

**Edge function `system-logs`:** Precisa ser atualizada para gravar o campo `clienteId` recebido no body como `cliente_id` na tabela.

---

## Item 2: Integrar `check_tenant_limit()` antes de criar entidades

**Hook utilitário novo:** `src/hooks/useTenantLimits.ts`
- Expõe função `checkLimit(tipo: 'medicos' | 'pacientes' | 'usuarios')` que chama `supabase.rpc('check_tenant_limit', { p_tipo: tipo })`
- Retorna `{ allowed: boolean, current: number, max: number, message: string }`

**Pontos de integração:**

1. **Criar médico** — `src/components/admin/DoctorManagementPanel.tsx` (linha ~257)
   - Antes de chamar `criar_medico`, chamar `checkLimit('medicos')`
   - Se não permitido, exibir toast de erro com a mensagem e abortar

2. **Criar paciente** — `src/hooks/useAtomicAppointmentCreation.ts` (linha ~186)
   - Antes de chamar `criar_agendamento_atomico`, chamar `checkLimit('pacientes')`
   - Também em `src/components/fila-espera/FilaEsperaForm.tsx` (linha ~112) ao criar paciente inline

3. **Aprovar usuário** — `src/components/admin/UserApprovalPanel.tsx`
   - Antes de aprovar, chamar `checkLimit('usuarios')`

---

## Item 3: Tela de Gestão de Planos de Assinatura

**Novo componente:** `src/components/admin/SubscriptionPlansPanel.tsx`

**Funcionalidades:**
- Tabela listando todas as clínicas com seus planos (query `planos_assinatura` JOIN `clientes`)
- Colunas: Clínica, Plano, Status, Médicos (atual/max), Usuários (atual/max), Agendamentos/mês (atual/max), Pacientes (atual/max), Valor mensal
- Botão de editar para cada clínica — abre dialog com formulário para alterar: plano, limites, status, valor, datas
- Visível apenas para super_admin

**Integração no Index.tsx:**
- Adicionar nova tab "Planos" no painel admin (ao lado de "Clínicas", "Médicos", etc.)
- Importar e renderizar `SubscriptionPlansPanel`

---

## Resumo de arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/utils/logger.ts` | Reescrever com cliente_id e URL correta da edge function |
| `supabase/functions/system-logs/index.ts` | Adicionar campo `cliente_id` do body no INSERT |
| `src/hooks/useTenantLimits.ts` | Criar hook utilitário |
| `src/components/admin/DoctorManagementPanel.tsx` | Adicionar check antes de criar médico |
| `src/hooks/useAtomicAppointmentCreation.ts` | Adicionar check antes de criar agendamento/paciente |
| `src/components/fila-espera/FilaEsperaForm.tsx` | Adicionar check antes de criar paciente |
| `src/components/admin/UserApprovalPanel.tsx` | Adicionar check antes de aprovar usuário |
| `src/components/admin/SubscriptionPlansPanel.tsx` | Criar painel completo |
| `src/pages/Index.tsx` | Adicionar tab "Planos" no admin |

