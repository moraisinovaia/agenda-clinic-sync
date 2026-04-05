# Mapeamento de Proxies - LLM Agent API

## Objetivo
Documentar as proxies atuais da `llm-agent-api` para preparar a unificação em uma única API multi-tenant.

## API principal
- Função canônica: `llm-agent-api`
- Responsável pela lógica real de negócio
- Multi-tenant via `cliente_id` e/ou `config_id`

---

## Proxies atuais

### llm-agent-api-marcelo
- Tipo: proxy
- config_id: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- cliente_id: `2bfb98b5-ae41-4f96-8ba7-acc797c22054`
- Observação: usa dados compartilhados do IPADO com configuração própria

### llm-agent-api-olhos
- Tipo: proxy
- config_id: `0572445e-b4f3-4166-972d-d883d0fdd37c`
- cliente_id: `d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a`

### llm-agent-api-orion
- Tipo: proxy
- config_id: `223a7ffd-337b-4379-95b6-85bed89e47d0`
- cliente_id: `e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f`

### llm-agent-api-venus
- Tipo: proxy
- cliente_id: `20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a`
- config_id: não identificado no grep atual

---

## Diagnóstico
As funções `llm-agent-api-*` são proxies que:
1. validam `x-api-key`
2. recebem a requisição
3. injetam `cliente_id` e/ou `config_id`
4. encaminham para `llm-agent-api`

A lógica real está concentrada na `llm-agent-api`.

---

## Direção arquitetural
### Estado atual
- 1 API principal
- múltiplas proxies por cliente

### Estado desejado
- 1 API principal (`llm-agent-api`)
- clientes/integradores chamam diretamente a API principal
- `cliente_id` e `config_id` seguem no payload
- proxies antigas mantidas temporariamente apenas para compatibilidade

---

## Próximos passos
1. confirmar se `llm-agent-api-venus` usa apenas `cliente_id`
2. mapear onde cada proxy é chamada (docs, n8n, integrações externas)
3. criar plano de migração para chamada direta à `llm-agent-api`
4. descontinuar proxies gradualmente