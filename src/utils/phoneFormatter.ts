/**
 * Utilitário para formatação de números de telefone brasileiro
 * Formatos suportados:
 * - Telefone fixo: (XX) XXXX-XXXX
 * - Celular: (XX) XXXXX-XXXX
 */

/**
 * Formata número de telefone brasileiro automaticamente
 * @param value - Valor a ser formatado
 * @returns Número formatado com máscara apropriada
 */
export function formatPhone(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos (DDD + 9 dígitos do celular)
  const limitedNumbers = numbers.slice(0, 11);
  
  // Aplica máscara baseada no tamanho
  if (limitedNumbers.length <= 10) {
    // Telefone fixo: (xx) xxxx-xxxx
    return limitedNumbers
      .replace(/(\d{2})(\d{0,4})/, '($1) $2')
      .replace(/(\d{4})(\d{0,4})/, '$1-$2')
      .replace(/-$/, '');
  } else {
    // Celular: (xx) xxxxx-xxxx
    return limitedNumbers
      .replace(/(\d{2})(\d{0,5})/, '($1) $2')
      .replace(/(\d{5})(\d{0,4})/, '$1-$2')
      .replace(/-$/, '');
  }
}

/**
 * Valida se o número de telefone está completo
 * @param value - Valor a ser validado
 * @returns true se o número está completo (10 ou 11 dígitos)
 */
export function isValidPhone(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 10 || numbers.length === 11;
}

/**
 * Remove formatação do telefone, deixando apenas números
 * @param value - Valor formatado
 * @returns Apenas os números
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata telefone para exibição (apenas visualização)
 * @param value - Valor a ser formatado
 * @returns Número formatado ou mensagem padrão se vazio
 */
export function displayPhone(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  return formatPhone(value);
}
