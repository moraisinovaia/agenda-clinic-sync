

# Corrigir Botao "Instalar App" para Usar Branding Dinamico

## Problema

O componente `InstallButton.tsx` tem o texto **hardcoded** "Instalar INOVAIA" no alert de fallback (linha 96). Quando acessado pelo dominio GT INOVA, o texto deveria dizer "Instalar GT INOVA".

## Solucao

Usar o hook `usePartnerBranding()` (que ja existe no projeto) para obter o nome correto do parceiro e exibi-lo dinamicamente no alert.

## Alteracoes

### Arquivo: `src/components/InstallButton.tsx`

1. Importar o hook `usePartnerBranding` no topo do arquivo
2. Dentro do componente, chamar `const { partnerName } = usePartnerBranding();`
3. Substituir o texto fixo do alert (linha 96) para usar `partnerName`:

**Antes:**
```
alert('Para instalar o app:\n\n1. Chrome/Edge: Menu > Instalar INOVAIA\n2. Firefox: ...');
```

**Depois:**
```
alert(`Para instalar o app:\n\n1. Chrome/Edge: Menu > Instalar ${partnerName}\n2. Firefox: ...');
```

4. Tambem atualizar o `title` do botao (linha 109) para usar o nome do parceiro.

## Sobre o prompt nativo nao aparecer

O Chrome so dispara o `beforeinstallprompt` em condicoes especificas (HTTPS, manifest valido, service worker, e o usuario ainda nao ter descartado o prompt). No dominio de producao (`gt.inovaia-automacao.com.br`), o manifest GT INOVA ja esta configurado corretamente via script no `index.html`. O prompt nativo depende do navegador do usuario -- esta correcao garante que, quando o fallback for exibido, o nome correto apareca.

