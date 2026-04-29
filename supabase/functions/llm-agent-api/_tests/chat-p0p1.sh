#!/usr/bin/env bash
# ============================================================================
# Testes P0+P1 — Dr. Marcelo D'Carli
#
# Uso:
#   chmod +x chat-p0p1.sh
#   ENDPOINT=https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api \
#   API_KEY=<N8N_API_KEY> \
#   CLIENTE_ID=2bfb98b5-ae41-4f96-8ba7-acc797c22054 \
#   CONFIG_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
#   ./chat-p0p1.sh [CENARIO]
#
# Cenários:
#   consulta  formato  ecg  mrpa  ergo  all (default)
# ============================================================================

set -u

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
CLIENTE_ID="${CLIENTE_ID:-2bfb98b5-ae41-4f96-8ba7-acc797c22054}"
CONFIG_ID="${CONFIG_ID:-a1b2c3d4-e5f6-7890-abcd-ef1234567890}"
MEDICO_ID="${MEDICO_ID:-1e110923-50df-46ff-a57a-29d88e372900}"
CENARIO="${1:-all}"

PASS=0; FAIL=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────

safe_json() {
  local val="${1:-}" fallback="$2"
  [ -z "$val" ] && { echo "$fallback"; return; }
  echo "$val" | jq empty 2>/dev/null && echo "$val" || echo "$fallback"
}

chat_turn() {
  local mensagem="$1" estado="${2:-inicio}" dados="${3:-}" historico="${4:-}"
  dados=$(safe_json "$dados" '{}')
  historico=$(safe_json "$historico" '[]')
  local payload
  payload=$(jq -n \
    --arg  cliente_id   "$CLIENTE_ID" \
    --arg  config_id    "$CONFIG_ID" \
    --arg  mensagem     "$mensagem" \
    --arg  estado       "$estado" \
    --argjson dados     "$dados" \
    --argjson historico "$historico" \
    '{cliente_id:$cliente_id, config_id:$config_id, mensagem:$mensagem,
      estado_atual:$estado, dados_coletados:$dados, historico_contexto:$historico}')
  curl -s -X POST "${ENDPOINT}/chat" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "$payload"
}

availability_direct() {
  local medico_nome="$1" servico="$2"
  curl -s -X POST "${ENDPOINT}/availability" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg cliente_id "$CLIENTE_ID" \
      --arg config_id  "$CONFIG_ID" \
      --arg medico     "$medico_nome" \
      --arg servico    "$servico" \
      '{cliente_id:$cliente_id, config_id:$config_id,
        medico_nome:$medico, atendimento_nome:$servico, buscar_proximas:true}')"
}

schedule_direct() {
  local servico="$1" medico="$2"
  curl -s -X POST "${ENDPOINT}/schedule" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg cliente_id "$CLIENTE_ID" \
      --arg config_id  "$CONFIG_ID" \
      --arg atend      "$servico" \
      --arg medico     "$medico" \
      '{cliente_id:$cliente_id, config_id:$config_id,
        atendimento_nome:$atend, medico_nome:$medico,
        paciente_nome:"Paciente Teste", data_nascimento:"1980-01-01",
        convenio:"PARTICULAR", celular:"87999999999",
        data_consulta:"2026-05-07", hora_consulta:"08:00:00"}')"
}

jq_get() { echo "$1" | jq -r "$2" 2>/dev/null; }
resposta_de() { jq_get "$1" ".resposta // .mensagem_usuario // .message // empty"; }

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qi "$needle"; then
    echo -e "${GREEN}  ✓ ${label}${NC}"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: '${needle}'"
    echo -e "    resposta: $(echo "$haystack" | head -c 250)"
    FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if ! echo "$haystack" | grep -qi "$needle"; then
    echo -e "${GREEN}  ✓ ${label}${NC}"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    NÃO esperado: '${needle}'"
    echo -e "    resposta: $(echo "$haystack" | head -c 250)"
    FAIL=$((FAIL+1))
  fi
}

assert_field() {
  local label="$1" json="$2" path="$3" expected="$4"
  local actual; actual=$(jq_get "$json" "$path")
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✓ ${label} (${path}=${actual})${NC}"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: ${path}=${expected}"
    echo -e "    atual:    ${path}=${actual}"
    FAIL=$((FAIL+1))
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 1 — Consulta: disponibilidade + formatação WhatsApp
# Dados pré-preenchidos: servico + medico_nome (pré-requisito para mostrar vagas)
# ═══════════════════════════════════════════════════════════════════════════
run_consulta() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 1a: Consulta com serviço preenchido → disponibilidade ━━${NC}"
  DADOS='{"servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo"}'
  R=$(chat_turn "Quando tem vaga?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_contains "menciona ordem de chegada"        "$RESP" "ordem de chegada\|compareça\|chegar\|ficha"
  assert_not_contains "sem horário fixo de agendamento" "$RESP" "agendado às\|confirmado às\|horário marcado às"
  assert_not_contains "sem msg genérica de contagem" "$RESP" "datas disponíveis encontradas"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 1b: Mensagem completa (serviço + médico + período na msg) ━━${NC}"
  R=$(chat_turn "Quero consulta cardiológica com Dr. Marcelo pela manhã" "inicio")
  RESP=$(resposta_de "$R")
  assert_contains "responde sobre consulta/disponibilidade" "$RESP" "compareça\|chegar\|ficha\|07:00\|manhã\|ordem\|vaga\|disponível\|convênio\|serviço\|médico"
  assert_not_contains "sem hora fixa de agendamento" "$RESP" "agendado às [0-9]\|confirmado às [0-9]"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 1c: Janela de exibição manhã 07:00–10:00 ━━${NC}"
  DADOS='{"servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo","periodo":"manha"}'
  R=$(chat_turn "Quando tem vagas de manhã?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_contains "janela manhã inclui 07:00"        "$RESP" "07:00"
  assert_contains "janela manhã inclui 10:00"        "$RESP" "10:00"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 1d: Janela de exibição tarde 13:00–15:00 ━━${NC}"
  DADOS='{"servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo","periodo":"tarde"}'
  R=$(chat_turn "Quando tem vagas à tarde?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_contains "janela tarde inclui 13:00"        "$RESP" "13:00"
  assert_contains "janela tarde inclui 15:00"        "$RESP" "15:00"
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 2 — Formatação: nunca retorna horário técnico
# ═══════════════════════════════════════════════════════════════════════════
run_formato() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 2: Formatação — resposta nunca exibe horário técnico ━━${NC}"
  DADOS='{"servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo"}'
  R=$(chat_turn "Tem vaga?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_not_contains "sem horário fixo agendado"     "$RESP" "agendado às [0-9]\|confirmado às [0-9]"
  assert_not_contains "sem 'horário marcado'"         "$RESP" "horário marcado"
  assert_not_contains "sem msg genérica de contagem" "$RESP" "datas disponíveis encontradas"
  assert_contains     "ordem de chegada na resposta" "$RESP" "ordem de chegada\|compareça\|chegar\|ficha"
  assert_contains     "janela de comparecimento"     "$RESP" "07:00\|10:00\|13:00\|15:00"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 2b: MAPA — guia obrigatória mesmo sem dados ━━${NC}"
  R=$(chat_turn "quero agendar MAPA com Dr. Marcelo" "identificando_servico")
  AUDIT=$(jq_get "$R" "._debug.audit_reason")
  assert_contains "audit_reason=MAPA_AMBIGUO ou MAPA_SEM_GUIA" "$AUDIT" "MAPA_AMBIGUO\|MAPA_SEM_GUIA"
  RESP=$(resposta_de "$R")
  assert_contains "pede guia"             "$RESP" "guia"
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 3 — ECG: walk_in_info_only bloqueia agendamento
# ═══════════════════════════════════════════════════════════════════════════
run_ecg() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 3a: ECG via /schedule direto → BLOQUEADO ━━${NC}"
  R=$(schedule_direct "ECG (Eletrocardiograma)" "Dr. Marcelo")
  assert_contains "retorna erro walk_in"    "$R" "SERVICO_SEM_AGENDAMENTO\|sem agendamento\|walk_in"
  assert_not_contains "não cria agendamento" "$R" "agendado com sucesso\|agendamento_id"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 3b: ECG via chat → orienta sem agendar ━━${NC}"
  R=$(chat_turn "quero marcar ECG com Dr. Marcelo" "inicio")
  RESP=$(resposta_de "$R")
  assert_contains "orienta sobre ECG"       "$RESP" "ECG\|eletrocardiograma\|ordem de chegada\|sem agendamento\|compareça\|local"
  assert_not_contains "não agenda ECG"      "$RESP" "agendado com sucesso"
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 4 — MRPA: terça-feira incluída na manhã
# ═══════════════════════════════════════════════════════════════════════════
run_mrpa() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 4a: MRPA /availability — terça aparece nos resultados ━━${NC}"
  R=$(availability_direct "Dr. Marcelo" "MRPA")

  # Se há proximas_datas, verificar que temos datas e que tipo está correto
  local n_datas; n_datas=$(echo "$R" | jq '.proximas_datas | length' 2>/dev/null)
  if [ "${n_datas:-0}" -gt "0" ]; then
    echo -e "${GREEN}  ✓ retorna ${n_datas} data(s) disponível(is)${NC}"; PASS=$((PASS+1))
    # Verificar que tipo é ordem_chegada (hybrid_capacity)
    local tipo; tipo=$(echo "$R" | jq -r '.proximas_datas[0].periodos[0].tipo // empty' 2>/dev/null)
    assert_contains "tipo é ordem_chegada" "$tipo" "ordem_chegada\|capacity_window\|hybrid"
  elif echo "$R" | grep -q "sem_vagas"; then
    echo -e "${GREEN}  ✓ sem vagas retornado corretamente (DB sem slots futuros para MRPA)${NC}"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ resposta inesperada do /availability para MRPA${NC}"
    echo -e "    raw: $(echo "$R" | head -c 200)"
    FAIL=$((FAIL+1))
  fi

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 4b: MRPA via chat ━━${NC}"
  R=$(chat_turn "quero fazer MRPA com Dr. Marcelo" "inicio")
  RESP=$(resposta_de "$R")
  assert_not_contains "sem horário marcado" "$RESP" "horário marcado\|às 07:[0-9][0-9]"
  assert_contains     "responde sobre MRPA" "$RESP" "."
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 5 — Teste Ergométrico: regras clínicas
# ═══════════════════════════════════════════════════════════════════════════
run_ergo() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 5a: Ergométrico com fístula → BLOQUEAR ━━${NC}"
  DADOS='{"servico":"Teste Ergométrico","medico_nome":"Dr. Marcelo","fistula":true,"peso":80}'
  R=$(chat_turn "quero fazer teste ergométrico" "identificando_servico" "$DADOS")
  assert_field    "audit_reason=FISTULA_BLOCK"  "$R" "._debug.audit_reason" "FISTULA_BLOCK"
  RESP=$(resposta_de "$R")
  assert_contains "bloqueia por fístula"        "$RESP" "fistula\|braço\|não pode"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 5b: Ergométrico peso 160kg → BLOQUEAR ━━${NC}"
  DADOS='{"servico":"Teste Ergométrico","medico_nome":"Dr. Marcelo","peso":160,"fistula":false}'
  R=$(chat_turn "meu peso é 160kg" "identificando_servico" "$DADOS")
  assert_field    "audit_reason=PESO_BLOCK"     "$R" "._debug.audit_reason" "PESO_BLOCK"
  RESP=$(resposta_de "$R")
  assert_contains "bloqueia por peso"           "$RESP" "150\|limite\|peso"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 5c: Ergométrico OK (80kg, sem fístula) → sem bloqueio ━━${NC}"
  DADOS='{"servico":"Teste Ergométrico","medico_nome":"Dr. Marcelo","peso":80,"fistula":false}'
  R=$(chat_turn "não tenho fístula, peso 80kg, quero marcar" "identificando_servico" "$DADOS")
  assert_field    "sem audit_reason"            "$R" "._debug.audit_reason" "null"
  # Verificar só na resposta, não no JSON completo (que contém "fistula" nos dados_coletados)
  RESP=$(resposta_de "$R")
  assert_not_contains "não bloqueia fistula"    "$RESP" "não pode realizar\|fistula.*braço"
  assert_not_contains "não bloqueia peso"       "$RESP" "150.*excede\|limite de peso"
}

# ═══════════════════════════════════════════════════════════════════════════
# CENÁRIO 6 — MAPA 24H / MRPA: separação e regras P2
# ═══════════════════════════════════════════════════════════════════════════
run_mapa_mrpa() {

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6a: 'mapa' ambíguo → pede tipo + guia (msg única) ━━${NC}"
  R=$(chat_turn "quero fazer mapa" "inicio")
  RESP=$(resposta_de "$R")
  assert_field    "audit_reason=MAPA_AMBIGUO"   "$R" "._debug.audit_reason" "MAPA_AMBIGUO"
  assert_contains "menciona MAPA 24H"           "$RESP" "MAPA 24H"
  assert_contains "menciona MRPA"               "$RESP" "MRPA"
  assert_contains "pede foto da guia"           "$RESP" "guia\|foto"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6b: MAPA 24H sem guia → bloqueia e pede guia ━━${NC}"
  DADOS='{"servico":"MAPA 24H","medico_nome":"Dr. Marcelo"}'
  R=$(chat_turn "quero agendar MAPA 24H, quando tem disponibilidade?" "identificando_servico" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_field    "audit_reason=MAPA_SEM_GUIA"  "$R" "._debug.audit_reason" "MAPA_SEM_GUIA"
  assert_contains "pede guia MAPA 24H"          "$RESP" "guia\|autorização"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6c: MAPA 24H com guia → availability retorna hora fixa ━━${NC}"
  DADOS='{"servico":"MAPA 24H","medico_nome":"Dr. Marcelo","tem_guia":true}'
  R=$(chat_turn "quando tem disponibilidade para MAPA 24H?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  # resposta deve conter hora marcada (não "ordem de chegada")
  assert_not_contains "não mostra ordem chegada"   "$RESP" "ordem de chegada"
  assert_contains     "menciona hora marcada"      "$RESP" "às 0[89]:[0-9][0-9]\|às 10:[0-9][0-9]"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6d: MRPA convênio sem guia → bloqueia e pede guia ━━${NC}"
  DADOS='{"servico":"MRPA","medico_nome":"Dr. Marcelo","convenio":"UNIMED"}'
  R=$(chat_turn "quero fazer MRPA" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_field    "audit_reason=MRPA_SEM_GUIA"  "$R" "._debug.audit_reason" "MRPA_SEM_GUIA"
  assert_contains "pede guia MRPA"              "$RESP" "guia\|autorização"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6e: MRPA particular → não pede guia ━━${NC}"
  DADOS='{"servico":"MRPA","medico_nome":"Dr. Marcelo","convenio":"PARTICULAR"}'
  R=$(chat_turn "quero fazer MRPA, pago particular" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_not_contains "não bloqueia por guia"   "$RESP" "guia médica\|enviar.*guia"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6f: MRPA com guia → availability retorna janela (sem hora fixa) ━━${NC}"
  DADOS='{"servico":"MRPA","medico_nome":"Dr. Marcelo","tem_guia":true}'
  R=$(chat_turn "quando tem vaga para MRPA?" "inicio" "$DADOS")
  RESP=$(resposta_de "$R")
  assert_contains     "menciona compareça/janela" "$RESP" "compareça\|07:00\|13:00\|ordem"
  assert_not_contains "não mostra hora marcada"   "$RESP" "às 0[89]:[0-9][0-9] (chegue\|às 10:[0-9][0-9] (chegue"

}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Testes P0+P1 — Dr. Marcelo D'Carli"
echo "  Endpoint: ${ENDPOINT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

case "$CENARIO" in
  consulta)   run_consulta   ;;
  formato)    run_formato    ;;
  ecg)        run_ecg        ;;
  mrpa)       run_mrpa       ;;
  ergo)       run_ergo       ;;
  mapa_mrpa)  run_mapa_mrpa  ;;
  all|*)
    run_consulta
    run_formato
    run_ecg
    run_mrpa
    run_ergo
    run_mapa_mrpa
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Resultado: ${GREEN}${PASS} passou${NC}  ${RED}${FAIL} falhou${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
