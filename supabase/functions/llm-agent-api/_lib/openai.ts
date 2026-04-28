// OpenAI Chat Completions caller for Supabase Edge Functions (Deno).
// Uses fetch() directly — no npm dependency.

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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

export async function chatCompletion(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurado');

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

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText}`);
  }

  const data = await response.json();

  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenAI retornou conteúdo vazio');

  return {
    content,
    usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
