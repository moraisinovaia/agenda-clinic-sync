

# Criar Edge Function Proxy `llm-agent-api-olhos`

## Objetivo
Criar uma Edge Function proxy para a Clinica Olhos, seguindo o padrao ja estabelecido pelos proxies existentes (Venus, Orion, Marcelo).

## O que sera feito

1. **Criar o arquivo `supabase/functions/llm-agent-api-olhos/index.ts`**
   - Proxy minimalista que recebe requisicoes e repassa para a `llm-agent-api` principal
   - Injeta automaticamente:
     - `config_id`: `0572445e-b4f3-4166-972d-d883d0fdd37c`
     - `cliente_id`: `d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a`
   - Trata CORS, normaliza body (array do N8N), loga operacoes
   - Retorna erro com status 200 para compatibilidade com N8N

2. **Atualizar `supabase/config.toml`**
   - Adicionar entrada `[functions.llm-agent-api-olhos]` com `verify_jwt = false`

## Detalhes Tecnicos

- Baseado no padrao do `llm-agent-api-marcelo` (proxy com `config_id` + `cliente_id`)
- URL da API principal: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api`
- Headers CORS completos conforme padrao do projeto
- Versao inicial: v1.0.0
- Deploy automatico apos criacao do arquivo

## Dados da Clinica Olhos

| Campo | Valor |
|-------|-------|
| cliente_id | `d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a` |
| config_id | `0572445e-b4f3-4166-972d-d883d0fdd37c` |
| Nome | Clinica Olhos |
| Medicos | 7 ativos |

## Pendencias (para depois)
- Preencher WhatsApp, telefone e endereco na `llm_clinic_config`
- Criar mensagens personalizadas na `llm_mensagens` (opcional)
- Configurar workflow N8N apontando para o novo endpoint

