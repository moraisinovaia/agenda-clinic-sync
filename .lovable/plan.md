

# Isolamento de Seguranca por Dominio/Parceiro

## Problema
Atualmente, qualquer usuario pode acessar qualquer dominio (ex: gt.inovaia-automacao.com.br) e logar com credenciais de outro parceiro (INOVAIA), vendo dados normalmente. O filtro por `cliente_id` via RLS isola clinicas, mas nao isola parceiros entre dominios.

## Cadeia de relacao existente
A relacao usuario-parceiro ja existe no banco:
```text
profiles.cliente_id --> clientes.id --> clientes.parceiro
```
Nao e necessario criar novas tabelas ou colunas.

## Solucao em 3 camadas

### Camada 1: Validacao pos-login no Auth.tsx
Apos o `signIn` retornar sucesso, antes de redirecionar:
1. Buscar o `parceiro` da clinica do usuario via `clientes` usando o `cliente_id` do perfil
2. Comparar com o `partnerName` detectado pelo `usePartnerBranding`
3. Se nao corresponder, exibir erro "Usuario nao autorizado neste dominio" e fazer `signOut()`
4. Dominios sem match (preview do Lovable, localhost) permitem qualquer parceiro (fallback INOVAIA)

### Camada 2: Validacao no AuthGuard
Adicionar a mesma verificacao no `AuthGuard` como segunda barreira:
1. Importar `usePartnerBranding`
2. Quando o perfil estiver carregado, buscar o `parceiro` da clinica do usuario
3. Se o parceiro do usuario nao corresponder ao dominio, mostrar tela de "Acesso negado - dominio incorreto" com botao de logout
4. Excepcao para super admins (que podem acessar de qualquer dominio)
5. Excepcao para dominios genericos (preview, localhost)

### Camada 3: Hook utilitario `useDomainPartnerValidation`
Criar um hook reutilizavel que:
- Recebe o `cliente_id` do perfil
- Busca o `parceiro` correspondente na tabela `clientes`
- Compara com o `partnerName` do `usePartnerBranding`
- Retorna `{ isAuthorized, partnerMismatch, isLoading, userPartner, domainPartner }`
- Trata dominios genericos como "qualquer parceiro permitido"

## Detalhes tecnicos

### Logica de dominio generico
Dominios que NAO fazem validacao de parceiro (permitem todos):
- `localhost`
- `lovable.app` (preview)
- Qualquer hostname que nao corresponda a nenhum `domain_pattern` na tabela

### Novo hook: `src/hooks/useDomainPartnerValidation.ts`
```text
Entradas: cliente_id (do perfil), partnerName (do usePartnerBranding)
Saida: { isAuthorized, isLoading, userPartner, domainPartner }

Logica:
1. Se partnerName == DEFAULT (INOVAIA) e hostname nao contem nenhum domain_pattern → autorizado (dominio generico)
2. Se cliente_id nulo → autorizado (perfil ainda carregando)
3. Buscar clientes.parceiro WHERE id = cliente_id
4. Comparar com partnerName
5. Se iguais → autorizado; se diferentes → NAO autorizado
```

### Alteracoes no Auth.tsx (handleLogin)
Apos `signIn` com sucesso:
```text
1. Buscar perfil do usuario (ja disponivel via useAuth)
2. Se perfil tem cliente_id, buscar clientes.parceiro
3. Se dominio e especifico (nao generico) E parceiro != partnerName:
   - signOut()
   - setError('Usuario nao autorizado neste dominio')
   - return
4. Caso contrario, prosseguir normalmente
```

### Alteracoes no AuthGuard.tsx
Adicionar verificacao apos a checagem de status aprovado:
```text
1. Usar useDomainPartnerValidation(profile?.cliente_id)
2. Se isLoading → mostrar spinner
3. Se !isAuthorized → mostrar tela de acesso negado com botao de logout
4. Se autorizado → renderizar children
```

### Fluxo de verificacao no signup
No formulario de cadastro, filtrar a lista de clinicas pelo parceiro do dominio:
- Se dominio = gt.inovaia-automacao, mostrar apenas clinicas com parceiro = 'GT INOVA'
- Se dominio generico, mostrar todas

## Arquivos a modificar/criar
| Arquivo | Acao |
|---------|------|
| `src/hooks/useDomainPartnerValidation.ts` | Criar (novo hook) |
| `src/pages/Auth.tsx` | Modificar handleLogin + filtrar clinicas no signup |
| `src/components/AuthGuard.tsx` | Adicionar validacao de dominio |
| `src/hooks/usePartnerBranding.ts` | Exportar funcao auxiliar para detectar dominio generico |

## Nao necessario
- Criar novas tabelas ou colunas no banco
- Alterar RLS policies (o filtro por cliente_id ja isola dados entre clinicas)
- Alterar edge functions

