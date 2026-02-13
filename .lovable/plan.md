

# Eliminar flash de branding INOVAIA no dominio GT INOVA

## Problema

O `index.html` tem titulo e favicon hardcoded como "INOVAIA". O React so atualiza esses valores depois de montar, carregar o hook `usePartnerBranding`, e fazer a query ao banco. Isso causa um flash visivel de "INOVAIA" antes de trocar para "GT INOVA".

O mesmo problema ocorre no dashboard: o componente `DashboardHeader` mostra o logo default (INOVAIA) enquanto o `useClinicBranding` ainda esta carregando.

## Solucao

### 1. Script inline no `index.html` para deteccao instantanea por hostname

Adicionar um `<script>` sincrono no `<head>` do `index.html` que verifica o hostname e atualiza titulo e favicon ANTES do React carregar. Isso elimina o flash completamente para a aba do navegador.

```javascript
// Executa antes de qualquer render
(function() {
  var h = location.hostname.toLowerCase();
  if (h.indexOf('gt.inovaia') !== -1) {
    document.title = 'GT INOVA - Soluções Inovadoras';
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = '/gt-inova-icon.jpeg';
    var apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (apple) apple.href = '/gt-inova-icon.jpeg';
  }
})();
```

**Arquivo**: `index.html` - adicionar script sincrono apos as tags `<link>`

### 2. Tela de loading no DashboardHeader enquanto branding carrega

No `DashboardHeader`, verificar o `isLoading` do `useClinicBranding` e mostrar um skeleton/placeholder em vez do logo e nome enquanto o branding ainda nao foi resolvido. Isso evita o flash visual do logo errado no dashboard.

**Arquivo**: `src/components/dashboard/DashboardHeader.tsx` - adicionar estado de loading com skeleton

### 3. Tela de loading na pagina Auth

Na pagina de login (`Auth.tsx`), o logo do parceiro tambem pode piscar. Verificar se o `usePartnerBranding` ja tem `isLoading` e exibir um spinner ou skeleton ate o branding carregar.

**Arquivo**: `src/pages/Auth.tsx` - verificar se ja trata o loading do partner branding

## Resultado esperado

- Ao abrir `gt.inovaia-automacao.com.br`, a aba do navegador ja mostra "GT INOVA" e o icone correto instantaneamente (sem flash)
- O dashboard mostra um loading sutil ate o branding resolver, depois exibe o logo correto
- A tela de login tambem espera o branding antes de exibir o logo
- Nenhuma mudanca no dominio INOVAIA (continua funcionando normalmente)

