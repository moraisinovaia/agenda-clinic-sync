// ============= NORMALIZAÇÃO DE BODY (Postel's Law) =============
//
// Pré-processa o body antes da validação de schema. Aplica a regra clássica
// "be liberal in what you accept, conservative in what you send":
//
//   '' (string vazia)  →  omitir do body (equivale a campo ausente)
//   null               →  omitir do body (equivale a campo ausente)
//   undefined          →  já é ausente
//
// Por que: clientes (n8n template engine, scripts JS, formulários web)
// frequentemente serializam valores faltantes como string vazia em vez de
// omitir a chave. Forçá-los a usar `null` ou omitir vai contra a robustez
// esperada de uma API profissional. Stripe, Twilio, GitHub e AWS aceitam
// `""` ≡ `null` ≡ ausente nos seus schemas.
//
// O QUE NÃO MUDA (validator continua rigoroso sobre valores presentes):
//   - cliente_id obrigatório → '' ainda dispara erro de "obrigatório"
//   - UUID malformado ('abc') → continua erro de uuid
//   - Tipo errado (number em string) → continua erro de tipo
//   - Enum inválido ('xyz' em periodo) → continua erro de enum
//   - Datas malformadas → continuam erro
//
// O QUE MUDA (apenas formas alternativas de "ausência" são tratadas como tal):
//   - config_id: ''       → omitido → válido (UUID opcional, ausente OK)
//   - allowed_doctor_ids: [] → mantido [] → handler trata array vazio como sem escopo
//   - data_consulta: ''   → omitido → válido (campo opcional)
//
// Aplicação: chamar `body = normalizeRequestBody(body)` ANTES do schema
// validator no router. Não modifica o body original (retorna novo objeto).

/**
 * Remove chaves cujo valor é string vazia ou null. Não mexe em arrays,
 * objects aninhados, números, booleans, etc.
 *
 * Não-recursivo por design: schema validators atuais só inspecionam o
 * primeiro nível do body. Se um dia houver objetos aninhados (ex:
 * patient: { nome: '' }), considerar normalização recursiva ou tratar
 * dentro do validator específico.
 */
export function normalizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}
