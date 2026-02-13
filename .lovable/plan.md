

# Resolver Preview do WhatsApp para GT INOVA (Solucao Server-Side)

## O Problema Real

O WhatsApp, Facebook, Telegram e outros apps **nao executam JavaScript** ao gerar previews de links. Eles leem apenas o HTML estatico. Por isso, nao importa quantas vezes reorganizemos o `index.html` -- o crawler sempre vera as meta tags estaticas com "INOVAIA".

## A Solucao: Edge Function "og-metadata"

Criar uma Edge Function no Supabase que, ao receber uma requisicao, verifica:
- Se o **user-agent** e de um crawler (WhatsApp, Facebook, Telegram, Twitter)
- Se sim, retorna um HTML minimo com as meta tags corretas do parceiro
- Se nao, redireciona para o site normalmente

### Como vai funcionar

```text
Link compartilhado: gt.inovaia-automacao.com.br
        |
        v
  [Proxy/DNS redireciona para Edge Function]
        |
        v
  Edge Function verifica User-Agent
        |
   Crawler?  ----SIM----> Retorna HTML com meta tags "GT INOVA"
        |
       NAO
        |
        v
  Redireciona para o site normal
```

## Implementacao

### 1. Criar Edge Function `og-metadata`

Arquivo: `supabase/functions/og-metadata/index.ts`

A funcao vai:
- Receber o hostname da requisicao (via header `Host` ou query param `domain`)
- Consultar a tabela `partner_branding` para obter nome, subtitulo e logo do parceiro
- Verificar se o user-agent e de um crawler
- Se for crawler: retornar HTML minimo com meta tags OG corretas
- Se nao for crawler: redirecionar (302) para o site

Lista de user-agents de crawlers a detectar:
- `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `LinkedInBot`, `Slackbot`, `Discordbot`

HTML retornado para crawlers (exemplo):
```html
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="GT INOVA - Solucoes Inovadoras" />
  <meta property="og:description" content="GT INOVA - Solucoes Inovadoras" />
  <meta property="og:image" content="https://gt.inovaia-automacao.com.br/gt-inova-icon-512.png" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://gt.inovaia-automacao.com.br" />
</head>
<body></body>
</html>
```

### 2. Configuracao no `supabase/config.toml`

Desabilitar JWT para que crawlers possam acessar sem autenticacao:

```toml
[functions.og-metadata]
verify_jwt = false
```

## Limitacao Importante

A Edge Function estara disponivel em:
`https://<project-id>.supabase.co/functions/v1/og-metadata`

Para que o WhatsApp use essa URL ao acessar `gt.inovaia-automacao.com.br`, voce precisa configurar um **proxy reverso** no DNS/Cloudflare do dominio. Isso e uma configuracao de infraestrutura **fora do Lovable** que envolve:

- Criar um Cloudflare Worker (ou regra de Page Rules) no dominio `gt.inovaia-automacao.com.br`
- Detectar crawlers pelo user-agent
- Redirecionar crawlers para a Edge Function do Supabase
- Deixar usuarios normais acessarem o site diretamente

Sem essa configuracao de proxy, a Edge Function existira mas nao sera chamada automaticamente pelos crawlers.

## Alternativa Mais Simples (sem proxy)

Se configurar o proxy for complexo demais, uma alternativa e:
- Ao compartilhar links do GT INOVA, usar a URL da Edge Function diretamente (ex: `https://<project>.supabase.co/functions/v1/og-metadata?domain=gt.inovaia-automacao.com.br`)
- A Edge Function detecta o crawler e mostra as meta tags corretas, e redireciona usuarios normais para o site real

Essa abordagem funciona **sem nenhuma configuracao de DNS**, mas exige que os links compartilhados usem a URL da Edge Function.

## Arquivos a criar/editar

1. **Criar** `supabase/functions/og-metadata/index.ts` -- a Edge Function
2. **Editar** `supabase/config.toml` -- adicionar `verify_jwt = false`

## Resultado esperado

- Edge Function criada e deployada
- Ao acessar a URL da funcao com user-agent de crawler: retorna HTML com branding GT INOVA
- Ao acessar com navegador normal: redireciona para o site
- Preview do WhatsApp mostrara "GT INOVA - Solucoes Inovadoras" com o icone correto (quando o proxy estiver configurado ou quando o link da Edge Function for usado diretamente)

