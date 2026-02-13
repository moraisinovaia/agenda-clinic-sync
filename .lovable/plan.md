

# Corrigir branding do PWA para GT INOVA

## Problema

O arquivo `manifest.json` esta hardcoded com nome "INOVAIA". Quando o usuario instala o app como PWA no dominio GT INOVA, o navegador usa o manifest para definir o nome do aplicativo na barra de titulo. O resultado e a combinacao errada: "INOVAIA - Sistema de Agendamentos - GT INOVA - Solucoes Inovadoras".

## Solucao

### 1. Criar manifest separado para GT INOVA

Criar `public/manifest-gt-inova.json` com branding GT INOVA:
- `name`: "GT INOVA - Solucoes Inovadoras"
- `short_name`: "GT INOVA"
- `description`: "GT INOVA - Solucoes Inovadoras"
- `theme_color`: cor adequada ao GT INOVA
- `icons`: apontando para `/gt-inova-icon.jpeg`

### 2. Trocar o manifest dinamicamente no `index.html`

No script inline que ja existe no `<head>`, adicionar logica para trocar o `href` do `<link rel="manifest">` para `/manifest-gt-inova.json` quando o hostname contem `gt.inovaia`.

```text
Antes (hardcoded):
  <link rel="manifest" href="/manifest.json" />

Depois (dinamico no script existente):
  if (hostname contem 'gt.inovaia') {
    // troca titulo, favicon (ja feito)
    // + troca manifest
    document.querySelector('link[rel="manifest"]').href = '/manifest-gt-inova.json';
  }
```

## Detalhes tecnicos

- **Arquivo novo**: `public/manifest-gt-inova.json` - copia do manifest atual com branding GT INOVA
- **Arquivo editado**: `index.html` - adicionar troca do manifest no script inline existente
- **Nenhum arquivo React e alterado** - a mudanca e puramente no nivel de arquivos estaticos

## Resultado esperado

- Ao instalar o PWA em `gt.inovaia-automacao.com.br`, o app mostra "GT INOVA - Solucoes Inovadoras" na barra de titulo e o icone correto
- Ao instalar no dominio INOVAIA, continua mostrando "INOVAIA - Sistema de Agendamentos"

