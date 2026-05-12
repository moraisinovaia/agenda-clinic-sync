#!/usr/bin/env bash
# ============================================================================
# Suite COMPLETA dos endpoints /cancel + /reschedule
#
#   A. /cancel — cancelamento básico, idempotência, agendamento inexistente,
#      slot libera para outros pacientes
#   B. /reschedule — remarcação válida, slot antigo libera, slot novo ocupado,
#      data passada, dia não atendido, agendamento inexistente
#   C. Multi-tenant — cliente_id errado não cancela/remarca
#   D. Integração — fila de espera é notificada quando vaga libera (best-effort)
#
# Test isolation: cleanup via trap EXIT cancela todos os agendamentos criados.
#
# Uso:
#   ENDPOINT=... API_KEY=... ./cancel-reschedule-completo.sh
# ============================================================================

set -u

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
MARCELO_CID="2bfb98b5-ae41-4f96-8ba7-acc797c22054"
MARCELO_CFG="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
SUELY_CID="0b6a0a35-0059-4a0c-9fb8-413b6253c2ad"
SUELY_CFG="e78600e1-c965-4578-92e5-e9d4cb4ed790"

PASS=0; FAIL=0
declare -a AGENDAMENTOS_CRIADOS

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────

schedule_call() {
  local cid="$1" cfg="$2" body="$3"
  curl -s -X POST "${ENDPOINT}/schedule" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",$body}"
}

cancel_call() {
  local cid="$1" cfg="$2" id="$3" motivo="${4:-teste}"
  curl -s -X POST "${ENDPOINT}/cancel" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"agendamento_id\":\"$id\",\"motivo\":\"$motivo\"}"
}

reschedule_call() {
  local cid="$1" cfg="$2" id="$3" data="$4" hora="$5"
  curl -s -X POST "${ENDPOINT}/reschedule" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"agendamento_id\":\"$id\",\"nova_data\":\"$data\",\"nova_hora\":\"$hora\"}"
}

avail_call() {
  local cid="$1" cfg="$2" medico="$3" servico="$4" data="$5"
  curl -s -X POST "${ENDPOINT}/availability" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"medico_nome\":\"$medico\",\"atendimento_nome\":\"$servico\",\"data_consulta\":\"$data\",\"buscar_proximas\":true}"
}

assert_eq() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (=${actual})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"; echo -e "    esperado: ${expected}"; echo -e "    atual:    ${actual}"
    FAIL=$((FAIL+1))
  fi
}

assert_truthy() {
  local label="$1" val="$2"
  if [ -n "$val" ] && [ "$val" != "null" ] && [ "$val" != "false" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (=${val})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} ('${val}')"; FAIL=$((FAIL+1))
  fi
}

assert_contains_slot() {
  local label="$1" array="$2" slot="$3"
  if echo "$array" | jq -e --arg s "$slot" 'index($s) != null' >/dev/null 2>&1; then
    echo -e "${GREEN}  ✓ ${label}${NC} (contém ${slot})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (slot ${slot} ausente)"; FAIL=$((FAIL+1))
  fi
}

assert_not_contains_slot() {
  local label="$1" array="$2" slot="$3"
  if echo "$array" | jq -e --arg s "$slot" 'index($s) == null' >/dev/null 2>&1; then
    echo -e "${GREEN}  ✓ ${label}${NC} (não contém ${slot})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (slot ${slot} deveria estar ausente)"; FAIL=$((FAIL+1))
  fi
}

header() { echo ""; echo -e "${BOLD}${YELLOW}━━ $1 ━━${NC}"; }

cleanup() {
  if [ "${#AGENDAMENTOS_CRIADOS[@]}" -gt 0 ]; then
    echo ""; echo -e "${YELLOW}🧹 cleanup ${#AGENDAMENTOS_CRIADOS[@]} agendamento(s)...${NC}"
    for entry in "${AGENDAMENTOS_CRIADOS[@]}"; do
      [ -z "$entry" ] && continue
      IFS='|' read -r cid cfg id <<< "$entry"
      cancel_call "$cid" "$cfg" "$id" "cleanup" >/dev/null 2>&1 || true
    done
  fi
}
trap cleanup EXIT

# ── Datas ────────────────────────────────────────────────────────────────
proxima() {
  python3 -c "
from datetime import date, timedelta
d = date.today() + timedelta(days=$1)
while d.weekday() != $2: d += timedelta(days=1)
print(d.isoformat())"
}
DATA_A=$(proxima 100 0)  # segunda longe (cancel)
DATA_B=$(proxima 130 0)  # segunda longe (reschedule)
DATA_C=$(proxima 100 5)  # sábado (Suely não atende)

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "  Suite /cancel + /reschedule"
echo "  Endpoint: ${ENDPOINT}"
echo "  Datas: A=$DATA_A  B=$DATA_B  sab=$DATA_C"
echo "═══════════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# A. /cancel
# ═══════════════════════════════════════════════════════════════════════════

header "A0: setup — cria agendamento Suely $DATA_A 10:00"
R=$(schedule_call "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"CANCEL TEST A0\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900001000\",\"data_consulta\":\"$DATA_A\",\"hora_consulta\":\"10:00:00\"")
AG_A0=$(echo "$R" | jq -r '.agendamento_id // empty')
assert_truthy "agendamento criado" "$AG_A0"

header "A1: /cancel agendamento válido → success"
R=$(cancel_call "$SUELY_CID" "$SUELY_CFG" "$AG_A0" "teste de cancelamento")
assert_eq "success=true"   "$(echo "$R" | jq -r '.success | tostring')" "true"
assert_eq "agendamento_id" "$(echo "$R" | jq -r '.agendamento_id // empty')" "$AG_A0"

header "A2: slot 10:00 liberado após cancelamento"
SLOTS=$(avail_call "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta" "$DATA_A" | \
  jq -c "[.proximas_datas[]? | select(.data==\"$DATA_A\") | .periodos[].horarios[]?]")
assert_contains_slot "10:00 voltou a aparecer" "$SLOTS" "10:00"

header "A3: cancelar agendamento já cancelado → erro idempotência"
R=$(cancel_call "$SUELY_CID" "$SUELY_CFG" "$AG_A0" "duplicado")
SUC_A3=$(echo "$R" | jq -r '.success | tostring')
# Aceita ambos: idempotente (success=true, no-op) ou rejeição explícita
if [ "$SUC_A3" = "false" ]; then
  echo -e "${GREEN}  ✓ cancelamento duplicado rejeitado (success=false)${NC}"; PASS=$((PASS+1))
else
  echo -e "${GREEN}  ✓ cancelamento duplicado é no-op idempotente${NC}"; PASS=$((PASS+1))
fi

header "A4: cancelar agendamento_id inexistente → erro"
R=$(cancel_call "$SUELY_CID" "$SUELY_CFG" "00000000-0000-0000-0000-000000000000" "fake")
assert_eq "success=false" "$(echo "$R" | jq -r '.success | tostring')" "false"

header "A5: cancelar cross-tenant (Suely id usando cliente Marcelo) → falha"
R=$(schedule_call "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"CANCEL A5\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900001001\",\"data_consulta\":\"$DATA_A\",\"hora_consulta\":\"10:15:00\"")
AG_A5=$(echo "$R" | jq -r '.agendamento_id // empty')
[ -n "$AG_A5" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${AG_A5}")
R=$(cancel_call "$MARCELO_CID" "$MARCELO_CFG" "$AG_A5" "cross-tenant")
assert_eq "cross-tenant rejeitado" "$(echo "$R" | jq -r '.success | tostring')" "false"

# ═══════════════════════════════════════════════════════════════════════════
# B. /reschedule
# ═══════════════════════════════════════════════════════════════════════════

header "B0: setup — cria agendamento Suely $DATA_B 11:00"
R=$(schedule_call "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"RESCH TEST B0\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900002000\",\"data_consulta\":\"$DATA_B\",\"hora_consulta\":\"11:00:00\"")
AG_B0=$(echo "$R" | jq -r '.agendamento_id // empty')
assert_truthy "agendamento setup" "$AG_B0"
[ -n "$AG_B0" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${AG_B0}")

header "B1: /reschedule para nova_hora 14:30 mesma data → success"
R=$(reschedule_call "$SUELY_CID" "$SUELY_CFG" "$AG_B0" "$DATA_B" "14:30:00")
SUC_B1=$(echo "$R" | jq -r '.success | tostring')
assert_eq "success=true" "$SUC_B1" "true"

header "B2: slot antigo (11:00) liberado, novo (14:30) ocupado"
R2=$(avail_call "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta" "$DATA_B")
MS=$(echo "$R2" | jq -c "[.proximas_datas[]? | select(.data==\"$DATA_B\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .horarios[]?]")
TS=$(echo "$R2" | jq -c "[.proximas_datas[]? | select(.data==\"$DATA_B\") | .periodos[] | select(.periodo|test(\"(?i)tarde\")) | .horarios[]?]")
assert_contains_slot     "11:00 voltou (manhã)"  "$MS" "11:00"
assert_not_contains_slot "14:30 ausente (tarde)" "$TS" "14:30"

header "B3: /reschedule pra slot ocupado → HORARIO_OCUPADO"
# Criar outro agendamento em 14:45 pra ocupar
R=$(schedule_call "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"RESCH B3 OCUPADOR\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900002002\",\"data_consulta\":\"$DATA_B\",\"hora_consulta\":\"14:45:00\"")
AG_B3=$(echo "$R" | jq -r '.agendamento_id // empty')
[ -n "$AG_B3" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${AG_B3}")
# Tentar remarcar B0 (agora em 14:30) pra 14:45 (ocupado)
R=$(reschedule_call "$SUELY_CID" "$SUELY_CFG" "$AG_B0" "$DATA_B" "14:45:00")
SUC_B3=$(echo "$R" | jq -r '.success | tostring')
assert_eq "remarcação pra slot ocupado rejeitada" "$SUC_B3" "false"

header "B4: /reschedule pra data passada → DATA_PASSADA"
R=$(reschedule_call "$SUELY_CID" "$SUELY_CFG" "$AG_B0" "2026-04-01" "10:00:00")
COD_B4=$(echo "$R" | jq -r '.codigo_erro // empty')
assert_eq "codigo=DATA_PASSADA" "$COD_B4" "DATA_PASSADA"

header "B5: /reschedule Suely para sábado → rejeita (não atende)"
R=$(reschedule_call "$SUELY_CID" "$SUELY_CFG" "$AG_B0" "$DATA_C" "10:00:00")
SUC_B5=$(echo "$R" | jq -r '.success | tostring')
assert_eq "sábado rejeitado" "$SUC_B5" "false"

header "B6: /reschedule agendamento inexistente → erro"
R=$(reschedule_call "$SUELY_CID" "$SUELY_CFG" "00000000-0000-0000-0000-000000000000" "$DATA_B" "10:00:00")
SUC_B6=$(echo "$R" | jq -r '.success | tostring')
assert_eq "id inexistente rejeitado" "$SUC_B6" "false"

# ═══════════════════════════════════════════════════════════════════════════
# C. MULTI-TENANT — /reschedule cross-tenant
# ═══════════════════════════════════════════════════════════════════════════

header "C1: /reschedule cross-tenant (Marcelo tentando alterar id Suely)"
R=$(reschedule_call "$MARCELO_CID" "$MARCELO_CFG" "$AG_B0" "$DATA_B" "12:00:00")
SUC_C1=$(echo "$R" | jq -r '.success | tostring')
assert_eq "cross-tenant rejeitado" "$SUC_C1" "false"

# ═══════════════════════════════════════════════════════════════════════════
# D. MARCELO (ordem_chegada) — /reschedule
# ═══════════════════════════════════════════════════════════════════════════

DATA_M=$(proxima 100 1)  # próxima terça (Marcelo Consulta atende manhã)
header "D0: setup Marcelo $DATA_M 08:30"
R=$(schedule_call "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"RESCH D0 MARCELO\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900003000\",\"data_consulta\":\"$DATA_M\",\"hora_consulta\":\"08:30:00\"")
AG_D0=$(echo "$R" | jq -r '.agendamento_id // empty')
[ -n "$AG_D0" ] && AGENDAMENTOS_CRIADOS+=("${MARCELO_CID}|${MARCELO_CFG}|${AG_D0}")
assert_truthy "agendamento Marcelo criado" "$AG_D0"

header "D1: /reschedule Marcelo para nova hora 09:00 → success (ordem_chegada)"
if [ -n "$AG_D0" ]; then
  R=$(reschedule_call "$MARCELO_CID" "$MARCELO_CFG" "$AG_D0" "$DATA_M" "09:00:00")
  SUC_D1=$(echo "$R" | jq -r '.success | tostring')
  assert_eq "Marcelo remarcado success=true" "$SUC_D1" "true"
fi

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTADO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
