

# Branding Dinamico por Clinica

## Resumo
O sistema vai carregar automaticamente o nome e logo de cada clinica baseado no usuario logado. Clinicas sem personalizacao usam o branding INOVAIA como fallback.

## O que muda para o usuario

- Quando um usuario da **Clinica Olhos** logar, vera o logo "GT INOVA" e o nome "Clinica Olhos" no cabecalho
- Todos os outros usuarios continuam vendo o branding INOVAIA normalmente
- Nenhuma funcionalidade existente e afetada

## Passos da implementacao

### 1. Salvar o logo GT INOVA no projeto
- Copiar a imagem enviada para `src/assets/gt-inova-logo.jpeg`
- Sera usada como logo da Clinica Olhos

### 2. Criar hook `useClinicBranding`
Um novo hook (`src/hooks/useClinicBranding.ts`) que:
- Busca o `cliente_id` do perfil do usuario logado
- Consulta a tabela `clientes` para obter `nome` e `logo_url`
- Retorna o branding da clinica ou fallback para INOVAIA
- Inclui cache local para nao repetir consultas desnecessarias

Retorno do hook:
```text
{
  clinicName: string      // "Clinica Olhos" ou "INOVAIA"
  clinicSubtitle: string  // "Sistema de Agendamentos" (padrao)
  logoSrc: string         // URL do logo ou logo INOVAIA
  isLoading: boolean
}
```

### 3. Atualizar o DashboardHeader
- Substituir o nome fixo "INOVAIA" e o logo fixo pelo retorno do hook
- Manter fallback para branding INOVAIA quando nao houver personalizacao

### 4. Atualizar tela de loading (Index.tsx)
- O texto "INOVAIA" na tela de carregamento tambem usara o branding dinamico

### 5. Atualizar `logo_url` da Clinica Olhos no banco
- Usar o logo GT INOVA como asset estatico importado diretamente no codigo
- Mapear o `cliente_id` da Clinica Olhos para o logo local
- Alternativa futura: upload para Supabase Storage e salvar URL na tabela `clientes`

## Detalhes tecnicos

### Logica de resolucao do logo
```text
1. Buscar cliente_id do usuario logado (via profile)
2. Se cliente_id == "d7d7b7cf-..." (Clinica Olhos) -> usar logo GT INOVA local
3. Se cliente tem logo_url no banco -> usar essa URL
4. Senao -> usar logo INOVAIA (fallback padrao)
```

### Arquivos modificados
| Arquivo | Alteracao |
|---------|-----------|
| `src/assets/gt-inova-logo.jpeg` | Novo - logo da Clinica Olhos |
| `src/hooks/useClinicBranding.ts` | Novo - hook de branding dinamico |
| `src/components/dashboard/DashboardHeader.tsx` | Usar branding dinamico |
| `src/pages/Index.tsx` | Tela de loading com branding dinamico |

### Fallback garantido
- Clinicas sem `logo_url` e sem mapeamento local usam INOVAIA
- Erros na consulta ao banco tambem retornam INOVAIA
- Nenhum risco de quebra para usuarios existentes

