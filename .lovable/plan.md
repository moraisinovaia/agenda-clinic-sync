

# Transferir Clinica Venus para GT INOVA

## O que sera feito

Atualizar o campo `parceiro` da Clinica Venus de **INOVAIA** para **GT INOVA** na tabela `clientes`, exatamente como foi feito com a Clinica Olhos.

## Dados atuais

| Clinica | ID | Parceiro atual |
|---|---|---|
| Clinica Olhos | d7d7b7cf-... | GT INOVA (ja transferida) |
| Clinica Venus | 20747f3c-... | INOVAIA |

## Alteracao

Uma unica operacao de UPDATE:

```sql
UPDATE clientes 
SET parceiro = 'GT INOVA', updated_at = now() 
WHERE id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';
```

## Impacto

- Usuarios da Clinica Venus so poderao acessar o sistema pelo dominio do GT INOVA (`gt.inovaia-automacao.com.br`) ou por dominios genericos (localhost, lovable.app)
- O branding exibido para usuarios da Venus sera o do GT INOVA (logo, titulo, favicon)
- A validacao de dominio (`useDomainPartnerValidation`) bloqueara usuarios da Venus no dominio principal INOVAIA
- Nenhuma alteracao de codigo necessaria -- apenas dados

## Secao tecnica

- Tabela: `clientes`
- Coluna: `parceiro` (text, default 'INOVAIA')
- O mesmo UPDATE precisa ser executado no ambiente **Live** tambem (via Cloud View > Run SQL com Live selecionado) apos publicacao

