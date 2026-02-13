

# Corrigir Instalacao PWA do GT INOVA

## Problema raiz

O GT INOVA nao e instalavel como PWA porque:
1. Usa um unico arquivo JPEG (`gt-inova-icon.jpeg`) declarado como 192x192 E 512x512 -- o Chrome rejeita icones com dimensoes incorretas
2. O formato JPEG nao e ideal para PWA (Chrome prefere PNG)
3. O Service Worker (`sw.js`) so pre-cacheia assets da INOVAIA, ignorando completamente os assets do GT INOVA

## Solucao

### Passo 1: Criar icones PNG com tamanhos corretos para GT INOVA

Voce precisa fornecer (ou eu posso gerar a partir do `gt-inova-icon.jpeg` existente):
- `public/gt-inova-icon-192.png` — 192x192 pixels, formato PNG
- `public/gt-inova-icon-512.png` — 512x512 pixels, formato PNG

Como o Lovable nao tem ferramentas de redimensionamento de imagem, a abordagem sera:
- Referenciar o JPEG existente mas com tamanhos declarados corretamente (se a imagem original for grande o suficiente)
- OU pedir ao usuario que faca upload de icones PNG nos tamanhos corretos

### Passo 2: Atualizar `public/manifest-gt-inova.json`

Trocar as referencias de icone para usar arquivos separados com tamanhos reais:

```text
"icons": [
  { "src": "/gt-inova-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/gt-inova-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/gt-inova-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/gt-inova-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

### Passo 3: Atualizar `public/sw.js`

Tornar o Service Worker ciente dos dois conjuntos de assets. O SW detectara o hostname e pre-cacheara os recursos corretos:

```text
const CACHE_NAME = 'app-v1.4';

const commonUrls = ['/'];

const inovaiaUrls = ['/manifest.json', '/icon-192.png', '/icon-512.png'];
const gtInovaUrls = ['/manifest-gt-inova.json', '/gt-inova-icon-192.png', '/gt-inova-icon-512.png'];

self.addEventListener('install', (event) => {
  const isGtInova = self.location.hostname.includes('gt.inovaia');
  const urlsToCache = [...commonUrls, ...(isGtInova ? gtInovaUrls : inovaiaUrls)];
  // ... resto igual
});
```

### Passo 4: Atualizar `index.html`

Ajustar o script inline para referenciar os novos icones PNG:

```text
if (h.indexOf('gt.inovaia') !== -1) {
  document.title = 'GT INOVA - Solucoes Inovadoras';
  var icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = '/gt-inova-icon-192.png';
  var apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (apple) apple.href = '/gt-inova-icon-192.png';
  var manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = '/manifest-gt-inova.json';
}
```

## Prerequisito do usuario

Antes de implementar, o usuario precisa fornecer OU confirmar que posso usar o `gt-inova-icon.jpeg` existente como base (neste caso, o sistema usara o JPEG mas com type correto e um unico tamanho, o que pode funcionar se a imagem for grande o suficiente). 

A melhor opcao e o usuario fazer upload de dois arquivos PNG: um de 192x192 e outro de 512x512 com o logo GT INOVA.

## Arquivos alterados

1. `public/manifest-gt-inova.json` — icones atualizados
2. `public/sw.js` — cache dinamico por dominio
3. `index.html` — referencias de icones atualizadas
4. (Novos) `public/gt-inova-icon-192.png` e `public/gt-inova-icon-512.png` — fornecidos pelo usuario

