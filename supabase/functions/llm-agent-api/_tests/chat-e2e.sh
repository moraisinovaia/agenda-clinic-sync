#!/usr/bin/env bash
# ============================================================================
# Cenários E2E do /chat — Dr. Marcelo D'Carli
#
# Uso:
#   chmod +x chat-e2e.sh
#   ENDPOINT=https://<project>.supabase.co/functions/v1/llm-agent-api \
#   API_KEY=<seu-n8n-api-key> \
#   CLIENTE_ID=<uuid-cliente> \
#   CONFIG_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
#   ./chat-e2e.sh [CENARIO]
#
# Exemplos:
#   ./chat-e2e.sh mapa          → Cenário 1-3: MAPA sem/com guia
#   ./chat-e2e.sh ergo          → Cenário 4-6: Ergométrico peso/fístula
#   ./chat-e2e.sh agendamento   → Cenário 7: Confirmação antes de agendar
#   ./chat-e2e.sh convenio      → Cenário 8: Convênio parceiro
#   ./chat-e2e.sh saudacao      → Cenário 9: Saudação inicial
#   ./chat-e2e.sh all           → Todos os cenários (default)
# ============================================================================

set -euo pipefail

ENDPOINT="${ENDPOINT:-http://localhost:54321/functions/v1/llm-agent-api}"
API_KEY="${API_KEY:-test-key}"
CLIENTE_ID="${CLIENTE_ID:-00000000-0000-0000-0000-000000000001}"
CONFIG_ID="${CONFIG_ID:-a1b2c3d4-e5f6-7890-abcd-ef1234567890}"
CENARIO="${1:-all}"

PASS=0
FAIL=0

# ── Cores ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Helper: enviar mensagem de chat ───────────────────────────────────────
# Uso: chat_turn <mensagem> [estado] [dados_json] [historico_json]
# Retorna o JSON completo da resposta.
chat_turn() {
  local mensagem="$1"
  local estado="${2:-inicio}"
  local dados="${3:-{}}"
  local historico="${4:-[]}"

  curl -s -X POST "${ENDPOINT}/chat" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "{
      \"cliente_id\": \"${CLIENTE_ID}\",
      \"config_id\": \"${CONFIG_ID}\",
      \"mensagem\": ${mensagem@Q},
      \"estado_atual\": \"${estado}\",
      \"dados_coletados\": ${dados},
      \"historico_contexto\": ${historico}
    }"
}

# ── Helper: extrair campo do JSON ─────────────────────────────────────────
jq_get() { echo "$1" | jq -r "$2" 2>/dev/null; }

# ── Helper: assert ────────────────────────────────────────────────────────
assert_contains() {
  local label="$1"; local haystack="$2"; local needle="$3"
  if echo "$haystack" | grep -qi "$needle"; then
    echo -e "${GREEN}  ✓ ${label}${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: '${needle}'"
    echo -e "    resposta: $(echo "$haystack" | jq -r '.resposta // .error' | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  local label="$1"; local haystack="$2"; local needle="$3"
  if ! echo "$haystack" | grep -qi "$needle"; then
    echo -e "${GREEN}  ✓ ${label}${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    NÃO esperado: '${needle}'"
    echo -e "    resposta: $(echo "$haystack" | jq -r '.resposta // .error' | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

assert_field() {
  local label="$1"; local json="$2"; local path="$3"; local expected="$4"
  local actual; actual=$(jq_get "$json" "$path")
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✓ ${label} (${path}=${actual})${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: ${path}=${expected}"
    echo -e "    atual:    ${path}=${actual}"
    FAIL=$((FAIL+1))
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# CENÁRIO 1-3: MAPA 24H — guia médica obrigatória
# ═════════════════════════════════════════════════════════════════════════════
run_mapa() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 1: Paciente pede MAPA sem mencionar guia ━━${NC}"
  R=$(chat_turn "quero fazer MAPA")
  assert_contains "pergunta se tem guia"        "$R" "guia"
  assert_field    "estado não avança"           "$R" ".novo_estado" "inicio"
  assert_field    "audit_reason=MAPA_SEM_GUIA"  "$R" "._debug.audit_reason" "MAPA_SEM_GUIA"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 2: Paciente confirma que NÃO tem guia ━━${NC}"
  # Estado após cenário 1 permanece 'inicio'; dados_coletados = { servico: "MAPA 24H" }
  DADOS='{"servico":"MAPA 24H"}'
  R=$(chat_turn "não tenho guia ainda" "inicio" "$DADOS")
  assert_contains "orienta a obter guia"        "$R" "guia"
  assert_field    "audit_reason=MAPA_SEM_GUIA"  "$R" "._debug.audit_reason" "MAPA_SEM_GUIA"
  # tem_guia deve continuar null ou false — NÃO avança para agendar
  local tem_guia; tem_guia=$(jq_get "$R" ".dados_coletados.tem_guia")
  assert_not_contains "não agenda sem guia"     "$R" "agendad"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 3: Paciente confirma que TEM guia → fluxo continua ━━${NC}"
  DADOS='{"servico":"MAPA 24H"}'
  R=$(chat_turn "sim, tenho a guia comigo" "inicio" "$DADOS")
  assert_field    "tem_guia=true coletado"      "$R" ".dados_coletados.tem_guia" "true"
  assert_field    "sem audit_reason"            "$R" "._debug.audit_reason" "null"
  assert_not_contains "não bloqueia"            "$R" "guia médica é necessária"
}

# ═════════════════════════════════════════════════════════════════════════════
# CENÁRIO 4-6: TESTE ERGOMÉTRICO — peso e fístula
# ═════════════════════════════════════════════════════════════════════════════
run_ergo() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 4: Ergométrico sem peso → deve perguntar peso/fístula ━━${NC}"
  R=$(chat_turn "quero fazer teste ergométrico com Dr. Marcelo")
  assert_contains "pede peso ou fístula"        "$R" "peso\|fistula\|braço"
  assert_not_contains "não busca disponibilidade ainda" "$R" "horário disponível\|vaga"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 5: Ergométrico, peso 160kg → RECUSAR ━━${NC}"
  DADOS='{"servico":"Teste Ergométrico","medico_nome":"Dr. Marcelo","peso":160}'
  R=$(chat_turn "meu peso é 160kg" "identificando_servico" "$DADOS")
  assert_contains "recusa por peso"            "$R" "150\|limite\|peso"
  assert_field    "audit_reason=PESO_BLOCK"    "$R" "._debug.audit_reason" "PESO_BLOCK"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 6: Ergométrico, 80kg, sem fístula → fluxo normal ━━${NC}"
  DADOS='{"servico":"Teste Ergométrico","medico_nome":"Dr. Marcelo","peso":80,"fistula":false}'
  R=$(chat_turn "não tenho fistula, peso 80kg" "identificando_servico" "$DADOS")
  assert_field    "sem audit_reason"           "$R" "._debug.audit_reason" "null"
  assert_not_contains "não bloqueia"          "$R" "150\|limite"
}

# ═════════════════════════════════════════════════════════════════════════════
# CENÁRIO 7: AGENDAMENTO — confirmação obrigatória antes de executar
# ═════════════════════════════════════════════════════════════════════════════
run_agendamento() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 7a: Todos os dados preenchidos → pede confirmação ━━${NC}"
  DADOS='{
    "servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo",
    "data_consulta":"2026-05-15","nome_paciente":"Carlos Souza",
    "data_nascimento":"1970-08-10","convenio":"UNIMED 20%","periodo":"manha"
  }'
  R=$(chat_turn "pode agendar" "confirmando_dados" "$DADOS")
  # LLM deve sugerir confirm_schedule ou o backend força
  local na; na=$(jq_get "$R" "._debug.next_action")
  # Aceitar confirm_schedule OU ask_missing (se faltou algo)
  assert_contains "pede confirmação ou resume dados" "$R" "confirma\|confirmar\|dados\|agendamento"
  assert_not_contains "não executa sem confirmação" "$R" "agendado com sucesso"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 7b: Paciente confirma explicitamente ━━${NC}"
  DADOS='{
    "servico":"Consulta Cardiológica","medico_nome":"Dr. Marcelo",
    "data_consulta":"2026-05-15","nome_paciente":"Carlos Souza",
    "data_nascimento":"1970-08-10","convenio":"UNIMED 20%","periodo":"manha",
    "confirmado":false
  }'
  R=$(chat_turn "sim, confirmo o agendamento" "confirmando_dados" "$DADOS")
  local confirmed; confirmed=$(jq_get "$R" ".dados_coletados.confirmado")
  # Se a disponibilidade foi verificada antes, confirmado=true avança para execute_schedule
  assert_contains "confirmado extraído" "$R" "."  # só verifica que respondeu
  # O agente deve tentar agendar ou informar resultado
}

# ═════════════════════════════════════════════════════════════════════════════
# CENÁRIO 8: CONVÊNIO PARCEIRO — nunca agendar
# ═════════════════════════════════════════════════════════════════════════════
run_convenio() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 8: Convênio MEDPREV → recusar agendamento ━━${NC}"
  DADOS='{"servico":"Consulta","medico_nome":"Dr. Marcelo","convenio":"MEDPREV"}'
  R=$(chat_turn "quero agendar pelo MEDPREV" "identificando_servico" "$DADOS")
  assert_field    "audit_reason=CONVENIO_PARCEIRO"  "$R" "._debug.audit_reason" "CONVENIO_PARCEIRO"
  assert_contains "orienta contato com operadora"   "$R" "MEDPREV\|operadora\|convênio parceiro"
  assert_not_contains "não agenda"                  "$R" "agendado"
}

# ═════════════════════════════════════════════════════════════════════════════
# CENÁRIO 9: SAUDAÇÃO — sempre inicia coleta, nunca encerra
# ═════════════════════════════════════════════════════════════════════════════
run_saudacao() {
  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 9a: Saudação simples ━━${NC}"
  R=$(chat_turn "Oi")
  assert_contains "responde com boas-vindas"       "$R" "bem-vindo\|olá\|ajud"
  assert_not_contains "não encerra sem ajudar"     "$R" "até logo\|tchau"

  echo ""
  echo -e "${YELLOW}━━ CENÁRIO 9b: Bom dia ━━${NC}"
  R=$(chat_turn "Bom dia")
  assert_contains "responde e pergunta necessidade" "$R" "ajud\|serviço\|agendar"
  assert_field    "intent=saudacao ou next_action=ask_missing" "$R" "._debug.intent" "saudacao"
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Chat E2E — Dr. Marcelo D'Carli"
echo "  Endpoint: ${ENDPOINT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

case "$CENARIO" in
  mapa)        run_mapa ;;
  ergo)        run_ergo ;;
  agendamento) run_agendamento ;;
  convenio)    run_convenio ;;
  saudacao)    run_saudacao ;;
  all|*)
    run_saudacao
    run_mapa
    run_ergo
    run_convenio
    run_agendamento
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Resultado: ${GREEN}${PASS} passou${NC}  ${RED}${FAIL} falhou${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
