

# Correcao: Usuario GT INOVA bloqueado no proprio dominio

## Causa raiz

A query `supabase.from('clientes').select('parceiro').eq('id', clienteId)` no `useDomainPartnerValidation` esta falhando silenciosamente. O campo parceiro aparece **vazio** na tela de erro (visivel na screenshot).

### Por que a query falha

Todas as politicas RLS da tabela `clientes` sao do tipo **RESTRICTIVE** (Permissive: No). No PostgreSQL, se nao existe nenhuma politica PERMISSIVE, o resultado base eh FALSE, e qualquer RESTRICTIVE AND FALSE = FALSE. Resultado: **acesso sempre negado**, independente das condicoes.

Politicas atuais (todas RESTRICTIVE):
- "Admins can manage clientes" - ALL
- "Approved users can view clientes" - SELECT
- "Super admin can access all clientes" - ALL
- "Users can read own clinic data" - SELECT

### Por que o login parece funcionar

No Auth.tsx (linhas 181-183), o `catch` apenas loga o erro e continua:
```text
} catch (validationError) {
    console.error('Erro na validacao de dominio:', validationError);
    // NAO bloqueia - permite o login continuar
}
```

O toast "Login realizado com sucesso!" aparece. Mas depois o `DomainGuard` roda a mesma query, falha novamente, `userPartner=null`, `isAuthorized=false` -- bloqueado.

## Solucao

### 1. Corrigir RLS da tabela `clientes`

Alterar a politica "Users can read own clinic data" de RESTRICTIVE para **PERMISSIVE**. Isso permite que usuarios aprovados leiam os dados da propria clinica.

```text
SQL a executar:
DROP POLICY IF EXISTS "Users can read own clinic data" ON clientes;
CREATE POLICY "Users can read own clinic data" ON clientes
  FOR SELECT
  USING (id = get_user_cliente_id());
-- Por padrao, CREATE POLICY cria como PERMISSIVE
```

Tambem alterar "Approved users can view clientes" para PERMISSIVE:
```text
DROP POLICY IF EXISTS "Approved users can view clientes" ON clientes;
CREATE POLICY "Approved users can view clientes" ON clientes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.status::text = 'aprovado'::text
    )
  );
```

### 2. Corrigir o catch silencioso no Auth.tsx

No `handleLogin`, se a validacao de parceiro falha (query ao banco falhou), **bloquear o login** em vez de permitir silenciosamente:

```text
Antes:
  catch (validationError) {
    console.error('Erro na validacao:', validationError);
    // continua e permite login
  }

Depois:
  catch (validationError) {
    console.error('Erro na validacao:', validationError);
    await supabase.auth.signOut();
    setError('Erro ao validar permissoes de dominio. Tente novamente.');
    setIsLoading(false);
    return;
  }
```

### 3. Melhorar tratamento de erro no DomainGuard

Quando `userPartner` eh null mas `clienteId` existe, mostrar mensagem mais util em vez de "parceiro vazio":

```text
No AuthGuard.tsx, DomainGuard:
  Se userPartner eh null e clienteId existe:
    mostrar "Erro ao verificar permissoes. Tente fazer login novamente."
    com botao de logout
  Se userPartner existe mas diferente de domainPartner:
    mostrar mensagem atual de mismatch
```

## Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| Supabase SQL | Recriar 2 politicas RLS como PERMISSIVE |
| `src/pages/Auth.tsx` | Bloquear login quando validacao falha |
| `src/components/AuthGuard.tsx` | Mensagem de erro melhorada para userPartner null |

## Resultado esperado

1. RLS permite leitura de `clientes.parceiro` por usuarios aprovados
2. OLHOS (GT INOVA) acessa `gt.inovaia-automacao.com.br` normalmente
3. Usuarios INOVAIA continuam bloqueados no dominio GT INOVA
4. Erros de query nao sao mais engolidos silenciosamente

