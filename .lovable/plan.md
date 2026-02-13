
# Corrigir logo e identidade visual por dominio (GT INOVA vs INOVAIA)

## Problema

Ao acessar `gt.inovaia-automacao.com.br`, o dashboard mostra a logo da INOVAIA em vez da GT INOVA. Isso acontece por dois motivos:

1. **Race condition no cache de branding**: O `useClinicBranding` faz cache do resultado usando apenas `clienteId` como chave. Se a consulta ao banco resolve antes do `usePartnerBranding` carregar, o logo do parceiro ainda esta com o valor default (INOVAIA). O resultado errado e cacheado e nunca corrigido.

2. **Favicon e titulo da aba estaticos**: O `index.html`, `manifest.json` e favicon estao hardcoded como "INOVAIA". Nao ha logica dinamica para atualizar esses elementos com base no dominio.

## Solucao

### 1. Corrigir race condition no `useClinicBranding`

Incluir `partnerLogoSrc` na chave do cache para invalidar quando o parceiro muda. Tambem ignorar execucao enquanto o partner branding ainda esta carregando.

**Arquivo**: `src/hooks/useClinicBranding.ts`
- Mudar chave do cache para `clienteId + partnerLogoSrc`
- Adicionar dependencia de `isLoading` do partner branding para so executar depois que o parceiro for detectado

### 2. Criar hook `useDynamicBranding` para favicon e titulo

Novo hook que atualiza dinamicamente o `<title>`, o favicon (`<link rel="icon">`), e o `<link rel="apple-touch-icon">` com base no parceiro detectado.

**Novo arquivo**: `src/hooks/useDynamicPageBranding.ts`
- Quando parceiro = GT INOVA: titulo "GT INOVA - Solucoes Inovadoras", favicon da GT INOVA
- Quando parceiro = INOVAIA: titulo "INOVAIA - Sistema de Agendamentos", favicon da INOVAIA
- Atualiza `document.title` e os elementos `<link>` no `<head>` via DOM

### 3. Integrar o hook no App

**Arquivo**: `src/App.tsx` ou `src/pages/Index.tsx`
- Chamar `useDynamicPageBranding()` para que o titulo e favicon sejam atualizados assim que o parceiro for detectado

### 4. Adicionar icone GT INOVA ao diretorio publico

Para que o favicon funcione, a logo da GT INOVA precisa estar disponivel como arquivo estatico em `public/`.

- Copiar `src/assets/gt-inova-logo-new.jpeg` para `public/gt-inova-icon.jpeg`

## Resultado esperado

- Dashboard em `gt.inovaia-automacao.com.br` mostra logo GT INOVA (nao INOVAIA)
- Aba do navegador mostra "GT INOVA - Solucoes Inovadoras" e icone GT INOVA
- Dashboard em `inovaia-automacao.com.br` continua mostrando logo e titulo INOVAIA
- Cache de branding funciona corretamente sem race conditions
