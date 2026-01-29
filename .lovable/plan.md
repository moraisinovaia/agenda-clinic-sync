
# Plano: Integrar Informações Completas do Dr. Marcelo D'Carli ao LLM

## Resumo do Documento Fornecido

O documento contém informações detalhadas que precisam ser adicionadas ao sistema:

| Categoria | Informações do Documento |
|-----------|-------------------------|
| **Identificação** | CRM: 15056/PE, RQE Cardiologia: 67, RQE Ergometria: 16.683 |
| **Empresa** | DE CARLI SERVIÇOS DE SAUDE LTDA - CNPJ: 09.637.244/0001-54 |
| **Contato** | Email: drmarcelodecarli@gmail.com, Instagram: @drmarcelodecarli |
| **Local** | Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE |
| **Convênios Aceitos** | UNIMED VSF, UNIMED 40%, UNIMED 20%, UNIMED NACIONAL, UNIMED REGIONAL, UNIMED INTERCAMBIO, HGU, CASEMBRAPA (só periódico) |
| **Convênios Parceiros** | MEDCLIN, MEDPREV, SEDILAB, CLÍNICA VIDA, CLINCENTER, SERTÃO SAÚDE (consultar diretamente) |
| **Convênios NÃO Aceitos** | SULAMERICA, CASSI, BRADESCO, CAMED, FUSEX, CAPESAUDE e outros |
| **Exames** | Teste Ergométrico, ECG, MAPA 24H, MRPA (4 dias) |
| **Valores Teste Ergométrico** | Particular: R$ 240 (mín. R$ 220), UNIMED 40%: R$ 54, UNIMED 20%: R$ 26 |
| **Horários Teste Ergométrico** | Ter/Qui: 13:00-15:30 (início 13:30), Qua/Sex: 07:00-10:30 (início 07:30) |
| **Limite Pacientes** | 13 por turno (não 9 como configurado atualmente) |

## O Que Será Atualizado

### 1. Configuração da Clínica (`llm_clinic_config`)

Atualizar endereço completo e adicionar campos extras:

```sql
UPDATE llm_clinic_config 
SET 
  endereco = 'Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### 2. Business Rules (Serviços e Horários)

Atualizar para refletir os dados reais do documento:

```json
{
  "nome": "Dr. Marcelo D'Carli",
  "crm": "15056/PE",
  "rqe_cardiologia": "67",
  "rqe_ergometria": "16.683",
  "email": "drmarcelodecarli@gmail.com",
  "instagram": "@drmarcelodecarli",
  "empresa": "DE CARLI SERVIÇOS DE SAUDE LTDA",
  "cnpj": "09.637.244/0001-54",
  "especialidade": "Cardiologia/Ergometria",
  "tipo_agendamento": "ordem_chegada",
  
  "convenios_aceitos": [
    "UNIMED VSF", "UNIMED NACIONAL", "UNIMED REGIONAL", 
    "UNIMED INTERCAMBIO", "UNIMED 40%", "UNIMED 20%", "HGU"
  ],
  "convenios_restricoes": {
    "CASEMBRAPA": "Apenas exame periódico"
  },
  "convenios_parceiros": {
    "lista": ["MEDCLIN", "MEDPREV", "SEDILAB", "CLINICA VIDA", "CLINCENTER", "SERTAO SAUDE"],
    "mensagem": "Informações sobre atendimento devem ser obtidas diretamente com o convênio parceiro."
  },
  "convenios_nao_aceitos": ["SULAMERICA", "CASSI", "BRADESCO", "CAMED", "FUSEX", "CAPESAUDE"],
  "mensagem_convenio_nao_aceito": "Não atendemos este plano. O paciente pode fazer consulta particular e solicitar reembolso ao plano.",
  
  "servicos": {
    "Consulta Cardiológica": {
      "permite_online": true,
      "dias_semana": [1, 2, 3, 4, 5],
      "periodos": {
        "manha": {
          "limite": 9,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "atendimento_inicio": "07:45",
          "distribuicao_fichas": "07:00 às 09:30 para fazer a ficha"
        },
        "tarde": {
          "limite": 9,
          "dias_especificos": [1, 3],
          "contagem_inicio": "13:00",
          "contagem_fim": "17:00",
          "atendimento_inicio": "13:45",
          "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
        }
      }
    },
    
    "Teste Ergométrico": {
      "permite_online": true,
      "dias_semana": [2, 3, 4, 5],
      "periodos": {
        "manha": {
          "limite": 13,
          "dias_especificos": [3, 5],
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "atendimento_inicio": "07:30",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha"
        },
        "tarde": {
          "limite": 13,
          "dias_especificos": [2, 4],
          "contagem_inicio": "13:00",
          "contagem_fim": "17:00",
          "atendimento_inicio": "13:30",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha"
        }
      },
      "valores": {
        "particular": 240,
        "particular_minimo": 220,
        "unimed_40_porcento": 54,
        "unimed_20_porcento": 26
      },
      "resultado": "No mesmo dia",
      "orientacoes": [
        "Venha com roupa apropriada para prática de esportes",
        "Venha com sapato fechado sem salto (evite sandálias ou salto)",
        "Pode fazer o exame descalço, se preferir",
        "NÃO pode estar de jejum - evite alimentos de difícil digestão 2 horas antes",
        "Evite café no dia do exame",
        "NÃO fumar no dia do exame",
        "NÃO ingerir bebida alcoólica no dia do exame",
        "Homens com pelos no peito devem vir com o peito raspado",
        "NÃO usar creme corporal, hidratante ou protetor solar no tórax",
        "Gestantes NÃO devem fazer o exame",
        "Evite fazer exercícios no dia do exame",
        "Se usa medicação, pergunte ao médico se deve suspender antes do exame"
      ],
      "documentos_necessarios": [
        "Documento de identificação",
        "Carteira do plano de saúde (se houver)",
        "Guia de solicitação do exame (se por convênio)",
        "Verificar validade da guia autorizada (exames com senhas vencidas não são realizados)"
      ]
    },
    
    "ECG": {
      "permite_online": false,
      "mensagem": "O ECG (eletrocardiograma) não precisa de agendamento. Compareça à clínica durante o horário de atendimento."
    },
    
    "MAPA 24H": {
      "permite_online": true,
      "mensagem": "Para agendar MAPA 24H, entre em contato pelo WhatsApp: (87) 98112-6744"
    },
    
    "MRPA": {
      "permite_online": true,
      "mensagem": "Para agendar MRPA (MAPA de 4 dias), entre em contato pelo WhatsApp: (87) 98112-6744"
    }
  }
}
```

### 3. Novas Mensagens Personalizadas

Adicionar mensagens que o agente pode usar em diferentes situações:

| Tipo | Mensagem |
|------|----------|
| `convenio_nao_aceito` | "Infelizmente o Dr. Marcelo não atende pelo {convenio}. O paciente pode realizar consulta particular (R$ valor) e solicitar reembolso ao seu plano conforme as regras de cobertura." |
| `convenio_parceiro` | "O convênio {convenio} é um parceiro. Recomendamos obter informações sobre atendimento diretamente com o convênio." |
| `orientacoes_teste` | (Lista completa das 12+ orientações do documento) |
| `valores_teste` | "Teste Ergométrico: Particular R$ 240 (mín. R$ 220), UNIMED 40%: R$ 54, UNIMED 20%: R$ 26" |
| `documentos_exame` | "Traga: documento de identificação, carteira do plano (se houver) e guia autorizada (verifique a validade)." |

### 4. Atualização da Edge Function Proxy (Documentação)

Atualizar comentários no `llm-agent-api-marcelo/index.ts` com informações de referência:

```typescript
/**
 * v1.1.0 - LLM Agent API Dr. Marcelo D'Carli
 * 
 * DADOS DO MÉDICO:
 * - CRM: 15056/PE | RQE Cardiologia: 67 | RQE Ergometria: 16.683
 * - Empresa: DE CARLI SERVIÇOS DE SAUDE LTDA (CNPJ: 09.637.244/0001-54)
 * - Email: drmarcelodecarli@gmail.com | Instagram: @drmarcelodecarli
 * 
 * LOCAL: Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE
 * WhatsApp: (87) 98112-6744 | Secretárias: Jeniffe e Luh
 * 
 * CONVÊNIOS ACEITOS:
 * - UNIMED (VSF, Nacional, Regional, Intercâmbio, 40%, 20%)
 * - HGU
 * - CASEMBRAPA (apenas periódico)
 * 
 * EXAMES:
 * - Teste Ergométrico: Ter/Qui tarde (13:00-15:30), Qua/Sex manhã (07:00-10:30) - 13 pacientes/turno
 * - ECG: Sem agendamento
 * - MAPA 24H / MRPA: Via WhatsApp
 */
```

## Etapas de Implementação

### Etapa 1: Atualizar `llm_clinic_config`
- Corrigir endereço completo
- Total: 1 UPDATE

### Etapa 2: Atualizar `business_rules`
- Substituir config JSONB com dados completos
- Inclui convênios, valores, orientações detalhadas
- Corrigir limite de 9 para 13 no Teste Ergométrico
- Corrigir dias: Qua/Sex manhã, Ter/Qui tarde
- Total: 1 UPDATE

### Etapa 3: Adicionar novas mensagens em `llm_mensagens`
- Tipo `convenio_nao_aceito`
- Tipo `convenio_parceiro`
- Tipo `orientacoes_teste`
- Tipo `valores_teste`
- Tipo `documentos_exame`
- Total: 5 INSERTs

### Etapa 4: Atualizar Edge Function
- Adicionar comentários de documentação
- Bump versão para 1.1.0
- Redeployar

## Impacto nas Respostas do Agente

Após implementação, o agente LLM poderá:

1. **Informar convênios corretamente**:
   - "O Dr. Marcelo atende UNIMED Nacional, Regional, VSF, 40%, 20%, Intercâmbio, e HGU"
   - "Infelizmente não atendemos SulAmérica. O paciente pode fazer particular (R$ 240) e pedir reembolso"

2. **Fornecer valores precisos**:
   - "Teste Ergométrico particular: R$ 240 (ou R$ 220 com desconto)"
   - "UNIMED 40%: R$ 54 de coparticipação"

3. **Dar orientações completas**:
   - Lista das 12+ orientações pré-exame
   - Documentos necessários
   - Informação sobre resultado no mesmo dia

4. **Horários corretos do Teste Ergométrico**:
   - Ter/Qui: tarde (13:00-15:30, atendimento 13:30)
   - Qua/Sex: manhã (07:00-10:30, atendimento 07:30)
   - 13 pacientes por turno (não 9)

## Seção Técnica

### Migração SQL Necessária

```sql
-- 1. Atualizar endereço
UPDATE llm_clinic_config 
SET endereco = 'Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 2. Atualizar business_rules (config completa)
UPDATE business_rules
SET config = '{...JSON completo...}'::jsonb,
    updated_at = now(),
    version = version + 1
WHERE config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 3. Inserir novas mensagens
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, mensagem, ativo)
VALUES 
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'convenio_nao_aceito', 'Mensagem...', true),
  -- ... demais mensagens
;
```

### Arquivos a Modificar
1. `supabase/functions/llm-agent-api-marcelo/index.ts` - Atualizar documentação
2. Criar migration SQL para dados
