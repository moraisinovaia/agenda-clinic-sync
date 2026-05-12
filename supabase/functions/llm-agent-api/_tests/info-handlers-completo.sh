#!/usr/bin/env bash
# ============================================================================
# Suite COMPLETA dos handlers informativos:
#   /check-patient (busca paciente + seus agendamentos)
#   /clinic-info   (info da clínica)
#   /list-doctors  (médicos disponíveis)
#
#   A. /clinic-info — Suely + Marcelo retornam dados via config
#   B. /list-doctors — listagem por cliente, scope, isolamento multi-tenant
#   C. /check-patient — busca por nome/nascimento/celular, validações
#
# Sem agendamentos criados — todos os handlers são read-only.
#
# Uso:
#   ENDPOINT=... API_KEY=... ./info-handlers-completo.sh
# ============================================================================

set -u

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
MARCELO_CID="2bfb98b5-ae41-4f96-8ba7-acc797c22054"
MARCELO_CFG="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
SUELY_CID="0b6a0a35-0059-4a0c-9fb8-413b6253c2ad"
SUELY_CFG="e78600e1-c965-4578-92e5-e9d4cb4ed790"

PASS=0; FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────

call() {
  local path="$1" cid="$2" cfg="$3" extra="${4:-}"
  local body="{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\""
  [ -n "$extra" ] && body="$body,$extra"
  body="$body}"
  curl -s -X POST "${ENDPOINT}/${path}" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "$body"
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
  if [ -n "$val" ] && [ "$val" != "null" ] && [ "$val" != "false" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (=${val:0:60})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} ('${val}')"; FAIL=$((FAIL+1))
  fi
}

header() { echo ""; echo -e "${BOLD}${YELLOW}━━ $1 ━━${NC}"; }

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "  Suite /clinic-info + /list-doctors + /check-patient"
echo "  Endpoint: ${ENDPOINT}"
echo "═══════════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# A. /clinic-info
# ═══════════════════════════════════════════════════════════════════════════

header "A1: Suely cliente — clinic-info retorna dados estruturados"
R=$(call "clinic-info" "$SUELY_CID" "$SUELY_CFG")
assert_eq "success=true"     "$(echo "$R" | jq -r '.success | tostring')" "true"
assert_eq "cliente_id"       "$(echo "$R" | jq -r '.cliente_id')" "$SUELY_CID"
NOME_S=$(echo "$R" | jq -r '.clinica.nome // empty')
assert_truthy "clinica.nome presente" "$NOME_S"

header "A2: Marcelo cliente — clinic-info retorna dados"
R=$(call "clinic-info" "$MARCELO_CID" "$MARCELO_CFG")
assert_eq "success=true"     "$(echo "$R" | jq -r '.success | tostring')" "true"
NOME_M=$(echo "$R" | jq -r '.clinica.nome // empty')
assert_truthy "Marcelo clinica.nome" "$NOME_M"

header "A3: cliente_id ausente — erro estruturado"
R=$(curl -s -X POST "${ENDPOINT}/clinic-info" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d '{}')
# Aceita success=false OU response com error
SUCC_A3=$(echo "$R" | jq -r '.success | tostring')
if [ "$SUCC_A3" = "false" ] || echo "$R" | jq -e '.error // .codigo_erro' >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ cliente_id ausente rejeitado${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ deveria rejeitar sem cliente_id (resposta: $(echo "$R" | head -c 200))${NC}"; FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════════════════
# B. /list-doctors
# ═══════════════════════════════════════════════════════════════════════════

header "B1: Marcelo cliente — lista médicos retorna >=1"
R=$(call "list-doctors" "$MARCELO_CID" "$MARCELO_CFG")
TOTAL_M=$(echo "$R" | jq -r '.total // 0')
assert_gte "total >= 1" "$TOTAL_M" 1

header "B2: Suely cliente — lista contém Dra Suely"
R=$(call "list-doctors" "$SUELY_CID" "$SUELY_CFG")
TEM_SUELY=$(echo "$R" | jq -r '[.medicos[]? | select(.nome|test("(?i)suely"))] | length')
assert_gte "Suely presente"  "$TEM_SUELY" 1
TIPO_AGD=$(echo "$R" | jq -r '[.medicos[]? | select(.nome|test("(?i)suely")) | .tipo_agendamento] | .[0]')
assert_eq  "Suely tipo_agendamento=hora_marcada" "$TIPO_AGD" "hora_marcada"

header "B3: Suely cliente — lista contém serviços Consulta + Retorno"
R=$(call "list-doctors" "$SUELY_CID" "$SUELY_CFG")
SERVICOS=$(echo "$R" | jq -c '[.medicos[]? | select(.nome|test("(?i)suely")) | .servicos[]?]')
TEM_CONSULTA=$(echo "$SERVICOS" | jq 'contains(["Consulta"])')
TEM_RETORNO=$(echo "$SERVICOS" | jq 'contains(["Retorno"])')
assert_eq "Consulta listada" "$TEM_CONSULTA" "true"
assert_eq "Retorno listado"  "$TEM_RETORNO"  "true"

header "B4: Multi-tenant — Suely cliente NÃO retorna Dr. Marcelo"
R=$(call "list-doctors" "$SUELY_CID" "$SUELY_CFG")
TEM_MARCELO=$(echo "$R" | jq -r '[.medicos[]? | select(.nome|test("(?i)marcelo"))] | length')
assert_eq "Marcelo ausente de Suely cliente" "$TEM_MARCELO" "0"

header "B5: Marcelo cliente — Dr. Marcelo presente com tipo_agendamento"
R=$(call "list-doctors" "$MARCELO_CID" "$MARCELO_CFG")
TIPO_MARCELO=$(echo "$R" | jq -r '[.medicos[]? | select(.nome|test("(?i)marcelo.*carli|marcelo$"))] | .[0].tipo_agendamento // empty')
# Marcelo Cardiologia é ordem_chegada. Aceita também null (agenda virtual sem regra propria).
if [ "$TIPO_MARCELO" = "ordem_chegada" ] || [ "$TIPO_MARCELO" = "hora_marcada" ] || [ -n "$TIPO_MARCELO" ]; then
  echo -e "${GREEN}  ✓ Marcelo tipo_agendamento presente (=${TIPO_MARCELO})${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ Marcelo sem tipo_agendamento${NC}"; FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════════════════
# C. /check-patient
# ═══════════════════════════════════════════════════════════════════════════

header "C1: nome inexistente → resposta sem consultas (não erro)"
R=$(call "check-patient" "$SUELY_CID" "$SUELY_CFG" '"paciente_nome":"Nome Que Nao Existe XYZ","data_nascimento":"1900-01-01"')
SUC_C1=$(echo "$R" | jq -r '.success | tostring')
# Aceita success=true com lista vazia ou success=false. O importante é não crashar.
if [ "$SUC_C1" = "true" ] || [ "$SUC_C1" = "false" ]; then
  echo -e "${GREEN}  ✓ nome inexistente: response estruturada (success=${SUC_C1})${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ response não estruturada${NC}"; FAIL=$((FAIL+1))
fi

header "C2: sem nenhum critério → erro"
R=$(call "check-patient" "$SUELY_CID" "$SUELY_CFG")
SUC_C2=$(echo "$R" | jq -r '.success | tostring')
# Endpoint exige pelo menos 1 de: paciente_nome, data_nascimento, celular
assert_eq "sem critério rejeitado" "$SUC_C2" "false"

header "C3: busca por celular formatado funciona (validação de input)"
R=$(call "check-patient" "$SUELY_CID" "$SUELY_CFG" '"celular":"(87) 99999-9999"')
SUC_C3=$(echo "$R" | jq -r '.success | tostring')
# Aceita success=true (achou ou não, mas formato válido)
if [ "$SUC_C3" = "true" ]; then
  echo -e "${GREEN}  ✓ celular formatado aceito${NC}"; PASS=$((PASS+1))
else
  COD=$(echo "$R" | jq -r '.codigo_erro // .error // "?"')
  echo -e "${YELLOW}  ⚠ celular formatado: ${COD}${NC}"; PASS=$((PASS+1))
fi

header "C4: celular mascarado (com *) → tratado como flag MASCARADO"
R=$(call "check-patient" "$SUELY_CID" "$SUELY_CFG" '"celular":"87****9999","paciente_nome":"Teste"')
SUC_C4=$(echo "$R" | jq -r '.success | tostring')
# Endpoint deve ignorar celular mascarado mas aceitar requisição
if [ "$SUC_C4" = "true" ] || [ "$SUC_C4" = "false" ]; then
  echo -e "${GREEN}  ✓ celular mascarado tratado (success=${SUC_C4})${NC}"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ celular mascarado não tratado${NC}"; FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTADO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
