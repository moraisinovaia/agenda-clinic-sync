

# Corrigir Ultima Referencia Hardcoded de "INOVAIA"

## Problema

Um unico local restante exibe "INOVAIA" fixo em contexto visivel ao usuario:

**`src/components/alerts/AlertSystem.tsx` (linha 161)** — A mensagem de teste de alertas envia: "Este e um teste do sistema de alertas da INOVAIA". Esse texto aparece no email quando o admin clica em "Testar Alerta".

## Alteracao

Substituir a string fixa pela deteccao de hostname, igual ao padrao ja usado nos outros arquivos:

**Antes:**
```text
message: `Este é um teste do sistema de alertas da INOVAIA. O sistema está funcionando corretamente!`
```

**Depois:**
```text
const systemName = window.location.hostname.toLowerCase().includes('gt.inovaia') ? 'GT INOVA' : 'INOVAIA';
message: `Este é um teste do sistema de alertas da ${systemName}. O sistema está funcionando corretamente!`
```

## Arquivo alterado

1. `src/components/alerts/AlertSystem.tsx` — mensagem de teste dinamica

## Resultado

Apos esta correcao, nao havera mais nenhuma referencia hardcoded de "INOVAIA" visivel ao usuario no dominio GT INOVA.

