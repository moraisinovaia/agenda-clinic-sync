// OpenAI Chat Completions caller for Supabase Edge Functions (Deno).
// Uses fetch() directly — no npm dependency.

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Tempo máximo por tentativa antes de abortar a chamada à OpenAI.
// 25 s deixa margem confortável dentro do limite de 30 s da Edge Function
// e ainda permite uma 2ª tentativa caso a primeira sofra timeout.
export const REQUEST_TIMEOUT_MS = 25000;

// Status retentáveis: rate-limit, request-timeout do servidor e 5xx transitórios.
// 400/401/403/404 não são retentados — repetir não muda o resultado.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Mensagem mostrada ao paciente quando a OpenAI fica indisponível mesmo após o retry.
// Mantida em pt-BR e neutra: não cita OpenAI/sistema/falha técnica.
export const OPENAI_FALLBACK_MESSAGE =
  'Estou com instabilidade no momento e vou transferir o seu atendimento para um atendente humano. ' +
  'Por favor, aguarde um instante. 🙏';

/**
 * Erro lançado quando a OpenAI fica indisponível após o retry, ou quando a
 * configuração impede a chamada (ex.: OPENAI_API_KEY ausente).
 *
 * Why: o catch externo de handleChat usa `err.name === 'OpenAIUnavailableError'`
 * para decidir entre fallback humanizado vs. erro técnico genérico.
 */
export class OpenAIUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'OpenAIUnavailableError';
  }
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: OpenAIMessage[];
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
}

export interface ChatCompletionResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function fetchOnce(payload: unknown, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isTransientNetworkError(err: any): boolean {
  // AbortError (timeout) e TypeError (DNS/conexão) são considerados transitórios.
  return err?.name === 'AbortError' || err instanceof TypeError;
}

export async function chatCompletion(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new OpenAIUnavailableError('OPENAI_API_KEY não configurado');
  }

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  const payload = {
    model,
    messages: req.messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: req.jsonSchemaName,
        strict: false,   // flex para dados_coletados e dados_para_handler dinâmicos
        schema: req.jsonSchema,
      },
    },
  };

  // 1ª tentativa + no máximo 1 retry (apenas para falhas transitórias).
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetchOnce(payload, apiKey);

      if (response.ok) break;

      if (RETRYABLE_STATUS.has(response.status) && attempt === 1) {
        console.warn(`[OPENAI] Status ${response.status} na tentativa ${attempt}; retentando 1x...`);
        continue;
      }

      // Status não-retentável (ex.: 401) ou retry esgotado: lê corpo e desiste.
      const errText = await response.text();
      throw new OpenAIUnavailableError(
        `OpenAI ${response.status}: ${errText.slice(0, 200)}`,
      );
    } catch (err: any) {
      // Se já é OpenAIUnavailableError vindo do branch acima, re-lança direto.
      if (err instanceof OpenAIUnavailableError) throw err;

      lastError = err;
      if (isTransientNetworkError(err) && attempt === 1) {
        console.warn(`[OPENAI] Erro transitório (${err?.name ?? 'unknown'}) na tentativa ${attempt}; retentando 1x...`);
        continue;
      }

      throw new OpenAIUnavailableError(
        `Falha ao chamar OpenAI: ${err?.message ?? String(err)}`,
        err,
      );
    }
  }

  if (!response || !response.ok) {
    throw new OpenAIUnavailableError(
      `OpenAI indisponível após retry: ${(lastError as any)?.message ?? 'sem detalhes'}`,
      lastError,
    );
  }

  const data = await response.json();

  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new OpenAIUnavailableError('OpenAI retornou conteúdo vazio');
  }

  return {
    content,
    usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
