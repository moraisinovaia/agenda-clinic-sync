

## Configurar proxy do Dr. Marcelo para usar config_id próprio

### Situação atual

| Item | Config ID atual | Config ID correto |
|------|----------------|-------------------|
| Proxy `llm-agent-api-marcelo` | `20b48124` (IPADO geral) | `a1b2c3d4` (Consultório Marcelo) |
| Business rules (Dr. Marcelo principal) | Tem nos DOIS config_ids | OK - já existe em `a1b2c3d4` |
| Business rules (MAPA e Teste Ergométrico) | `20b48124` (IPADO geral) | `a1b2c3d4` (Consultório Marcelo) |
| LLM mensagens do Dr. Marcelo | Mistas (algumas em cada) | `a1b2c3d4` |

O `llm_clinic_config` com id `a1b2c3d4-e5f6-7890-abcd-ef1234567890` já tem o WhatsApp correto: **(87) 98112-6744**.

### Mudanças

**1. Atualizar proxy Edge Function** (`llm-agent-api-marcelo/index.ts`)
- Trocar `CONFIG_ID_MARCELO` de `20b48124-ae41-4e54-8a7e-3e236b8b4829` para `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**2. Atualizar business_rules no banco** (3 UPDATEs via insert tool)
- MAPA - Dr. Marcelo (`0175d73b`): `config_id` → `a1b2c3d4`
- Teste Ergométrico - Dr. Marcelo (`7273a6cc`): `config_id` → `a1b2c3d4`
- Dr. Marcelo D'Carli duplicado em `20b48124` (`7e08a5cd`): desativar (já existe em `a1b2c3d4`)

**3. Atualizar llm_mensagens no banco** (2 UPDATEs via insert tool)
- As 2 mensagens do Dr. Marcelo com `config_id: 20b48124` (bloqueio_agenda e encaixe): trocar para `a1b2c3d4`

### Resultado

Quando o N8N chamar `llm-agent-api-marcelo`, a API vai:
- Usar o `config_id: a1b2c3d4` → carregar telefone/WhatsApp do consultório do Dr. Marcelo
- Usar o `cliente_id: 2bfb98b5` (IPADO) → acessar mesmos pacientes e agendamentos
- Carregar business_rules e mensagens específicas do Dr. Marcelo

Fluxo IPADO normal continua usando `config_id: 20b48124` sem alteração.

### Detalhes técnicos

- 1 arquivo editado: `supabase/functions/llm-agent-api-marcelo/index.ts` (1 linha)
- 5 operações de dados no banco (insert tool)
- Deploy da Edge Function após edição

