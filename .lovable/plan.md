
# Corrigir Cloudflare Worker para Preview do WhatsApp

## Diagnostico

O Facebook Sharing Debugger mostra **codigo 421 "Project not found"** ao acessar `https://gt.inovaia-automacao.com.br/`. Isso indica que o Cloudflare Worker esta interceptando a requisicao mas nao tem codigo correto para responder.

A Edge Function `og-metadata` do Supabase esta funcionando corretamente. O problema esta **no Cloudflare Worker**.

## O que precisa ser feito (fora do Lovable)

### 1. Codigo do Cloudflare Worker

No painel do Cloudflare, clique em **"Edit code"** no Worker `gtinovaia-automacaocombr` e cole este codigo:

```javascript
const EDGE_FUNCTION_URL = "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/og-metadata";
const LOVABLE_ORIGIN = "https://agenda-clinic-sync.lovable.app";

const CRAWLER_PATTERNS = [
  "WhatsApp", "facebookexternalhit", "Twitterbot", "TelegramBot",
  "LinkedInBot", "Slackbot", "Discordbot", "Googlebot", "bingbot",
  "Facebot", "Facebookbot"
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some(p => userAgent.includes(p));
}

export default {
  async fetch(request) {
    const userAgent = request.headers.get("user-agent") || "";
    const url = new URL(request.url);

    // Se for crawler, buscar meta tags da Edge Function
    if (isCrawler(userAgent)) {
      const edgeUrl = `${EDGE_FUNCTION_URL}?domain=gt.inovaia-automacao.com.br`;
      const edgeResponse = await fetch(edgeUrl, {
        headers: { "user-agent": userAgent }
      });
      return new Response(await edgeResponse.text(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    // Para usuarios normais, fazer proxy para o Lovable
    const lovableUrl = `${LOVABLE_ORIGIN}${url.pathname}${url.search}`;
    const response = await fetch(lovableUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined
    });

    // Retornar a resposta do Lovable
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  }
};
```

### 2. Deploy do Worker

Apos colar o codigo, clique em **"Save and Deploy"** no editor do Cloudflare.

### 3. Verificar a rota

Na aba Settings do Worker, confirme que a rota esta como:
- **Route:** `https://gt.inovaia-automacao.com.br/*` (com `/*` no final para capturar todas as paginas)

### 4. Testar

Apos o deploy do Worker:
1. Acesse o [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. Cole `https://gt.inovaia-automacao.com.br`
3. Clique em "Depurar" e depois "Extrair novamente"
4. Deve aparecer **"GT INOVA - Solucoes Inovadoras"** com o icone correto

## Mudancas no Lovable

### Atualizar a Edge Function `og-metadata`

Uma pequena melhoria: garantir que a `og:image` use uma URL absoluta publica que o crawler consiga acessar, apontando para o dominio do Lovable (onde as imagens estao hospedadas):

No arquivo `supabase/functions/og-metadata/index.ts`, alterar a logica de `og:image` para usar o URL publico do Lovable em vez do dominio do parceiro (que depende do Worker para servir assets):

```
og:image -> https://agenda-clinic-sync.lovable.app/gt-inova-icon-512.png
```

Isso garante que o crawler sempre consiga baixar a imagem, independente da configuracao do Worker.

## Resumo

| Onde | O que fazer |
|------|------------|
| **Cloudflare** | Colar o codigo do Worker acima e fazer deploy |
| **Cloudflare** | Verificar que a rota inclui `/*` |
| **Lovable** | Atualizar `og:image` na Edge Function para URL absoluta do Lovable |
| **Teste** | Usar Facebook Sharing Debugger para validar |
