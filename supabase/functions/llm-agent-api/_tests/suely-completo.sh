#!/usr/bin/env bash
# ============================================================================
# Suite COMPLETA da Pro Oftalmo (Dra. Maria Suely Amorim Mendes)
#
# Cobre o pipeline ponta-a-ponta do agente conversacional pra hora marcada:
#   A. Estrutura básica (/availability) — tipo_atendimento, slots, intervalos
#   B. Granularidade — slot ocupado some, vagas reais
#   C. Bloqueios de agenda (parcial e total)
#   D. Validação de data (passada, dia não-atendido, fim de semana)
#   E. Filtros via mensagem (manhã/tarde)
#   F. Serviços (Consulta e Retorno)
#   G. Convênios (parceiros bloqueados, MEDPREV liberado, BRADESCO SAÚDE)
#   H. Multi-tenant (não vaza com Marcelo)
#   I. Fluxo conversacional (/chat com histórico)
#   J. Ciclo end-to-end (/schedule + /cancel) com slot voltando
#
# Test isolation: cada cenário cria e LIMPA seus próprios dados.
# Usa endpoint público + x-api-key (não precisa de service_role).
#
# Uso:
#   ENDPOINT=https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api \
#   API_KEY=<N8N_API_KEY> \
#   ./suely-completo.sh
# ============================================================================

set -u

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
SUELY_CID="0b6a0a35-0059-4a0c-9fb8-413b6253c2ad"
SUELY_CFG="e78600e1-c965-4578-92e5-e9d4cb4ed790"
SUELY_MEDICO_ID="a38f801c-54fa-4676-b677-7593f05a527e"
MARCELO_CID="2bfb98b5-ae41-4f96-8ba7-acc797c22054"
MARCELO_CFG="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

PASS=0; FAIL=0; CRIADOS=()

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

# ── Helpers HTTP ──────────────────────────────────────────────────────────

avail() {
  local cid="$1" cfg="$2" extra="$3"
  curl -s -X POST "${ENDPOINT}/availability" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"medico_nome\":\"Dra Suely\",$extra}"
}

chat_turn() {
  local mensagem="$1" estado="${2:-inicio}"
  local dados="${3:-}"; local historico="${4:-}"
  [ -z "$dados" ] && dados='{}'
  [ -z "$historico" ] && historico='[]'
  # Valida JSON antes (evita --argjson silently quebrando)
  echo "$dados" | jq empty 2>/dev/null || dados='{}'
  echo "$historico" | jq empty 2>/dev/null || historico='[]'
  curl -s -X POST "${ENDPOINT}/chat" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg cid "$SUELY_CID" --arg cfg "$SUELY_CFG" \
      --arg msg "$mensagem" --arg est "$estado" \
      --argjson dados "$dados" --argjson hist "$historico" \
      '{cliente_id:$cid, config_id:$cfg, mensagem:$msg, estado_atual:$est,
        dados_coletados:$dados, historico_contexto:$hist}')"
}

schedule_create() {
  local data="$1" hora="$2" paciente="$3"
  curl -s -X POST "${ENDPOINT}/schedule" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg cid "$SUELY_CID" --arg cfg "$SUELY_CFG" \
      --arg paciente "$paciente" --arg data "$data" --arg hora "$hora" \
      '{cliente_id:$cid, config_id:$cfg,
        medico_nome:"Dra Suely", atendimento_nome:"Consulta",
        paciente_nome:$paciente, data_nascimento:"1990-01-01",
        convenio:"PARTICULAR", celular:"87999999999",
        data_consulta:$data, hora_consulta:$hora}')"
}

cancel_agendamento() {
  local agendamento_id="$1"
  curl -s -X POST "${ENDPOINT}/cancel" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg cid "$SUELY_CID" --arg cfg "$SUELY_CFG" --arg id "$agendamento_id" \
      '{cliente_id:$cid, config_id:$cfg, agendamento_id:$id, motivo:"teste"}')"
}

# ── Asserts ───────────────────────────────────────────────────────────────

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

assert_gte() {
  local label="$1" actual="$2" min="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    echo -e "${GREEN}  ✓ ${label}${NC} (${actual} >= ${min})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (${actual} < ${min})"; FAIL=$((FAIL+1))
  fi
}

assert_contains_slot() {
  local label="$1" array="$2" slot="$3"
  if echo "$array" | jq -e --arg s "$slot" 'index($s) != null' >/dev/null 2>&1; then
    echo -e "${GREEN}  ✓ ${label}${NC} (contém ${slot})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (slot ${slot} ausente: $array)"; FAIL=$((FAIL+1))
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
  if [ "${#CRIADOS[@]}" -gt 0 ]; then
    echo ""; echo -e "${YELLOW}🧹 cleanup ${#CRIADOS[@]} agendamento(s)...${NC}"
    for id in "${CRIADOS[@]}"; do
      cancel_agendamento "$id" >/dev/null 2>&1 || true
    done
  fi
}
trap cleanup EXIT

# ── Helper: próxima segunda-feira distante (sem agendamentos reais) ──────
PROXIMA_SEG=$(date -d "+30 days $(date -d 'next Monday' +%u 2>/dev/null)" +%Y-%m-%d 2>/dev/null || \
              python3 -c "
from datetime import date, timedelta
d = date.today() + timedelta(days=30)
while d.weekday() != 0: d += timedelta(days=1)
print(d.isoformat())")
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "  Suite COMPLETA — Dra. Maria Suely Amorim Mendes (Pro Oftalmo)"
echo "  Endpoint: ${ENDPOINT}"
echo "  Data alvo (próxima segunda longe): ${PROXIMA_SEG}"
echo "═══════════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# A. ESTRUTURA BÁSICA — /availability
# ═══════════════════════════════════════════════════════════════════════════
header "A1: tipo_atendimento = hora_marcada"
R=$(avail "$SUELY_CID" "$SUELY_CFG" '"atendimento_nome":"Consulta","buscar_proximas":true')
assert_eq "tipo_atendimento" "$(echo "$R" | jq -r .tipo_atendimento)" "hora_marcada"

header "A2: 22 slots distribuídos (12 manhã + 10 tarde) em $PROXIMA_SEG"
R=$(avail "$SUELY_CID" "$SUELY_CFG" "\"atendimento_nome\":\"Consulta\",\"data_consulta\":\"$PROXIMA_SEG\",\"buscar_proximas\":true")
M=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .horarios[]?] | length")
T=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)tarde\")) | .horarios[]?] | length")
assert_eq "slots manhã" "$M" "12"
assert_eq "slots tarde" "$T" "10"

header "A3: limites declarados (12, 10)"
LM=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .limite_total] | .[0]")
LT=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)tarde\")) | .limite_total] | .[0]")
assert_eq "limite_total manhã" "$LM" "12"
assert_eq "limite_total tarde" "$LT" "10"

header "A4: intervalo_minutos = 15"
IM=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[].intervalo_minutos] | .[0]")
assert_eq "intervalo_minutos" "$IM" "15"

header "A5: primeiro e último slot (09:30 / 12:15) e (14:30 / 16:45)"
MS=$(echo "$R" | jq -c "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .horarios[]?]")
TS=$(echo "$R" | jq -c "[.proximas_datas[]? | select(.data==\"$PROXIMA_SEG\") | .periodos[] | select(.periodo|test(\"(?i)tarde\")) | .horarios[]?]")
assert_eq "manhã[0]"   "$(echo "$MS" | jq -r '.[0]')"  "09:30"
assert_eq "manhã[-1]"  "$(echo "$MS" | jq -r '.[-1]')" "12:15"
assert_eq "tarde[0]"   "$(echo "$TS" | jq -r '.[0]')"  "14:30"
assert_eq "tarde[-1]"  "$(echo "$TS" | jq -r '.[-1]')" "16:45"

# ═══════════════════════════════════════════════════════════════════════════
# B. GRANULARIDADE — slot ocupado some, vagas reais
# ═══════════════════════════════════════════════════════════════════════════
header "B1: criar agendamento em 10:15 e validar que slot some"
HORA_OCUPADA="10:15:00"
DATA_TESTE="$PROXIMA_SEG"
RESP=$(schedule_create "$DATA_TESTE" "$HORA_OCUPADA" "TESTE B1 SLOT OCUPADO")
AG_ID=$(echo "$RESP" | jq -r '.agendamento_id // empty')
if [ -z "$AG_ID" ]; then
  echo -e "${RED}  ✗ falhou ao criar agendamento (resposta: $(echo "$RESP" | jq -r '.message // .codigo_erro // "?"' | head -c 200))${NC}"
  FAIL=$((FAIL+1))
else
  CRIADOS+=("$AG_ID")
  echo -e "${GREEN}  ✓ agendamento criado: $AG_ID${NC}"; PASS=$((PASS+1))

  # Validar slot some
  R2=$(avail "$SUELY_CID" "$SUELY_CFG" "\"atendimento_nome\":\"Consulta\",\"data_consulta\":\"$DATA_TESTE\",\"buscar_proximas\":true")
  MS2=$(echo "$R2" | jq -c "[.proximas_datas[]? | select(.data==\"$DATA_TESTE\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .horarios[]?]")
  M2_N=$(echo "$MS2" | jq 'length')
  V2=$(echo "$R2" | jq -r "[.proximas_datas[]? | select(.data==\"$DATA_TESTE\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .vagas_disponiveis] | .[0]")
  assert_not_contains_slot "10:15 removido dos horários" "$MS2" "10:15"
  assert_eq  "slots manhã = 11 (era 12)" "$M2_N" "11"
  assert_eq  "vagas_disponiveis = 11"    "$V2"   "11"
fi

# B2: cancelar e ver slot voltar
header "B2: cancelar agendamento e ver slot 10:15 voltar"
if [ -n "$AG_ID" ]; then
  cancel_agendamento "$AG_ID" >/dev/null 2>&1
  # remove do tracking pra cleanup não tentar de novo
  CRIADOS=("${CRIADOS[@]/$AG_ID}")
  R3=$(avail "$SUELY_CID" "$SUELY_CFG" "\"atendimento_nome\":\"Consulta\",\"data_consulta\":\"$DATA_TESTE\",\"buscar_proximas\":true")
  MS3=$(echo "$R3" | jq -c "[.proximas_datas[]? | select(.data==\"$DATA_TESTE\") | .periodos[] | select(.periodo|test(\"(?i)manh\")) | .horarios[]?]")
  M3_N=$(echo "$MS3" | jq 'length')
  assert_contains_slot "10:15 voltou aos horários" "$MS3" "10:15"
  assert_eq "slots manhã = 12 (baseline restaurado)" "$M3_N" "12"
else
  echo -e "${YELLOW}  ⊘ B2 pulado (B1 não criou)${NC}"
fi

# B3: tentar criar 2 agendamentos no mesmo slot → segundo deve rejeitar
header "B3: agendamento duplicado no mesmo slot deve ser rejeitado"
HORA_DUP="11:30:00"
RESP1=$(schedule_create "$DATA_TESTE" "$HORA_DUP" "TESTE B3 PRIMEIRO")
AG_DUP=$(echo "$RESP1" | jq -r '.agendamento_id // empty')
if [ -n "$AG_DUP" ]; then
  CRIADOS+=("$AG_DUP")
  RESP2=$(schedule_create "$DATA_TESTE" "$HORA_DUP" "TESTE B3 SEGUNDO")
  SUCC2=$(echo "$RESP2" | jq -r '.success | tostring')
  AG_DUP2=$(echo "$RESP2" | jq -r '.agendamento_id // empty')
  [ -n "$AG_DUP2" ] && CRIADOS+=("$AG_DUP2")
  assert_eq "segundo agendamento rejeitado" "$SUCC2" "false"
else
  echo -e "${YELLOW}  ⊘ B3 pulado (primeiro insert falhou)${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# C. VALIDAÇÃO DE DATA
# ═══════════════════════════════════════════════════════════════════════════
header "C1: data passada → DATA_PASSADA"
R=$(avail "$SUELY_CID" "$SUELY_CFG" '"atendimento_nome":"Consulta","data_consulta":"2026-04-01"')
assert_eq "codigo_erro" "$(echo "$R" | jq -r '.codigo_erro // empty')" "DATA_PASSADA"

header "C2: sábado (não atende) — data ausente dos resultados"
# pega próximo sábado
PROX_SAB=$(python3 -c "
from datetime import date, timedelta
d = date.today() + timedelta(days=1)
while d.weekday() != 5: d += timedelta(days=1)
print(d.isoformat())")
R=$(avail "$SUELY_CID" "$SUELY_CFG" "\"atendimento_nome\":\"Consulta\",\"data_consulta\":\"$PROX_SAB\"")
HAS_SAT=$(echo "$R" | jq -r "[.proximas_datas[]? | select(.data==\"$PROX_SAB\")] | length")
assert_eq "sábado $PROX_SAB ausente" "$HAS_SAT" "0"

# ═══════════════════════════════════════════════════════════════════════════
# D. FILTROS POR PERÍODO
# ═══════════════════════════════════════════════════════════════════════════
header "D1: mensagem 'manhã' → só retorna períodos da manhã"
R=$(avail "$SUELY_CID" "$SUELY_CFG" '"atendimento_nome":"Consulta","buscar_proximas":true,"mensagem_original":"quero manhã"')
TEM_TARDE=$(echo "$R" | jq -r '[.proximas_datas[]?.periodos[]?.periodo] | map(test("(?i)tarde")) | any')
assert_eq "nenhum período de tarde" "$TEM_TARDE" "false"

header "D2: mensagem 'tarde' → só retorna períodos da tarde"
R=$(avail "$SUELY_CID" "$SUELY_CFG" '"atendimento_nome":"Consulta","buscar_proximas":true,"mensagem_original":"quero tarde"')
TEM_MANHA=$(echo "$R" | jq -r '[.proximas_datas[]?.periodos[]?.periodo] | map(test("(?i)manh")) | any')
assert_eq "nenhum período de manhã" "$TEM_MANHA" "false"

# ═══════════════════════════════════════════════════════════════════════════
# E. SERVIÇOS — Consulta + Retorno
# ═══════════════════════════════════════════════════════════════════════════
header "E1: Retorno também é hora_marcada com 22 slots"
R=$(avail "$SUELY_CID" "$SUELY_CFG" '"atendimento_nome":"Retorno","buscar_proximas":true')
assert_eq "tipo Retorno" "$(echo "$R" | jq -r .tipo_atendimento)" "hora_marcada"
N_RET=$(echo "$R" | jq -r '[.proximas_datas[0].periodos[].horarios[]?] | length')
assert_eq "Retorno: 22 slots primeiro dia" "$N_RET" "22"

# ═══════════════════════════════════════════════════════════════════════════
# F. CONVÊNIOS
# ═══════════════════════════════════════════════════════════════════════════
header "F1: convênio parceiro (MEDCLIN) bloqueia agendamento"
R=$(chat_turn "tenho MEDCLIN" "inicio" \
  '{"medico_nome":"Dra Suely","servico":"Consulta"}' '[]')
assert_eq "audit=CONVENIO_PARCEIRO" "$(echo "$R" | jq -r '._debug.audit_reason')" "CONVENIO_PARCEIRO"

header "F2: MEDPREV NÃO bloqueia (Pro Oftalmo atende)"
R=$(chat_turn "tenho MEDPREV" "inicio" \
  '{"medico_nome":"Dra Suely","servico":"Consulta"}' '[]')
A=$(echo "$R" | jq -r '._debug.audit_reason')
assert_eq "audit_reason (não=CONVENIO_PARCEIRO)" "$([ "$A" = "CONVENIO_PARCEIRO" ] && echo blocked || echo ok)" "ok"

header "F3: BRADESCO SAÚDE SELECT aceito (renomeado de SELECT)"
R=$(chat_turn "tenho BRADESCO SAÚDE SELECT" "inicio" \
  '{"medico_nome":"Dra Suely","servico":"Consulta"}' '[]')
A=$(echo "$R" | jq -r '._debug.audit_reason')
assert_eq "BRADESCO SAÚDE SELECT não bloqueado" "$([ "$A" = "CONVENIO_PARCEIRO" ] && echo blocked || echo ok)" "ok"

# ═══════════════════════════════════════════════════════════════════════════
# G. MULTI-TENANT — Suely isolada de Marcelo
# ═══════════════════════════════════════════════════════════════════════════
header "G1: /availability Marcelo retorna Consulta Cardiológica (ordem_chegada)"
R=$(curl -s -X POST "${ENDPOINT}/availability" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d "{\"cliente_id\":\"$MARCELO_CID\",\"config_id\":\"$MARCELO_CFG\",\"medico_nome\":\"Dr. Marcelo\",\"atendimento_nome\":\"Consulta\",\"buscar_proximas\":true}")
TIPO_M=$(echo "$R" | jq -r .tipo_atendimento)
assert_eq "Marcelo continua ordem_chegada" "$TIPO_M" "ordem_chegada"

# ═══════════════════════════════════════════════════════════════════════════
# H. FLUXO CONVERSACIONAL (/chat com histórico)
# ═══════════════════════════════════════════════════════════════════════════
header "H1: fluxo completo — paciente novo → coleta convênio → próxima data"
# T1
T1=$(chat_turn "Olá, quero marcar consulta com Dra Suely" "inicio" "{}" "[]")
EST1=$(echo "$T1" | jq -r .novo_estado)
DAD1=$(echo "$T1" | jq -c .dados_coletados)
HIST1=$(echo "$T1" | jq -c .historico_contexto)

# T2: informa convênio
T2=$(chat_turn "tenho UNIMED 20%" "$EST1" "$DAD1" "$HIST1")
EST2=$(echo "$T2" | jq -r .novo_estado)
DAD2=$(echo "$T2" | jq -c .dados_coletados)
HIST2=$(echo "$T2" | jq -c .historico_contexto)
INTENT2=$(echo "$T2" | jq -r '._debug.intent')
assert_eq "T2 intent=agendar" "$INTENT2" "agendar"

# T3: pede uma data preferida
T3=$(chat_turn "queria pra próxima semana de manhã" "$EST2" "$DAD2" "$HIST2")
INTENT3=$(echo "$T3" | jq -r '._debug.intent')
ACTION3=$(echo "$T3" | jq -r '._debug.next_action')
assert_eq "T3 intent agendar/disponibilidade" "$([ "$INTENT3" = "agendar" ] || [ "$INTENT3" = "disponibilidade" ] && echo true || echo false)" "true"

# ═══════════════════════════════════════════════════════════════════════════
# I. RESUMO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTADO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
