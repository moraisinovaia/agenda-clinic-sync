
# Corrigir Preview do WhatsApp para GT INOVA

## Problema

Ao compartilhar o link `gt.inovaia-automacao.com.br` no WhatsApp, o preview mostra "INOVAIA" com o logo errado porque:

1. As meta tags Open Graph (`og:title`, `og:image`) estao definidas DEPOIS do script de deteccao no `index.html`, entao o script nao consegue modifica-las (os elementos ainda nao existem no DOM)
2. Crawlers do WhatsApp/redes sociais NAO executam JavaScript — eles leem apenas o HTML estatico

## Solucao

Corrigir em duas etapas:

### Etapa 1 — Mover meta tags OG para ANTES do script (correcao imediata)

Reorganizar o `index.html` para que as meta tags OG fiquem antes do script de deteccao. Isso resolve o problema para navegadores que executam o JS.

**Ordem atual (incorreta):**
```text
<title>INOVAIA...</title>
<meta description>
<script>  (tenta mudar og:title, mas ele ainda nao existe)  </script>
<meta og:title>  (definido tarde demais)
```

**Ordem corrigida:**
```text
<title>INOVAIA...</title>
<meta description>
<meta og:title>   (agora existe antes do script)
<meta og:image>
<meta twitter:*>
<script>  (agora consegue encontrar e mudar as tags)  </script>
```

### Etapa 2 — Edge Function "og-proxy" para crawlers (solucao definitiva)

Criar uma Edge Function que detecta user-agents de crawlers (WhatsApp, Facebook, Twitter, Telegram) e retorna HTML minimo com as meta tags corretas do parceiro. Para requisicoes normais, redireciona para o site.

Porem, essa etapa requer configuracao de proxy no DNS/Cloudflare do dominio `gt.inovaia-automacao.com.br` para direcionar crawlers para a Edge Function, o que esta fora do escopo do Lovable.

**Para esta implementacao, faremos apenas a Etapa 1**, que ja resolve o problema para usuarios que abrem o link (verao o titulo e icone corretos) e corrige o script que hoje nao funciona.

## Arquivo alterado

1. `index.html` — mover os blocos de meta OG e Twitter para antes do script de deteccao

## Resultado esperado

- O script de branding passara a funcionar corretamente para usuarios que visitam o site
- O titulo da aba, favicon, manifest e meta tags serao atualizados para "GT INOVA" no dominio correto
- Para o preview do WhatsApp especificamente: como crawlers nao executam JS, o preview ainda mostrara o default (INOVAIA). Para resolver isso definitivamente, seria necessario um proxy server-side (Cloudflare Worker ou similar) no dominio `gt.inovaia-automacao.com.br`, o que e uma configuracao de infraestrutura fora do Lovable
