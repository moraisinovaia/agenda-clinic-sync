// ============= FUZZY MATCHING DE NOMES DE MÉDICOS =============

export const STOPWORDS_MEDICO = new Set(['dr', 'dra', 'de', 'da', 'do', 'dos', 'das', 'e', 'o', 'a']);

export function normalizarTexto(texto: string): string {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extrairPalavrasSignificativas(textoNormalizado: string): string[] {
  return textoNormalizado.split(' ').filter(p => p.length > 1 && !STOPWORDS_MEDICO.has(p));
}

export function fuzzyMatchMedicos<T extends { nome: string }>(nomeInput: string, medicos: T[]): T[] {
  const inputNorm = normalizarTexto(nomeInput);

  // 1) Match exato por includes (lógica original)
  const exatos = medicos.filter(m => {
    const n = normalizarTexto(m.nome);
    return n.includes(inputNorm) || inputNorm.includes(n);
  });
  if (exatos.length > 0) return exatos;

  // 2) Fuzzy: score por palavras significativas em comum
  const palavrasInput = extrairPalavrasSignificativas(inputNorm);
  if (palavrasInput.length === 0) return [];

  const scored = medicos.map(m => {
    const palavrasMedico = extrairPalavrasSignificativas(normalizarTexto(m.nome));
    if (palavrasMedico.length === 0) return { medico: m, score: 0 };

    // Contar palavras do input que aparecem (parcial) em alguma palavra do médico e vice-versa
    let matchCount = 0;
    for (const pi of palavrasInput) {
      for (const pm of palavrasMedico) {
        if (pi.includes(pm) || pm.includes(pi)) { matchCount++; break; }
      }
    }
    const score = matchCount / Math.min(palavrasInput.length, palavrasMedico.length);
    return { medico: m, score };
  });

  const threshold = 0.5;
  const matches = scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(s => s.medico);

  if (matches.length > 0) {
    console.log(`🔍 Fuzzy match: "${nomeInput}" → "${matches[0].nome}" (${scored.find(s => s.medico === matches[0])?.score.toFixed(2)})`);
  }
  return matches;
}

/**
 * Formata convênio para o padrão do banco de dados (MAIÚSCULO)
 * Remove hífens/underscores e espaços extras
 * Exemplos:
 * - "unimed nacional" → "UNIMED NACIONAL"
 * - "UNIMED-REGIONAL" → "UNIMED REGIONAL"
 * - "unimed 40%" → "UNIMED 40%"
 * - "Particular" → "PARTICULAR"
 */
export function formatarConvenioParaBanco(convenio: string): string {
  if (!convenio) return convenio;

  // Limpar e normalizar: remover hífens/underscores, espaços extras, converter para MAIÚSCULO
  const limpo = convenio
    .trim()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase(); // ✅ MAIÚSCULO para evitar problemas de case-sensitivity

  console.log(`📝 Convênio formatado: "${convenio}" → "${limpo}"`);
  return limpo;
}
