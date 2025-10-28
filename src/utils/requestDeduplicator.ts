const activeRequests = new Map<string, Promise<any>>();
const requestTimestamps = new Map<string, number>();

/**
 * Deduplica requisições simultâneas para evitar chamadas redundantes ao servidor
 * @param key Identificador único da requisição
 * @param requestFn Função que executa a requisição
 * @param ttl Tempo de vida do cache em milissegundos (padrão: 2000ms)
 * @returns Promise com o resultado da requisição
 */
export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = 2000
): Promise<T> {
  const now = Date.now();
  
  // Se já existe requisição ativa E não expirou
  if (activeRequests.has(key)) {
    const timestamp = requestTimestamps.get(key) || 0;
    if (now - timestamp < ttl) {
      console.log(`♻️ [DEDUPE] Reutilizando requisição: ${key}`);
      return activeRequests.get(key)!;
    }
  }
  
  console.log(`🆕 [DEDUPE] Nova requisição: ${key}`);
  
  // Criar nova requisição
  const promise = requestFn()
    .finally(() => {
      // Remover do cache após TTL
      setTimeout(() => {
        activeRequests.delete(key);
        requestTimestamps.delete(key);
        console.log(`🗑️ [DEDUPE] Cache expirado: ${key}`);
      }, ttl);
    });
  
  activeRequests.set(key, promise);
  requestTimestamps.set(key, now);
  
  return promise;
}

/**
 * Invalida manualmente o cache de uma requisição específica
 * @param key Identificador único da requisição a ser invalidada
 */
export function invalidateCache(key: string): void {
  activeRequests.delete(key);
  requestTimestamps.delete(key);
  console.log(`❌ [DEDUPE] Cache invalidado: ${key}`);
}

/**
 * Invalida todo o cache de requisições
 */
export function invalidateAllCache(): void {
  activeRequests.clear();
  requestTimestamps.clear();
  console.log(`🗑️ [DEDUPE] Todo cache invalidado`);
}
