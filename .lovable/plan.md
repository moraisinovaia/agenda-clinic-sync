

# Auditoria de Prontidão para Produção

## Veredicto: 95% pronto. 2 bugs impedem o controle de limites.

---

## O que está correto e funcional

| Componente | Status |
|------------|--------|
| RLS — todas 30 tabelas com policies PERMISSIVE | OK |
| Isolamento `cliente_id` em 26+ tabelas | OK |
| `get_user_auth_data` — reconhece `super_admin` | OK |
| `useStableAuth.ts` — fallback inclui `is_super_admin` | OK |
| Logger envia `clienteId` para edge function | OK |
| Edge function `system-logs` grava `cliente_id` | OK |
| `SubscriptionPlansPanel` no painel admin | OK |
| `check_tenant_limit` integrado em 4 pontos | OK (mas com bug) |
| Cron jobs de limpeza | OK |
| Tab "Planos" visível para super_admin | OK |

---

## 2 Bugs Críticos: Limites de Tenant NUNCA são aplicados

### Bug 1 — Parâmetro errado na chamada RPC

A função SQL espera `limit_type` mas o frontend envia `p_tipo`:

```
-- Função SQL:
check_tenant_limit(limit_type text) RETURNS boolean

-- Frontend chama:
supabase.rpc('check_tenant_limit', { p_tipo: 'medicos' })
```

Resultado: erro silencioso, o `catch` retorna `{ allowed: true }` — limites nunca bloqueiam.

### Bug 2 — Tipo de retorno incompatível

A função retorna `boolean` (`true`/`false`), mas o frontend espera um objeto JSON `{ allowed, current, max, message }`:

```typescript
// useTenantLimits.ts linha 26:
if (data && typeof data === 'object') {  // boolean nunca entra aqui
  ...
}
return { allowed: true, ... };  // sempre cai aqui — limites ignorados
```

O mesmo problema ocorre nos 4 pontos de integração (`DoctorManagementPanel`, `UserApprovalPanel`, `FilaEsperaForm`, `useAtomicAppointmentCreation`), todos fazem `'allowed' in (limitResult as any)` que falha com boolean.

---

## Plano de Correção

### 1. Reescrever `check_tenant_limit` no banco

Alterar a função SQL para:
- Aceitar parâmetro `p_tipo` (compatível com o frontend)
- Retornar `JSON` em vez de `boolean`, com campos `{ allowed, current, max, message }`

```sql
CREATE OR REPLACE FUNCTION check_tenant_limit(p_tipo text)
RETURNS json AS $$
DECLARE
  v_cliente_id uuid; v_plano record;
  v_count int; v_max int; v_label text;
BEGIN
  v_cliente_id := get_user_cliente_id();
  IF v_cliente_id IS NULL THEN
    RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END IF;
  
  SELECT * INTO v_plano FROM planos_assinatura 
  WHERE cliente_id = v_cliente_id AND status IN ('ativo','trial') LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END IF;
  
  CASE p_tipo
    WHEN 'medicos' THEN
      SELECT count(*) INTO v_count FROM medicos WHERE cliente_id = v_cliente_id AND ativo;
      v_max := v_plano.max_medicos; v_label := 'médicos';
    WHEN 'usuarios' THEN
      SELECT count(*) INTO v_count FROM profiles WHERE cliente_id = v_cliente_id AND ativo;
      v_max := v_plano.max_usuarios; v_label := 'usuários';
    WHEN 'pacientes' THEN
      SELECT count(*) INTO v_count FROM pacientes WHERE cliente_id = v_cliente_id;
      v_max := v_plano.max_pacientes; v_label := 'pacientes';
    ELSE
      RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END CASE;
  
  IF v_count >= v_max THEN
    RETURN json_build_object('allowed', false, 'current', v_count, 'max', v_max,
      'message', format('Limite de %s atingido (%s/%s). Atualize seu plano.', v_label, v_count, v_max));
  END IF;
  
  RETURN json_build_object('allowed', true, 'current', v_count, 'max', v_max, 'message', '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 2. Nenhuma alteração no frontend necessária

O hook `useTenantLimits` e os 4 pontos de integração já esperam o formato JSON correto. Ao corrigir a função SQL, tudo passa a funcionar automaticamente.

---

## Resumo

| Item | Antes | Depois |
|------|-------|--------|
| Limites de médicos/pacientes/usuários | Silenciosamente ignorados | Aplicados corretamente |
| Parâmetro `p_tipo` | Incompatível | Compatível |
| Retorno da RPC | `boolean` | `JSON { allowed, current, max, message }` |

Apenas 1 migração SQL resolve os 2 bugs. Zero alterações no frontend.

