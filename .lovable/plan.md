# Plano: Integrar Informações Dr. Marcelo D'Carli - CONCLUÍDO ✅

## Status: IMPLEMENTADO

Data de conclusão: 2026-01-29

## Resumo das Alterações Realizadas

### 1. Banco de Dados

| Tabela | Alteração |
|--------|-----------|
| `llm_clinic_config` | Endereço atualizado para "Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE" |
| `business_rules` | Limite Teste Ergométrico: 9 → **13 pacientes/turno** |
| `business_rules` | Dias manhã: [3] → **[3, 5]** (Qua/Sex) |
| `business_rules` | Dias tarde: [2, 4] → **[2, 4]** (Ter/Qui) - mantido |
| `business_rules` | Horário início manhã: 08:45 → **07:30** |
| `business_rules` | Horário início tarde: 13:45 → **13:30** |
| `business_rules` | Adicionados valores: R$ 240 (particular), R$ 220 (mín), R$ 54 (40%), R$ 26 (20%) |
| `llm_mensagens` | 5 novas mensagens: `convenio_nao_aceito`, `convenio_parceiro`, `orientacoes_teste`, `valores_teste`, `documentos_exame` |
| `llm_mensagens` | Constraint expandida para novos tipos |

### 2. Edge Function

**Arquivo:** `supabase/functions/llm-agent-api-marcelo/index.ts`

- Versão: 1.0.0 → **1.1.0**
- Adicionada documentação completa do médico (CRM, RQE, CNPJ, convênios, horários, exames)
- Headers atualizados com nova versão

### 3. Mensagens Personalizadas Adicionadas

| Tipo | Conteúdo |
|------|----------|
| `convenio_nao_aceito` | Informa que não atende o convênio + opção particular R$ 240 + reembolso |
| `convenio_parceiro` | Orienta contato direto com convênio parceiro |
| `orientacoes_teste` | 12 orientações completas do Teste Ergométrico |
| `valores_teste` | Particular R$ 240 (mín R$ 220), UNIMED 40% R$ 54, UNIMED 20% R$ 26 |
| `documentos_exame` | Lista de documentos + alerta sobre guias vencidas |

## Endpoint

```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api-marcelo
```

## Dados do Médico Configurados

- **Nome:** Marcelo De'Carli Cavalcanti
- **CRM:** 15056/PE
- **RQE Cardiologia:** 67
- **RQE Ergometria:** 16.683
- **Empresa:** DE CARLI SERVIÇOS DE SAUDE LTDA
- **CNPJ:** 09.637.244/0001-54
- **WhatsApp:** (87) 98112-6744
- **Secretárias:** Jeniffe e Luh
