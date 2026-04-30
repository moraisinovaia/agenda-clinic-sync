#!/usr/bin/env bash
# ============================================================================
# smoke-prod.sh — bateria de smoke tests para llm-agent-api em qualquer cliente
#
# Uso:
#   ENDPOINT=https://<projeto>.supabase.co/functions/v1/llm-agent-api \
#   API_KEY=<N8N_API_KEY> \
#   CLIENTE_ID=<uuid> \
#   CONFIG_ID=<uuid> \
#   MEDICO_ID=<uuid principal> \
#   MEDICO_NOME='Dr. Fulano' \
#   SERVICO_AGENDADO='Consulta' \
#   SERVICO_FIXED_TIME='MAPA 24H' \
#   SERVICO_WALK_IN='ECG' \
#   CASO_DE_USO='Pré-operatório' \
#   CONVENIO_RECUSADO='MEDPREV' \
#   ./smoke-prod.sh [cenario]
#
# Cenários: all (default) | scope-cross | servico-inexistente | caso-uso |
#           walk-in | fixed-time | agendamento-ordem-chegada
#
# Saída: por cenário, status HTTP + 1 linha de validação. Final: PASSED/FAILED.
# Não cria/cancela/remarca agendamentos reais — só usa /availability.
# ============================================================================

set -euo pipefail

# ── Variáveis obrigatórias ──────────────────────────────────────────────────
: "${ENDPOINT:?ENDPOINT não definido}"
: "${API_KEY:?API_KEY não definido}"
: "${CLIENTE_ID:?CLIENTE_ID não definido}"
: "${MEDICO_ID:?MEDICO_ID não definido}"
: "${MEDICO_NOME:?MEDICO_NOME não definido}"

# ── Variáveis opcionais (com defaults sensatos) ─────────────────────────────
CONFIG_ID="${CONFIG_ID:-}"
SERVICO_AGENDADO="${SERVICO_AGENDADO:-Consulta}"
SERVICO_FIXED_TIME="${SERVICO_FIXED_TIME:-MAPA 24H}"
SERVICO_WALK_IN="${SERVICO_WALK_IN:-ECG}"
CASO_DE_USO="${CASO_DE_USO:-Pré-operatório}"
CONVENIO_RECUSADO="${CONVENIO_RECUSADO:-MEDPREV}"

CENARIO="${1:-all}"

# ── Cores e contadores ──────────────────────────────────────────────────────
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
PASSED=0
FAILED=0
SKIPPED=0

declare -A FAILED_CASES

# ── Helpers ─────────────────────────────────────────────────────────────────
post_availability() {
  local payload="$1"
  curl -sS -X POST "${ENDPOINT}/availability" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d "${payload}"
}

build_body() {
  local atendimento="$1"
  local extra="${2:-}"
  local cfg=""
  [ -n "$CONFIG_ID" ] && cfg="\"config_id\": \"$CONFIG_ID\","
  cat <<JSON
{
  "cliente_id": "$CLIENTE_ID",
  $cfg
  "medico_nome": "$MEDICO_NOME",
  "atendimento_nome": "$atendimento",
  "buscar_proximas": true,
  "allowed_doctor_ids": ["$MEDICO_ID"]$extra
}
JSON
}

assert() {
  local name="$1"; local condition="$2"; local detail="${3:-}"
  if eval "$condition"; then
    PASSED=$((PASSED+1))
    printf "  ${GREEN}✓${RESET} %s\n" "$name"
  else
    FAILED=$((FAILED+1))
    FAILED_CASES["$name"]="$detail"
    printf "  ${RED}✗${RESET} %s\n" "$name"
    [ -n "$detail" ] && printf "    ${YELLOW}detail:${RESET} %s\n" "$detail"
  fi
}

run_case() {
  local case_id="$1"
  local title="$2"
  shift 2
  if [ "$CENARIO" != "all" ] && [ "$CENARIO" != "$case_id" ]; then
    SKIPPED=$((SKIPPED+1))
    return 0
  fi
  printf "\n${CYAN}── [%s] %s${RESET}\n" "$case_id" "$title"
  "$@"
}

# ── Cenários ────────────────────────────────────────────────────────────────

case_servico_inexistente() {
  local body resp success codigo lista
  body=$(build_body "Servico Inexistente XYZ")
  resp=$(post_availability "$body")
  success=$(echo "$resp" | jq -r '.success')
  codigo=$(echo "$resp" | jq -r '.codigo_erro // "—"')
  lista=$(echo "$resp" | jq -r '.detalhes.servicos_disponiveis | length // 0')
  assert "success deve ser false"             '[ "$success" = "false" ]'      "got: $success"
  assert "codigo_erro = SERVICO_NAO_ENCONTRADO" '[ "$codigo" = "SERVICO_NAO_ENCONTRADO" ]' "got: $codigo"
  assert "servicos_disponiveis tem N>0 itens" '[ "$lista" -gt 0 ]'            "got: $lista"
}

case_caso_de_uso() {
  local body resp success caso principal
  body=$(build_body "$CASO_DE_USO")
  resp=$(post_availability "$body")
  success=$(echo "$resp" | jq -r '.success')
  caso=$(echo "$resp" | jq -r '.caso_de_uso.identificado // "—"')
  principal=$(echo "$resp" | jq -r '.caso_de_uso.atendimento_principal // "—"')
  assert "success = true"                              '[ "$success" = "true" ]'   "got: $success"
  assert "caso_de_uso.identificado = $CASO_DE_USO"     '[ "$caso" = "$CASO_DE_USO" ]' "got: $caso"
  assert "caso_de_uso.atendimento_principal definido"  '[ "$principal" != "—" ] && [ "$principal" != "null" ]' "got: $principal"
}

case_walk_in() {
  local body resp tipo proximas horarios
  body=$(build_body "$SERVICO_WALK_IN")
  resp=$(post_availability "$body")
  tipo=$(echo "$resp" | jq -r '.tipo_atendimento // "—"')
  proximas=$(echo "$resp" | jq -r '.proximas_datas // "absent"')
  horarios=$(echo "$resp" | jq -r '.horarios_atendimento | length // 0')
  assert "tipo_atendimento = walk_in_info_only" '[ "$tipo" = "walk_in_info_only" ]' "got: $tipo"
  assert "sem proximas_datas (walk-in não conta vagas)" '[ "$proximas" = "absent" ]' "got: $proximas"
  assert "horarios_atendimento tem dias úteis"  '[ "$horarios" -gt 0 ]'             "got: $horarios"
}

case_fixed_time() {
  local body resp tipo n_datas vagas_min
  body=$(build_body "$SERVICO_FIXED_TIME")
  resp=$(post_availability "$body")
  n_datas=$(echo "$resp" | jq -r '.proximas_datas | length // 0')
  tipo=$(echo "$resp" | jq -r '.proximas_datas[0].periodos[0].tipo // "—"')
  vagas_min=$(echo "$resp" | jq -r '[.proximas_datas[].periodos[0].vagas_disponiveis] | min // -1')
  assert "tipo do primeiro slot = fixed_time"   '[ "$tipo" = "fixed_time" ]'  "got: $tipo"
  assert "≥ 1 data retornada"                   '[ "$n_datas" -ge 1 ]'        "got: $n_datas"
  assert "todas as datas têm vagas > 0"         '[ "$vagas_min" -gt 0 ]'      "min vagas: $vagas_min (se 0 = bug 1 fixed_time voltou)"
}

case_agendamento_ordem_chegada() {
  local body resp n_datas tipo
  body=$(build_body "$SERVICO_AGENDADO")
  resp=$(post_availability "$body")
  n_datas=$(echo "$resp" | jq -r '.proximas_datas | length // 0')
  tipo=$(echo "$resp" | jq -r '.tipo_atendimento // .proximas_datas[0].periodos[0].tipo // "—"')
  assert "≥ 1 data retornada"                   '[ "$n_datas" -ge 1 ]'        "got: $n_datas"
  assert "tipo é ordem_chegada"                 '[ "$tipo" = "ordem_chegada" ]' "got: $tipo"
}

case_scope_cross() {
  local body resp success codigo
  body=$(build_body "$SERVICO_AGENDADO" ', "config_id": "00000000-0000-0000-0000-000000000000"')
  resp=$(post_availability "$body")
  # Aceita: ou config bloqueada (etapa B) ou serviço não encontrado por config nula
  success=$(echo "$resp" | jq -r '.success')
  assert "rejeita config_id cross-tenant ou config inválida" '[ "$success" = "false" ]' "got: $success"
}

# ── Run ─────────────────────────────────────────────────────────────────────
printf "${CYAN}smoke-prod.sh${RESET} | endpoint=%s\n" "$ENDPOINT"
printf "  cliente_id=%s medico=%s\n" "$CLIENTE_ID" "$MEDICO_NOME"
printf "  servicos: agendado=%s | fixed=%s | walk_in=%s | caso=%s\n" \
  "$SERVICO_AGENDADO" "$SERVICO_FIXED_TIME" "$SERVICO_WALK_IN" "$CASO_DE_USO"

run_case "servico-inexistente"        "Serviço inválido → erro acionável (F1.3)" \
         case_servico_inexistente
run_case "caso-uso"                   "Alias resolvido + orientação (F1.3.1)" \
         case_caso_de_uso
run_case "walk-in"                    "Walk-in sem contagem de vagas (F1.2)" \
         case_walk_in
run_case "fixed-time"                 "Fixed-time conta corretamente (F1.4)" \
         case_fixed_time
run_case "agendamento-ordem-chegada"  "Ordem de chegada (consulta padrão)" \
         case_agendamento_ordem_chegada
run_case "scope-cross"                "config_id cross-tenant é rejeitado (etapa B)" \
         case_scope_cross

printf "\n──────────────────────────────────────────────\n"
printf "  ${GREEN}PASSED${RESET}: %d  ${RED}FAILED${RESET}: %d  ${YELLOW}SKIPPED${RESET}: %d\n" \
  "$PASSED" "$FAILED" "$SKIPPED"

if [ "$FAILED" -gt 0 ]; then
  printf "\n${RED}Falhas:${RESET}\n"
  for k in "${!FAILED_CASES[@]}"; do
    printf "  - %s\n    %s\n" "$k" "${FAILED_CASES[$k]}"
  done
  exit 1
fi
exit 0
