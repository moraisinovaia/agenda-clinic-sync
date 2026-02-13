

# Substituir Referencias Hardcoded de "INOVAIA" por Branding Dinamico

## Problema

Tres locais visiveis ao usuario ainda exibem "INOVAIA" de forma fixa, mesmo no dominio GT INOVA:

1. **Tela de loading** (`src/pages/Index.tsx`, linha 575) -- exibe "INOVAIA" enquanto os dados carregam
2. **Tela de erro global** (`src/components/error/GlobalErrorBoundary.tsx`, linha 93) -- exibe "sistema INOVAIA" na mensagem de erro
3. **Alerta de sistema fora do ar** (`src/hooks/useAlertSystem.ts`, linha 128) -- envia email mencionando "O sistema INOVAIA"

## Alteracoes

### 1. `src/pages/Index.tsx` (linha 575)

Usar o hook `usePartnerBranding` (ou `useClinicBranding` que ja esta disponivel no componente) para exibir o nome correto na tela de loading.

**Antes:** `<p className="text-lg font-medium">INOVAIA</p>`
**Depois:** `<p className="text-lg font-medium">{partnerName}</p>` (usando o valor do hook)

Como o loading screen aparece antes de dados carregarem, o hook `usePartnerBranding` e o ideal aqui (detecta pelo hostname, sem depender do banco).

### 2. `src/components/error/GlobalErrorBoundary.tsx` (linha 93)

Este componente e um Class Component (Error Boundary), entao nao pode usar hooks. A solucao e usar a deteccao de hostname diretamente:

**Antes:** `Encontramos um erro inesperado no sistema INOVAIA.`
**Depois:** Detectar o hostname inline e exibir o nome correto:

```text
const systemName = window.location.hostname.toLowerCase().includes('gt.inovaia') ? 'GT INOVA' : 'INOVAIA';
// Na mensagem:
`Encontramos um erro inesperado no sistema ${systemName}.`
```

### 3. `src/hooks/useAlertSystem.ts` (linha 128)

Substituir a string fixa pela deteccao de hostname (ja que hooks customizados nao podem ser usados dentro de useCallback facilmente):

**Antes:** `'O sistema INOVAIA está apresentando problemas...'`
**Depois:** Usar deteccao simples de hostname ou receber o nome do parceiro como parametro.

## Arquivos alterados

1. `src/pages/Index.tsx` -- loading screen dinamico
2. `src/components/error/GlobalErrorBoundary.tsx` -- mensagem de erro dinamica
3. `src/hooks/useAlertSystem.ts` -- alerta de email dinamico

