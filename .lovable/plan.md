

# Corrigir detecção de parceiro GT INOVA

## Problema
O hostname `gt.inovaia-automacao.com.br` contém a string `inovaia`, que e o `domain_pattern` do parceiro INOVAIA. Como o codigo usa `data.find()` (retorna o primeiro match), o INOVAIA e encontrado antes do GT INOVA, exibindo a logo errada.

## Solucao
Alterar a logica de matching em `src/hooks/usePartnerBranding.ts` para priorizar o match mais especifico (pattern mais longo). Assim, `gt.inovaia-automacao` (16 caracteres) vence `inovaia` (7 caracteres).

## Arquivo alterado
`src/hooks/usePartnerBranding.ts`

## Mudanca tecnica
Substituir:
```typescript
const matched = data.find(p => hostname.includes(p.domain_pattern));
```

Por:
```typescript
const matches = data.filter(p => hostname.includes(p.domain_pattern));
const matched = matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length)[0];
```

Isso filtra todos os patterns que aparecem no hostname e escolhe o mais longo (mais especifico), garantindo que `gt.inovaia-automacao` tenha prioridade sobre `inovaia`.

