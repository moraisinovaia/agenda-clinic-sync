
# Fase 2: Validacao de API Key nas 9 Edge Functions do n8n

## O que sera feito

Adicionar validacao de `x-api-key` header em 9 edge functions, usando o secret `N8N_API_KEY` que ja existe no Supabase.

## Alteracoes por funcao

### 1. `llm-agent-api` (6755 linhas)
- **CORS** (linha 7): Adicionar `x-api-key` ao `Access-Control-Allow-Headers`
- **Validacao** (linha 1615, apos CORS preflight e antes do `try`): Inserir bloco de verificacao de API key

### 2. `llm-agent-api-venus` (~120 linhas)
- **CORS**: Ja nao inclui `x-api-key`, adicionar
- **Validacao**: Apos CORS preflight, antes do `try`

### 3. `llm-agent-api-orion` (~100 linhas)
- Mesmo padrao que Venus

### 4. `llm-agent-api-olhos` (~110 linhas)
- Mesmo padrao que Olhos (CORS ja tem headers extras, adicionar `x-api-key`)

### 5. `llm-agent-api-marcelo` (~183 linhas)
- Mesmo padrao (CORS ja tem headers extras, adicionar `x-api-key`)

### 6. `scheduling-api` (80 linhas)
- **CORS**: Adicionar `x-api-key`
- **Validacao**: Apos CORS preflight

### 7. `whatsapp-availability` (190 linhas)
- **CORS**: Adicionar `x-api-key`
- **Validacao**: Apos CORS preflight

### 8. `fila-notificacao` (149 linhas)
- **CORS**: Adicionar `x-api-key`
- **Validacao**: Apos CORS preflight

### 9. `notificar-bloqueio` (364 linhas)
- **CORS**: Adicionar `x-api-key`
- **Validacao**: Apos CORS preflight na `serve()` (linha 109)

## Codigo padrao inserido em cada funcao

```text
// Validar API Key
const apiKey = req.headers.get('x-api-key');
const expectedApiKey = Deno.env.get('N8N_API_KEY');
if (!apiKey || apiKey !== expectedApiKey) {
  console.error('Unauthorized: Invalid or missing API key');
  return new Response(
    JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## CORS atualizado

Cada funcao tera `x-api-key` adicionado ao header `Access-Control-Allow-Headers`:

```text
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key'
```

## Risco

**Zero** - conforme confirmado pelo usuario, nao ha workflows n8n ativos. Nenhuma clinica sera afetada.

## Nota para o futuro

Quando o n8n for configurado, todos os HTTP Request nodes devem incluir:
- Header: `x-api-key`
- Valor: o mesmo valor do secret `N8N_API_KEY` no Supabase
