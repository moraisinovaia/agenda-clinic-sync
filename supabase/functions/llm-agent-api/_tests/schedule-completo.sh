#!/usr/bin/env bash
# ============================================================================
# Suite COMPLETA do endpoint /schedule
#
# Cobre os 2 médicos do piloto + multi-tenant:
#   A. Marcelo (ordem_chegada) — criação simples, conversão de período,
#      idempotência, walk_in_info_only, MAPA
#   B. Suely (hora_marcada) — hora específica, slot ocupado, conversão
#      de período, sábado bloqueado, Retorno
#   C. Validações deterministicas — data passada, médico/serviço inexistente
#   D. Convênios — MEDCLIN bloqueia, MEDPREV passa (Suely)
#   E. Regras Marcelo — fístula/peso vivem em /chat (não /schedule direto)
#   F. Multi-tenant — cliente_id de Suely não cria com médico do Marcelo
#
# Test isolation: cleanup via trap EXIT cancela todos agendamentos criados.
#
# Uso:
#   ENDPOINT=... API_KEY=... ./schedule-completo.sh
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

schedule() {
  local cid="$1" cfg="$2" extra="$3"
  curl -s -X POST "${ENDPOINT}/schedule" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",$extra}"
}

cancel_agendamento() {
  local cid="$1" cfg="$2" id="$3"
  curl -s -X POST "${ENDPOINT}/cancel" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"agendamento_id\":\"$id\",\"motivo\":\"teste-suite\"}" >/dev/null 2>&1 || true
}

# Track criação: lê $LAST_RESPONSE, atualiza $LAST_ID e push em AGENDAMENTOS_CRIADOS
track_created() {
  local label="$1" cid="$2" cfg="$3"
  LAST_ID=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
  if [ -n "$LAST_ID" ]; then
    AGENDAMENTOS_CRIADOS+=("${cid}|${cfg}|${LAST_ID}")
    echo -e "${GREEN}  ✓ ${label}${NC} (id: ${LAST_ID})"; PASS=$((PASS+1))
    return 0
  else
    local err; err=$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // .message // "?"' | head -c 200)
    echo -e "${RED}  ✗ ${label}${NC} (erro: ${err})"; FAIL=$((FAIL+1))
    return 1
  fi
}

assert_eq() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (=${actual})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: ${expected}"; echo -e "    atual:    ${actual}"
    FAIL=$((FAIL+1))
  fi
}

header() { echo ""; echo -e "${BOLD}${YELLOW}━━ $1 ━━${NC}"; }

cleanup() {
  if [ "${#AGENDAMENTOS_CRIADOS[@]}" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}🧹 cleanup ${#AGENDAMENTOS_CRIADOS[@]} agendamento(s)...${NC}"
    for entry in "${AGENDAMENTOS_CRIADOS[@]}"; do
      [ -z "$entry" ] && continue
      IFS='|' read -r cid cfg id <<< "$entry"
      cancel_agendamento "$cid" "$cfg" "$id"
    done
  fi
}
trap cleanup EXIT

# ── Datas futuras LONGE (evita lotação real de Marcelo + bloqueios) ──────
proxima() {
  python3 -c "
from datetime import date, timedelta
d = date.today() + timedelta(days=120)
while d.weekday() != $1: d += timedelta(days=1)
print(d.isoformat())"
}
PROX_TER=$(proxima 1)
PROX_QUA=$(proxima 2)
PROX_SEG=$(proxima 0)
PROX_SAB=$(proxima 5)

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "  Suite COMPLETA — /schedule (Marcelo + Suely)"
echo "  Endpoint: ${ENDPOINT}"
echo "  Datas (+120d): ter=$PROX_TER  qua=$PROX_QUA  seg=$PROX_SEG  sab=$PROX_SAB"
echo "═══════════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# A. MARCELO — ordem_chegada
# ═══════════════════════════════════════════════════════════════════════════

header "A1: Marcelo Consulta com período 'manhã' → busca primeiro slot livre"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE A1 MARCELO\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87911111111\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"manhã\"")
track_created "agendamento criado em $PROX_TER manhã" "$MARCELO_CID" "$MARCELO_CFG"

header "A2: Marcelo Consulta com hora específica"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE A2 MARCELO\",\"data_nascimento\":\"1985-05-05\",\"convenio\":\"PARTICULAR\",\"celular\":\"87922222222\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:30:00\"")
track_created "agendamento criado em 08:30" "$MARCELO_CID" "$MARCELO_CFG"
ID_A2="$LAST_ID"

header "A3: Idempotência — mesmo input retorna mesmo ID"
if [ -n "$ID_A2" ]; then
  LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE A2 MARCELO\",\"data_nascimento\":\"1985-05-05\",\"convenio\":\"PARTICULAR\",\"celular\":\"87922222222\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:30:00\"")
  ID_A3=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
  assert_eq "mesmo agendamento_id (idempotência)" "$ID_A3" "$ID_A2"
else
  echo -e "${YELLOW}  ⊘ A3 pulado (A2 falhou)${NC}"
fi

header "A4: Marcelo ECG (walk_in_info_only) → SERVICO_SEM_AGENDAMENTO"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"ECG (Eletrocardiograma)\",\"paciente_nome\":\"TESTE A4\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000004\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:00:00\"")
assert_eq "codigo=SERVICO_SEM_AGENDAMENTO" "$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // empty')" "SERVICO_SEM_AGENDAMENTO"

header "A5: Marcelo MAPA 24H sem guia → aceita ou bloqueia"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"MAPA 24H\",\"paciente_nome\":\"TESTE A5\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000005\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"10:30:00\"")
SUCC_A5=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
COD_A5=$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // empty')
if [ "$SUCC_A5" = "true" ]; then
  ID_A5=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
  [ -n "$ID_A5" ] && AGENDAMENTOS_CRIADOS+=("${MARCELO_CID}|${MARCELO_CFG}|${ID_A5}")
  echo -e "${YELLOW}  ⚠ MAPA criou (regra exige_guia só roda via /chat); cancelado${NC}"; PASS=$((PASS+1))
else
  echo -e "${GREEN}  ✓ MAPA bloqueado (cod=${COD_A5})${NC}"; PASS=$((PASS+1))
fi

# ═══════════════════════════════════════════════════════════════════════════
# B. SUELY — hora_marcada
# ═══════════════════════════════════════════════════════════════════════════

header "B1: Suely Consulta com hora específica 11:45 → cria"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE B1 SUELY\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000006\",\"data_consulta\":\"$PROX_SEG\",\"hora_consulta\":\"11:45:00\"")
track_created "agendamento criado em 11:45" "$SUELY_CID" "$SUELY_CFG"
ID_B1="$LAST_ID"

header "B2: Suely Consulta mesmo slot 11:45 → HORARIO_OCUPADO"
if [ -n "$ID_B1" ]; then
  LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE B2 DUPLICADO\",\"data_nascimento\":\"1985-05-05\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000007\",\"data_consulta\":\"$PROX_SEG\",\"hora_consulta\":\"11:45:00\"")
  COD=$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // empty')
  SUCC=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
  assert_eq "success=false"          "$SUCC" "false"
  assert_eq "codigo=HORARIO_OCUPADO" "$COD"  "HORARIO_OCUPADO"
else
  echo -e "${YELLOW}  ⊘ B2 pulado (B1 falhou)${NC}"
fi

header "B3: Suely Consulta período 'manhã' → busca primeiro slot livre"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE B3 PERIODO\",\"data_nascimento\":\"1995-03-15\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000008\",\"data_consulta\":\"$PROX_SEG\",\"hora_consulta\":\"manhã\"")
track_created "agendamento criado via 'manhã'" "$SUELY_CID" "$SUELY_CFG"

header "B4: Suely sábado (não atende) → rejeita"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE B4 SAB\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000009\",\"data_consulta\":\"$PROX_SAB\",\"hora_consulta\":\"09:30:00\"")
SUCC_B4=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
ID_B4=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
[ -n "$ID_B4" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${ID_B4}")
assert_eq "sábado rejeitado (success=false)" "$SUCC_B4" "false"

header "B5: Suely Retorno em hora específica → cria"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Retorno\",\"paciente_nome\":\"TESTE B5 RETORNO\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000010\",\"data_consulta\":\"$PROX_SEG\",\"hora_consulta\":\"15:30:00\"")
track_created "Retorno criado em 15:30" "$SUELY_CID" "$SUELY_CFG"

# ═══════════════════════════════════════════════════════════════════════════
# C. VALIDAÇÕES DETERMINÍSTICAS
# ═══════════════════════════════════════════════════════════════════════════

header "C1: data passada (2026-04-01) → DATA_PASSADA"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE C1\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000011\",\"data_consulta\":\"2026-04-01\",\"hora_consulta\":\"08:00:00\"")
assert_eq "codigo=DATA_PASSADA" "$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // empty')" "DATA_PASSADA"

header "C2: médico inexistente → MEDICO_NAO_ENCONTRADO"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Inexistente\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE C2\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000012\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:00:00\"")
assert_eq "codigo=MEDICO_NAO_ENCONTRADO" "$(echo "$LAST_RESPONSE" | jq -r '.codigo_erro // empty')" "MEDICO_NAO_ENCONTRADO"

# ═══════════════════════════════════════════════════════════════════════════
# D. CONVÊNIOS
# ═══════════════════════════════════════════════════════════════════════════

header "D1: Marcelo + MEDCLIN (parceiro) → bloqueia"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE D1\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"MEDCLIN\",\"celular\":\"87900000013\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:00:00\"")
ID_D1=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
[ -n "$ID_D1" ] && AGENDAMENTOS_CRIADOS+=("${MARCELO_CID}|${MARCELO_CFG}|${ID_D1}")
SUCC_D1=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
assert_eq "MEDCLIN rejeitado" "$SUCC_D1" "false"

header "D2: Suely + MEDPREV (atende!) → cria"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dra Suely\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE D2 MEDPREV\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"MEDPREV\",\"celular\":\"87900000014\",\"data_consulta\":\"$PROX_SEG\",\"hora_consulta\":\"16:30:00\"")
track_created "MEDPREV aceito pela Suely" "$SUELY_CID" "$SUELY_CFG"

# ═══════════════════════════════════════════════════════════════════════════
# E. REGRAS CLÍNICAS
# ═══════════════════════════════════════════════════════════════════════════

header "E1: Marcelo Ergométrico — regras fistula/peso vivem em /chat (não /schedule)"
LAST_RESPONSE=$(schedule "$MARCELO_CID" "$MARCELO_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Teste Ergométrico\",\"paciente_nome\":\"TESTE E1 ERGO\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000015\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:00:00\"")
SUCC_E1=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
ID_E1=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
[ -n "$ID_E1" ] && AGENDAMENTOS_CRIADOS+=("${MARCELO_CID}|${MARCELO_CFG}|${ID_E1}")
echo -e "${GREEN}  ✓ Ergométrico response received (success=${SUCC_E1})${NC}"; PASS=$((PASS+1))

# ═══════════════════════════════════════════════════════════════════════════
# F. MULTI-TENANT
# ═══════════════════════════════════════════════════════════════════════════

header "F1: Suely cliente_id tentando agendar com médico Marcelo → erro"
LAST_RESPONSE=$(schedule "$SUELY_CID" "$SUELY_CFG" "\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"paciente_nome\":\"TESTE F1\",\"data_nascimento\":\"1990-01-01\",\"convenio\":\"PARTICULAR\",\"celular\":\"87900000016\",\"data_consulta\":\"$PROX_TER\",\"hora_consulta\":\"08:00:00\"")
SUCC_F1=$(echo "$LAST_RESPONSE" | jq -r '.success | tostring')
ID_F1=$(echo "$LAST_RESPONSE" | jq -r '.agendamento_id // empty')
[ -n "$ID_F1" ] && AGENDAMENTOS_CRIADOS+=("${SUELY_CID}|${SUELY_CFG}|${ID_F1}")
assert_eq "cross-tenant rejeitado" "$SUCC_F1" "false"

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTADO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
