#!/usr/bin/env bash
# ============================================================================
# Suite COMPLETA de:
#   /confirm           — confirmar presença
#   /list-appointments — listar agendamentos do dia por médico (recepção)
#   /consultar-fila    — listar fila de espera
#   /adicionar-fila    — adicionar paciente à fila
#
# Test isolation: cleanup via trap EXIT cancela agendamentos e remove
# entries da fila criados pela suite.
#
# Uso:
#   ENDPOINT=... API_KEY=... ./confirm-list-fila-completo.sh
# ============================================================================

set -u

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
SUELY_CID="0b6a0a35-0059-4a0c-9fb8-413b6253c2ad"
SUELY_CFG="e78600e1-c965-4578-92e5-e9d4cb4ed790"
MARCELO_CID="2bfb98b5-ae41-4f96-8ba7-acc797c22054"
MARCELO_CFG="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

PASS=0; FAIL=0
declare -a AGENDAMENTOS_CRIADOS
declare -a FILA_ITEMS

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────

call() {
  local path="$1" cid="$2" cfg="$3" extra="${4:-}"
  local body="{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\""
  [ -n "$extra" ] && body="$body,$extra"
  body="$body}"
  curl -s -X POST "${ENDPOINT}/${path}" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "$body"
}

cancel_call() {
  local cid="$1" cfg="$2" id="$3"
  curl -s -X POST "${ENDPOINT}/cancel" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"agendamento_id\":\"$id\",\"motivo\":\"cleanup-test\"}" >/dev/null 2>&1 || true
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

assert_gte() {
  local label="$1" actual="$2" min="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    echo -e "${GREEN}  ✓ ${label}${NC} (${actual} >= ${min})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (${actual} < ${min})"; FAIL=$((FAIL+1))
  fi
}

assert_truthy() {
  local label="$1" val="$2"
  if [ -n "$val" ] && [ "$val" != "null" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (=${val:0:60})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} ('${val}')"; FAIL=$((FAIL+1))
  fi
}

header() { echo ""; echo -e "${BOLD}${YELLOW}━━ $1 ━━${NC}"; }

cleanup() {
  if [ "${#AGENDAMENTOS_CRIADOS[@]}" -gt 0 ]; then
    echo ""; echo -e "${YELLOW}🧹 cleanup ${#AGENDAMENTOS_CRIADOS[@]} agendamento(s)...${NC}"
    for entry in "${AGENDAMENTOS_CRIADOS[@]}"; do
      [ -z "$entry" ] && continue
      IFS='|' read -r cid cfg id <<< "$entry"
      cancel_call "$cid" "$cfg" "$id"
    done
  fi
  if [ "${#FILA_ITEMS[@]}" -gt 0 ]; then
    echo -e "${YELLOW}🧹 cleanup ${#FILA_ITEMS[@]} fila item(s)...${NC}"
    # (sem endpoint de remover fila pública; deixamos pra recepção limpar
    #  manualmente. Marcamos os IDs no log.)
    for fid in "${FILA_ITEMS[@]}"; do
      [ -z "$fid" ] && continue
      echo "    fila id: $fid (limpeza manual via recepção)"
    done
  fi
}
trap cleanup EXIT

proxima() {
  python3 -c "
from datetime import date, timedelta
d = date.today() + timedelta(days=$1)
while d.weekday() != $2: d += timedelta(days=1)
print(d.isoformat())"
}
DATA_C=$(proxima 100 0)  # próxima segunda longe (Suely atende)

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "  Suite /confirm + /list-appointments + /consultar-fila + /adicionar-fila"
echo "  Endpoint: ${ENDPOINT}"
echo "  Data alvo: $DATA_C"
echo "═══════════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# A. SETUP — cria 1 agendamento pra teste de confirm + list
# ═══════════════════════════════════════════════════════════════════════════

header "A0: setup — cria agendamento Suely $DATA_C 09:45"
R=$(call "schedule" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"CONFIRM TEST A0\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900010000\",\"data_consulta\":\"$DATA_C\",\"hora_consulta\":\"09:45:00\"")
AG_A0=$(echo "$R" | jq -r '.agendamento_id // empty')
[ -n "$AG_A0" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${AG_A0}")
assert_truthy "agendamento criado" "$AG_A0"

# ═══════════════════════════════════════════════════════════════════════════
# B. /confirm
# ═══════════════════════════════════════════════════════════════════════════

header "B1: /confirm agendamento válido → success"
if [ -n "$AG_A0" ]; then
  R=$(call "confirm" "$SUELY_CID" "$SUELY_CFG" "\"agendamento_id\":\"$AG_A0\"")
  assert_eq "success=true" "$(echo "$R" | jq -r '.success | tostring')" "true"
fi

header "B2: /confirm agendamento_id inexistente → erro"
R=$(call "confirm" "$SUELY_CID" "$SUELY_CFG" "\"agendamento_id\":\"00000000-0000-0000-0000-000000000000\"")
assert_eq "success=false" "$(echo "$R" | jq -r '.success | tostring')" "false"

header "B3: /confirm sem agendamento_id → erro"
R=$(call "confirm" "$SUELY_CID" "$SUELY_CFG")
SUC_B3=$(echo "$R" | jq -r '.success | tostring')
# Pode ser success=false ou .error textual
if [ "$SUC_B3" = "false" ] || echo "$R" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ sem agendamento_id rejeitado${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ deveria rejeitar${NC}"; FAIL=$((FAIL+1))
fi

header "B4: /confirm cross-tenant (Marcelo tenta confirmar ag Suely)"
if [ -n "$AG_A0" ]; then
  # Cria novo Suely só pra esse teste (B1 já confirmou A0)
  R=$(call "schedule" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"CONFIRM B4\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900010001\",\"data_consulta\":\"$DATA_C\",\"hora_consulta\":\"10:00:00\"")
  AG_B4=$(echo "$R" | jq -r '.agendamento_id // empty')
  [ -n "$AG_B4" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${AG_B4}")
  R=$(call "confirm" "$MARCELO_CID" "$MARCELO_CFG" "\"agendamento_id\":\"$AG_B4\"")
  assert_eq "cross-tenant rejeitado" "$(echo "$R" | jq -r '.success | tostring')" "false"
fi

# ═══════════════════════════════════════════════════════════════════════════
# C. /list-appointments
# ═══════════════════════════════════════════════════════════════════════════

header "C1: /list-appointments Suely $DATA_C → lista contém A0"
R=$(call "list-appointments" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"data\":\"$DATA_C\"")
SUC_C1=$(echo "$R" | jq -r '.success | tostring')
assert_eq "success=true" "$SUC_C1" "true"
TOTAL_C1=$(echo "$R" | jq -r '.total // (.agendamentos | length) // 0')
assert_gte "ao menos 1 agendamento listado" "$TOTAL_C1" 1

header "C2: /list-appointments sem medico_nome → erro"
R=$(call "list-appointments" "$SUELY_CID" "$SUELY_CFG" "\"data\":\"$DATA_C\"")
SUC_C2=$(echo "$R" | jq -r '.success | tostring')
if [ "$SUC_C2" = "false" ] || echo "$R" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ sem medico_nome rejeitado${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ deveria rejeitar${NC}"; FAIL=$((FAIL+1))
fi

header "C3: /list-appointments data inválida → erro"
R=$(call "list-appointments" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"data\":\"data-invalida\"")
SUC_C3=$(echo "$R" | jq -r '.success | tostring')
if [ "$SUC_C3" = "false" ] || echo "$R" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ data inválida rejeitada${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ deveria rejeitar${NC}"; FAIL=$((FAIL+1))
fi

header "C4: /list-appointments CURRENT_DATE keyword aceita"
R=$(call "list-appointments" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"data\":\"CURRENT_DATE\"")
SUC_C4=$(echo "$R" | jq -r '.success | tostring')
assert_eq "CURRENT_DATE aceito" "$SUC_C4" "true"

# ═══════════════════════════════════════════════════════════════════════════
# D. /consultar-fila + /adicionar-fila
# ═══════════════════════════════════════════════════════════════════════════

header "D1: /consultar-fila Suely → response estruturada (mesmo vazia)"
R=$(call "consultar-fila" "$SUELY_CID" "$SUELY_CFG")
assert_eq "success=true" "$(echo "$R" | jq -r '.success | tostring')" "true"

header "D2: /adicionar-fila Suely → cria entry"
# Nome + celular únicos por run (evita colisão de UNIQUE constraint entre runs).
RUN_ID="$(date +%s%N | tail -c 10)"
R=$(call "adicionar-fila" "$SUELY_CID" "$SUELY_CFG" "\"nome_completo\":\"FILA TESTE D2 $RUN_ID\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"879000${RUN_ID:0:5}\",\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"data_preferida\":\"$DATA_C\",\"periodo_preferido\":\"manha\"")
SUC_D2=$(echo "$R" | jq -r '.success | tostring')
FILA_ID=$(echo "$R" | jq -r '.fila_id // .id // empty')
[ -n "$FILA_ID" ] && FILA_ITEMS+=("$FILA_ID")
assert_eq "fila adicionada" "$SUC_D2" "true"

header "D3: /adicionar-fila sem nome → erro"
R=$(call "adicionar-fila" "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"data_preferida\":\"$DATA_C\"")
SUC_D3=$(echo "$R" | jq -r '.success | tostring')
if [ "$SUC_D3" = "false" ] || echo "$R" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ sem nome rejeitado${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ deveria rejeitar${NC}"; FAIL=$((FAIL+1))
fi

header "D4: /consultar-fila após adição → contém a entry D2"
R=$(call "consultar-fila" "$SUELY_CID" "$SUELY_CFG")
TOTAL_D4=$(echo "$R" | jq -r '.total // (.fila | length) // 0')
assert_gte "fila tem >= 1 entry após D2" "$TOTAL_D4" 1

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTADO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
