// ============= UTILITÁRIOS DE MASCARAMENTO DE PII =============
//
// Funções puras que retornam versões redacted de campos sensíveis.
// Aplicadas APENAS em logs/console — nunca em dados enviados ao banco/handler.

export function maskPhone(value: unknown): string {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

export function maskName(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim();
  if (!str) return '';
  const partes = str.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0];
  const ultimo = partes[partes.length - 1];
  return partes[0] + ' ' + ultimo.charAt(0).toUpperCase() + '.';
}

export function maskBirthDate(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim();
  if (!str) return '';
  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return `${iso[1]}-**-**`;
  // DD/MM/YYYY
  const br = str.match(/^\d{2}\/\d{2}\/(\d{4})/);
  if (br) return `**/**/${br[1]}`;
  return '****';
}

export function maskConvenio(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim();
  if (!str) return '';
  return str.charAt(0).toUpperCase() + '****';
}

// Chaves consideradas PII. Quando aparecerem em qualquer profundidade do
// objeto passado a maskPIIDeep, o valor é substituído pela versão mascarada.
const NAME_KEYS = new Set([
  'nome', 'nome_paciente', 'paciente_nome', 'nome_completo', 'patient_name',
]);
const PHONE_KEYS = new Set([
  'celular', 'telefone', 'phone', 'phone_paciente',
]);
const BIRTHDATE_KEYS = new Set([
  'data_nascimento', 'nascimento', 'birth_date', 'birthdate',
]);
const CONVENIO_KEYS = new Set([
  'convenio', 'convenio_normalizado',
]);

/**
 * Retorna uma cópia profunda do objeto com campos PII mascarados.
 * O objeto original não é modificado.
 *
 * Why: alguns logs (PLAN_INPUT, AVAILABILITY_CALL, AVAILABILITY_RESULT) serializam
 * objetos inteiros que carregam dados de paciente. Mascarar via wrapper evita que
 * cada call site precise saber quais chaves são sensíveis.
 */
export function maskPIIDeep<T>(input: T): T {
  return _maskRecursive(input, new WeakSet()) as T;
}

function _maskRecursive(value: any, seen: WeakSet<any>): any {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((v) => _maskRecursive(v, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (NAME_KEYS.has(k)) out[k] = maskName(v);
      else if (PHONE_KEYS.has(k)) out[k] = maskPhone(v);
      else if (BIRTHDATE_KEYS.has(k)) out[k] = maskBirthDate(v);
      else if (CONVENIO_KEYS.has(k)) out[k] = maskConvenio(v);
      else out[k] = _maskRecursive(v, seen);
    }
    return out;
  }

  return value;
}
