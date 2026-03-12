

## Diagnóstico: Erro ao Criar Usuário

### Causa Raiz

O erro `"Database error saving new user"` ocorre porque o **username "TESTE" já existe** na tabela `profiles`. A tabela possui uma constraint `UNIQUE (username)`, e o trigger `handle_new_user` tenta inserir o novo profile com o mesmo username, causando uma violação de unicidade que faz o Supabase Auth retornar erro 500.

O profile existente:
- **Email**: moraisinovaia+teste@gmail.com
- **Username**: TESTE
- **Status**: aprovado
- **Clínica**: ENDOGASTRO (ID diferente)

### Problemas Identificados

1. **Validação client-side falha silenciosamente**: O código verifica se o username existe antes do signup (linha 252-265 do `useAuth.tsx`), mas usa `maybeSingle()` na tabela `profiles` que pode falhar por RLS (o usuário anônimo pode não ter permissão de SELECT) e o erro é ignorado com `catch`.

2. **Trigger sem tratamento de duplicatas**: O `handle_new_user` não faz `ON CONFLICT` na inserção, então qualquer violação de constraint causa falha total no signup.

3. **Mensagem de erro genérica**: O erro `"Database error saving new user"` não é mapeado para uma mensagem amigável sobre username duplicado.

### Plano de Correção

**1. Tornar o trigger resiliente a duplicatas**

Alterar o `handle_new_user` para usar `INSERT ... ON CONFLICT (username)` com tratamento adequado (ex: adicionar sufixo numérico ou reativar profile existente).

**2. Criar RPC para verificar username disponível**

Criar uma função `check_username_available(p_username TEXT)` com `SECURITY DEFINER` que retorne `true/false`, acessível pelo role `anon`. Isso resolve o problema de RLS impedindo a verificação client-side.

**3. Melhorar mensagem de erro no frontend**

Mapear o erro `"Database error saving new user"` para uma mensagem como `"Nome de usuário já está em uso. Escolha outro."` no `useAuth.tsx` e `Auth.tsx`.

### Detalhes Técnicos

**Migration SQL:**
- Criar RPC `check_username_available` (SECURITY DEFINER, acessível por anon)
- Atualizar trigger `handle_new_user` para tratar conflito de username (se já existe profile com mesmo username, verificar se é do mesmo user_id para reativar, caso contrário raise exception com mensagem clara)

**Frontend (`useAuth.tsx`):**
- Usar a nova RPC `check_username_available` em vez de query direta na tabela
- Adicionar mapeamento de erro para `"Database error saving new user"` sugerindo trocar username

**Frontend (`Auth.tsx`):**
- Adicionar mapeamento no `handleSignup` para o erro de database

