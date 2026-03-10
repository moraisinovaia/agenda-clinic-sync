

## Diagnóstico: Confirmação de Agendamento Lenta

### Problema Identificado

O fluxo de confirmação em `useAppointmentsList.ts` (linhas 828-958) executa **4 chamadas sequenciais ao banco** antes de mostrar resultado:

```text
1. getUserProfile() → RPC get_current_user_profile     (~200-500ms)
2. SELECT status check → query agendamentos             (~200-500ms)
3. retryOperation(confirmar_agendamento) → RPC           (~200-500ms)
4. refetch() → query completa de todos agendamentos      (~500-2000ms)
─────────────────────────────────────────────────────────
Total estimado: 1.1s - 3.5s (sem retries)
```

Agravantes:
- **retryOperation com 5 tentativas** e backoff exponencial (1s, 2s, 4s, 8s, 16s) -- se houver qualquer falha, pode levar 31 segundos
- **Verificação de status redundante**: a query SELECT antes do RPC é desnecessária -- a função SQL `confirmar_agendamento` já valida o status internamente
- **refetch() bloqueante**: após o update otimista (que já mostra o resultado na UI), ainda espera um refetch completo antes de liberar `isOperatingRef`
- **withTimeout de 15s + 20s**: timeouts muito generosos que mascaram lentidão

### Plano de Correção

**Arquivo**: `src/hooks/useAppointmentsList.ts`

**1. Aplicar update otimista ANTES da chamada RPC (feedback instantâneo)**
- Mover `updateLocalAppointment()` para antes da chamada `confirmar_agendamento`
- O usuário vê "confirmado" imediatamente na UI

**2. Remover a query de verificação de status redundante (economiza ~300ms)**
- Eliminar o bloco SELECT + validação de status (linhas 843-877)
- A função SQL já retorna erro se o status não permitir confirmação

**3. Reduzir retries de 5 para 2 e timeouts**
- `retryOperation` de 5 para 2 tentativas
- `withTimeout` de 20s para 10s

**4. Tornar refetch não-bloqueante**
- Após sucesso, fazer `refetch()` em background sem `await`
- Liberar `isOperatingRef` imediatamente após o RPC retornar

**5. Aplicar mesmas otimizações em `unconfirmAppointment`, `cancelAppointment` e `deleteAppointment`**
- Mesma estrutura: otimista primeiro, sem pre-check, refetch em background

### Resultado Esperado

```text
ANTES:  getUserProfile → SELECT status → RPC → refetch (1.1-3.5s)
DEPOIS: otimista (instantâneo) → getUserProfile(cache) → RPC → refetch(background)
         UI feedback: <50ms | operação total: 200-500ms
```

