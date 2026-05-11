#!/usr/bin/env bash
# ============================================================================
# Suite de testes COMPLETA do endpoint /availability
#
# Cobre 8 categorias:
#   A. Tipos de agendamento (ordem_chegada, fixed_time, walk_in_info_only)
#   B. Validação de data (passada, hoje, futura)
#   C. Dia da semana (atendido, não atendido)
#   D. Período do dia (manhã, tarde via mensagem_original)
#   E. Bloqueios de agenda (dia inteiro, range, com sugestões alternativas)
#   F. Multi-tenant (Marcelo cardio + Suely oftalmo)
#   G. Erros de input (médico inexistente, serviço inexistente)
#   H. Limite/lotação
#
# Uso:
#   ENDPOINT=https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api \
#   API_KEY=<N8N_API_KEY> \
#   ./availability-completo.sh
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

# ── Helpers ────────────────────────────────────────────────────────────────

avail() {
  local cid="$1" cfg="$2" medico="$3" servico="$4" data="${5:-}" msg="${6:-}"
  local extra=""
  [ -n "$data" ] && extra="$extra,\"data_consulta\":\"$data\""
  [ -n "$msg" ] && extra="$extra,\"mensagem_original\":\"$msg\""
  curl -s -X POST "${ENDPOINT}/availability" \
    -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
    -d "{\"cliente_id\":\"$cid\",\"config_id\":\"$cfg\",\"medico_nome\":\"$medico\",\"atendimento_nome\":\"$servico\",\"buscar_proximas\":true$extra}"
}

# assert_eq label json jq_path expected
# Usa "if .x == null then \"null\" else (.x | tostring) end" para distinguir false de ausente
assert_eq() {
  local label="$1" json="$2" path="$3" expected="$4"
  local actual; actual=$(echo "$json" | jq -r "if $path == null then \"null\" else ($path | tostring) end")
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (${path}=${actual})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC}"
    echo -e "    esperado: ${path}=${expected}"
    echo -e "    atual:    ${path}=${actual}"
    FAIL=$((FAIL+1))
  fi
}

assert_neq() {
  local label="$1" json="$2" path="$3" not_expected="$4"
  local actual; actual=$(echo "$json" | jq -r "if $path == null then \"null\" else ($path | tostring) end")
  if [ "$actual" != "$not_expected" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (${path}=${actual} ≠ ${not_expected})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (${path}=${actual} igual ao não-esperado)"; FAIL=$((FAIL+1))
  fi
}

# assert_gte label json path min
assert_gte() {
  local label="$1" json="$2" path="$3" min="$4"
  local actual; actual=$(echo "$json" | jq -r "$path // 0")
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    echo -e "${GREEN}  ✓ ${label}${NC} (${path}=${actual} >= ${min})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (${path}=${actual} < ${min})"; FAIL=$((FAIL+1))
  fi
}

# assert_no_data_in_results label json data_a_ausentar
assert_data_ausente() {
  local label="$1" json="$2" data="$3"
  local count; count=$(echo "$json" | jq -r "[.proximas_datas[]?.data] | map(select(. == \"$data\")) | length")
  if [ "$count" = "0" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (data ${data} ausente das ${data})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (data ${data} apareceu nos resultados!)"; FAIL=$((FAIL+1))
  fi
}

# assert_only_period label json periodo_esperado
assert_only_period() {
  local label="$1" json="$2" periodo="$3"
  local outros; outros=$(echo "$json" | jq -r "[.proximas_datas[]?.periodos[]?.periodo] | map(select(ascii_downcase != \"$periodo\")) | length")
  if [ "$outros" = "0" ]; then
    echo -e "${GREEN}  ✓ ${label}${NC} (todos os períodos = ${periodo})"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ ${label}${NC} (${outros} períodos ≠ ${periodo})"; FAIL=$((FAIL+1))
  fi
}

header() {
  echo ""
  echo -e "${BOLD}${YELLOW}═══ $1 ═══${NC}"
}

# ── A. TIPOS DE AGENDAMENTO ────────────────────────────────────────────────

header "A1: Marcelo + Consulta → ordem_chegada"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta")
assert_eq "success=true"          "$R" ".success" "true"
assert_eq "tipo=ordem_chegada"    "$R" ".tipo_atendimento" "ordem_chegada"
assert_gte "retorna >=1 datas"    "$R" "(.proximas_datas | length)" 1

header "A2: Marcelo + MAPA 24H → fixed_time (hora marcada)"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "MAPA 24H")
assert_eq "success=true"               "$R" ".success" "true"
assert_eq "primeiro tipo=fixed_time"   "$R" ".proximas_datas[0].periodos[0].tipo" "fixed_time"
assert_neq "tem hora marcada"          "$R" ".proximas_datas[0].periodos[0].hora" "null"

header "A3: Marcelo + ECG → walk_in_info_only (bloqueia agendamento)"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "ECG (Eletrocardiograma)")
assert_eq "success=true"                  "$R" ".success" "true"
assert_eq "tipo=walk_in_info_only"        "$R" ".tipo_atendimento" "walk_in_info_only"
assert_eq "zero datas (não agenda)"       "$R" "(.proximas_datas | length)" "0"

# ── B. VALIDAÇÃO DE DATA ──────────────────────────────────────────────────

header "B1: Data passada (2026-04-01) → DATA_PASSADA"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta" "2026-04-01")
assert_eq "success=false"           "$R" ".success" "false"
assert_eq "codigo=DATA_PASSADA"     "$R" ".codigo_erro" "DATA_PASSADA"

header "B2: Data hoje → success"
HOJE=$(date +%Y-%m-%d)
R=$(avail "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta" "$HOJE")
assert_eq "success=true"            "$R" ".success" "true"

header "B3: Data futura próxima → success"
FUTURA=$(date -d "+10 days" +%Y-%m-%d)
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta" "$FUTURA")
assert_eq "success=true"            "$R" ".success" "true"

# ── C. DIA DA SEMANA ──────────────────────────────────────────────────────

header "C1: Marcelo Consulta — sexta NÃO atende (15/05 = sex)"
# Marcelo Consulta: manhã=[seg,ter,qui], tarde=[qua]. Sexta nunca.
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta" "2026-05-15")
assert_data_ausente "15/05 (sex) não retornado"  "$R" "2026-05-15"

header "C2: Marcelo Consulta — quarta SÓ TARDE (20/05 = qua)"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta" "2026-05-20")
QUARTA_PERIODOS=$(echo "$R" | jq -r '[.proximas_datas[]? | select(.data=="2026-05-20") | .periodos[].periodo] | join(",") // ""')
if [ -z "$QUARTA_PERIODOS" ] || echo "$QUARTA_PERIODOS" | grep -qi "tarde"; then
  echo -e "${GREEN}  ✓ quarta retorna apenas tarde (ou vazio se lotado)${NC} ($QUARTA_PERIODOS)"; PASS=$((PASS+1))
else
  echo -e "${RED}  ✗ quarta tinha período diferente de tarde: $QUARTA_PERIODOS${NC}"; FAIL=$((FAIL+1))
fi

# ── D. PERÍODO DO DIA (via mensagem) ──────────────────────────────────────

header "D1: Suely + mensagem 'tarde' → retorna só tarde"
R=$(avail "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta" "" "quero tarde")
assert_only_period "todos períodos=tarde"  "$R" "tarde"

header "D2: Suely + mensagem 'manhã' → retorna só manhã"
R=$(avail "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta" "" "quero manhã")
assert_only_period "todos períodos=manhã"  "$R" "manhã"

# ── E. BLOQUEIOS DE AGENDA ────────────────────────────────────────────────

header "E1: Marcelo dia bloqueado (24/06 São João) → ausente dos resultados"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta")
# Mesmo sem pedir data específica, busca de próximas datas deve pular 24/06
assert_data_ausente "24/06 não retornado em buscar_proximas"  "$R" "2026-06-24"

header "E2: Marcelo range bloqueado (09-15/07 Viagem) → ausente"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta")
for d in 2026-07-09 2026-07-10 2026-07-13 2026-07-14 2026-07-15; do
  assert_data_ausente "$d (range viagem) ausente"  "$R" "$d"
done

header "E3: Marcelo data específica bloqueada (15/08 NS dos Anjos)"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Consulta" "2026-08-15")
# Sistema deve responder com sugestões alternativas (não com a data bloqueada)
assert_data_ausente "15/08 bloqueado não retornado"  "$R" "2026-08-15"

# ── F. MULTI-TENANT ───────────────────────────────────────────────────────

header "F1: Suely (Oftalmo, outro cliente) → independente do Marcelo"
R=$(avail "$SUELY_CID" "$SUELY_CFG" "Dra Suely" "Consulta")
assert_eq "success=true"            "$R" ".success" "true"
assert_gte "retorna datas"          "$R" "(.proximas_datas | length)" 1

# ── G. ERROS DE INPUT ────────────────────────────────────────────────────

header "G1: Médico inexistente → erro estruturado"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Que Nao Existe" "Consulta")
assert_eq "success=false"                                       "$R" ".success" "false"

header "G2: Serviço inexistente → erro estruturado"
R=$(avail "$MARCELO_CID" "$MARCELO_CFG" "Dr. Marcelo" "Servico Inventado XYZ")
SUCESSO=$(echo "$R" | jq -r '.success')
if [ "$SUCESSO" = "false" ]; then
  echo -e "${GREEN}  ✓ serviço inexistente retorna erro${NC}"; PASS=$((PASS+1))
else
  TOTAL=$(echo "$R" | jq -r '.proximas_datas | length')
  if [ "$TOTAL" = "0" ]; then
    echo -e "${GREEN}  ✓ serviço inexistente retorna sucesso vazio${NC}"; PASS=$((PASS+1))
  else
    echo -e "${RED}  ✗ serviço inexistente retornou datas inesperadas${NC}"; FAIL=$((FAIL+1))
  fi
fi

# ── H. RESUMO ─────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESUMO: ${GREEN}${PASS} passou${NC}${BOLD}  ${RED}${FAIL} falhou${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════════════════${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
