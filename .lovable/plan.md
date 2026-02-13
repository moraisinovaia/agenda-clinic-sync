

# Corrigir Flash de "INOVAIA" no Sistema GT INOVA

## Problema

Quando a pagina carrega ou recarrega no dominio GT INOVA, o nome "INOVAIA" aparece brevemente antes de trocar para "GT INOVA". Isso acontece por tres motivos:

1. **O hook `usePartnerBranding` inicia com estado padrao "INOVAIA"** -- enquanto a consulta ao banco esta em andamento, qualquer componente que use esse hook ve "INOVAIA"
2. **O hook `useDynamicPageBranding` sobrescreve o titulo correto** -- o script inline do `index.html` ja define o titulo correto ("GT INOVA"), mas quando o React monta, o hook redefine `document.title` para "INOVAIA" ate a consulta ao banco terminar
3. **As meta tags do `index.html` sao fixas em "INOVAIA"** -- `og:title`, `og:description`, `meta description` e `meta author` nunca sao atualizadas pelo script inline

## Solucao

### 1. Melhorar o script inline do `index.html` (Passo 1 - mais impactante)

Expandir o script inline para tambem atualizar as meta tags OG e description:

```text
<script>
(function() {
  var h = location.hostname.toLowerCase();
  if (h.indexOf('gt.inovaia') !== -1) {
    document.title = 'GT INOVA - Solucoes Inovadoras';
    // Favicon e manifest
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = '/gt-inova-icon-192.png';
    var apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (apple) apple.href = '/gt-inova-icon-192.png';
    var manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = '/manifest-gt-inova.json';
    // Meta tags
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = 'GT INOVA - Solucoes Inovadoras';
    var author = document.querySelector('meta[name="author"]');
    if (author) author.content = 'GT INOVA';
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = 'GT INOVA - Solucoes Inovadoras';
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = 'GT INOVA - Solucoes Inovadoras';
    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = '/gt-inova-icon-512.png';
    var twImage = document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.content = '/gt-inova-icon-512.png';
  }
})();
</script>
```

### 2. Usar deteccao de hostname como fallback inicial no `usePartnerBranding` (Passo 2 - elimina o flash)

O estado inicial do hook deve usar o hostname para definir um default inteligente em vez de sempre comecar com "INOVAIA":

```text
// Em usePartnerBranding.ts
function getInitialBranding(): PartnerBranding {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('gt.inovaia')) {
    return {
      partnerName: 'GT INOVA',
      logoSrc: gtInovaLogo,
      subtitle: 'Solucoes Inovadoras',
      isLoading: true,
    };
  }
  return DEFAULT_BRANDING; // INOVAIA como padrao
}

// No hook:
const [branding, setBranding] = useState<PartnerBranding>(getInitialBranding());
```

Isso garante que, mesmo antes da consulta ao banco, o estado inicial ja reflete o parceiro correto baseado no hostname. A consulta ao banco depois confirma e pode adicionar detalhes extras (logo_url do banco, subtitle personalizado).

### 3. Evitar sobrescrita do titulo no `useDynamicPageBranding` (Passo 3 - prevencao)

O hook `useDynamicPageBranding` nao deve rodar enquanto `isLoading` for true (ja faz isso), mas o estado inicial "INOVAIA" do hook causa o problema. Com a correcao do Passo 2, isso se resolve automaticamente, pois o estado inicial ja sera "GT INOVA" no dominio correto.

## Arquivos alterados

1. **`index.html`** -- expandir script inline para cobrir meta tags OG/description
2. **`src/hooks/usePartnerBranding.ts`** -- estado inicial inteligente baseado no hostname

## Resultado esperado

- Zero flash de "INOVAIA" no dominio GT INOVA
- Titulo, favicon, manifest, e meta tags corretos desde o primeiro frame
- Funcionalidade existente preservada (a consulta ao banco continua funcionando para parceiros futuros)

