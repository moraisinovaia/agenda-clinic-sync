

# Correcao do Bug: Race Condition na Validacao de Dominio/Parceiro

## Causa raiz identificada

O `usePartnerBranding` inicia com `partnerName: 'INOVAIA'` como valor DEFAULT (linha 20) enquanto a query ao banco ainda nao completou. Quando o usuario clica "Login", o `partnerName` ainda pode ser o default `'INOVAIA'` -- e nao `'GT INOVA'` (que so aparece apos a query ao `partner_branding` retornar).

Resultado: no dominio `gt.inovaia-automacao.com.br`, a validacao compara `userPartner='INOVAIA'` com `partnerName='INOVAIA'` (default) e autoriza indevidamente.

Segundo problema: no `useDomainPartnerValidation` (linha 65), a condicao `!userPartner` (null) retorna `isAuthorized = true`, permitindo acesso enquanto o parceiro do usuario ainda esta carregando.

## Correcoes necessarias

### 1. Auth.tsx -- Aguardar branding antes de validar

No `handleLogin`, apos login bem-sucedido, verificar se o branding ja carregou (`isLoading === false`). Se ainda estiver carregando, buscar o `partnerName` diretamente do banco em vez de confiar no estado do hook.

```text
Alteracao no handleLogin (linha ~148-175):
- Buscar partner_branding diretamente via query SQL no momento da validacao
- NAO depender do estado do hook usePartnerBranding (que pode estar desatualizado)
- Comparar hostname com domain_patterns da tabela diretamente
```

### 2. usePartnerBranding.ts -- Expor funcao sincrona de deteccao

Criar uma funcao async exportada `detectPartnerByHostname()` que faz a query ao banco e retorna o parceiro correto, sem depender de estado React:

```text
export async function detectPartnerByHostname(): Promise<string> {
  const hostname = window.location.hostname.toLowerCase();
  const { data } = await supabase
    .from('partner_branding')
    .select('partner_name, domain_pattern');
  
  if (!data) return 'INOVAIA';
  
  const matches = data.filter(p => hostname.includes(p.domain_pattern));
  const matched = matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length)[0];
  return matched?.partner_name || 'INOVAIA';
}
```

### 3. useDomainPartnerValidation.ts -- Corrigir logica de autorizacao

Remover a condicao `!userPartner` que autoriza quando o parceiro ainda nao foi buscado. Em vez disso, manter `isLoading = true` ate que ambos os valores (userPartner E partnerName) estejam disponiveis:

```text
Antes (bugado):
  isAuthorized = genericDomain || !clienteId || !userPartner || userPartner === partnerName

Depois (corrigido):
  isAuthorized = genericDomain || !clienteId || userPartner === partnerName
  (e isLoading = true enquanto userPartner === null E clienteId existe)
```

### 4. AuthGuard.tsx -- Aguardar branding carregado

No `DomainGuard`, verificar tambem se o branding do `usePartnerBranding` ja terminou de carregar antes de tomar decisao. Enquanto `isLoading` no branding, mostrar spinner.

### 5. Console.logs para debug

Adicionar logs em todos os pontos de validacao:
- `usePartnerBranding`: hostname, patterns encontrados, partnerName final
- `handleLogin` no Auth.tsx: parceiro do usuario, parceiro do dominio, resultado da comparacao
- `useDomainPartnerValidation`: todos os valores comparados e decisao final

## Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/usePartnerBranding.ts` | Adicionar `detectPartnerByHostname()` async + console.logs |
| `src/pages/Auth.tsx` | Usar `detectPartnerByHostname()` no handleLogin em vez do estado do hook + logs |
| `src/hooks/useDomainPartnerValidation.ts` | Corrigir logica `!userPartner` + aguardar branding carregado + logs |
| `src/components/AuthGuard.tsx` | Verificar `isLoading` do branding no DomainGuard |

## Resumo do fluxo corrigido

1. Usuario acessa `gt.inovaia-automacao.com.br` e faz login
2. `handleLogin` chama `detectPartnerByHostname()` (query direta ao banco)
3. Retorna `'GT INOVA'` (match mais longo: `gt.inovaia-automacao`)
4. Busca parceiro do usuario: `'INOVAIA'`
5. `'INOVAIA' !== 'GT INOVA'` -- bloqueado, signOut automatico
6. Mesmo se burlar o login, o AuthGuard/DomainGuard repete a verificacao como segunda barreira

