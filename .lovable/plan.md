

# Plano: Habilitar Agendamento de MAPA 24H e MRPA no LLM

## Resumo dos Dados Fornecidos

### MAPA 24H

| Campo | Valor |
|-------|-------|
| **Tipo de agendamento** | Hora marcada (horário específico) |
| **Dias/Horários** | Seg 08:00, Ter 09:00, Qua 10:00, Qui 10:30 |
| **Limite diário** | 3 exames |
| **Particular** | R$ 180 (desconto R$ 160) |
| **UNIMED 40%** | R$ 54 |
| **UNIMED 20%** | R$ 27 |
| **Resultado** | No mesmo dia da devolução |
| **Tolerância atraso** | 15 minutos |

### MRPA (4 dias)

| Campo | Valor |
|-------|-------|
| **Tipo de agendamento** | Ordem de chegada |
| **Dias** | Terça, Quarta, Quinta |
| **Horários** | Manhã 08:00 (fichas 07:00-09:00), Tarde 13:30 (fichas 13:00-15:00) |
| **Limite por turno** | 5 exames |
| **Particular** | R$ 180 (desconto R$ 160) |
| **UNIMED 40%** | R$ 54 |
| **UNIMED 20%** | R$ 27 |
| **Resultado** | 7 dias após devolução |

## O Que Será Implementado

### 1. Atualizar Business Rules

Adicionar configurações completas para MAPA 24H e MRPA no registro `592bfe3b-08d2-4bea-81c2-07f5fb8b1c06`:

```json
{
  "MAPA 24H": {
    "tipo_agendamento": "hora_marcada",
    "permite_online": true,
    "horarios_especificos": {
      "1": "08:00",
      "2": "09:00",
      "3": "10:00",
      "4": "10:30"
    },
    "limite_diario": 3,
    "tolerancia_minutos": 15,
    "antecedencia_chegada": 10,
    "valores": {
      "particular": 180,
      "particular_desconto": 160,
      "unimed_40_porcento": 54,
      "unimed_20_porcento": 27
    },
    "resultado": "No mesmo dia da devolução",
    "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
  },
  
  "MRPA": {
    "tipo_agendamento": "ordem_chegada",
    "permite_online": true,
    "dias_semana": [2, 3, 4],
    "periodos": {
      "manha": {
        "limite": 5,
        "atendimento_inicio": "08:00",
        "distribuicao_fichas": "07:00 às 09:00 para fazer a ficha"
      },
      "tarde": {
        "limite": 5,
        "atendimento_inicio": "13:30",
        "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
      }
    },
    "valores": {
      "particular": 180,
      "particular_desconto": 160,
      "unimed_40_porcento": 54,
      "unimed_20_porcento": 27
    },
    "resultado": "7 dias após devolução",
    "duracao_exame": "4 dias consecutivos",
    "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
  }
}
```

### 2. Adicionar Mensagens de Orientação

#### orientacoes_mapa_24h
Conteúdo completo das orientações:
- Tomar banho ANTES de vir (não pode com o aparelho)
- Usar roupas confortáveis e mangas largas
- NÃO interromper medicamentos (exceto se médico solicitar)
- Durante 24h: vida normal, mas evitar exercícios intensos
- Medições: 15 min (dia), 30 min (sono)
- Cuidados com o aparelho
- Devolução no horário marcado

#### orientacoes_mrpa
Conteúdo completo das orientações:
- Como medir: 3x manhã, 3x noite, por 4 dias
- Posição correta: sentado 5 min, pés no chão, braço apoiado
- Medicamentos: medir ANTES de tomar
- Exame inicia no dia seguinte à retirada
- Devolver após 4 dias com folha preenchida

#### documentos_mapa_mrpa
- Documento de identificação
- Carteira do plano (se houver)
- Guia de solicitação (convênio)
- Verificar validade da guia

#### valores_mapa_mrpa
Texto formatado com valores de ambos os exames

### 3. Atualizar Constraint de Mensagens

Adicionar novos tipos permitidos:
- `orientacoes_mapa_24h`
- `orientacoes_mrpa`
- `documentos_mapa_mrpa`
- `valores_mapa_mrpa`

## Etapas de Implementação

### Etapa 1: Atualizar `business_rules`
- Adicionar serviço "MAPA 24H" com horários específicos por dia
- Adicionar serviço "MRPA" com configuração ordem_chegada
- Total: 1 UPDATE com jsonb_set

### Etapa 2: Expandir constraint `llm_mensagens`
- DROP e CREATE nova constraint incluindo novos tipos

### Etapa 3: Inserir novas mensagens
- `orientacoes_mapa_24h` (orientações completas do MAPA)
- `orientacoes_mrpa` (orientações completas do MRPA)
- `documentos_mapa_mrpa` (o que trazer)
- `valores_mapa_mrpa` (tabela de valores)
- Total: 4 INSERTs

## Impacto nas Respostas do Agente

Após implementação, o agente poderá:

1. **Agendar MAPA 24H**:
   - "MAPA 24H disponível segunda às 08:00, terça às 09:00, quarta às 10:00 ou quinta às 10:30"
   - "Temos 3 vagas por dia, horário marcado"

2. **Agendar MRPA**:
   - "MRPA disponível terça, quarta ou quinta"
   - "Manhã: chegue entre 07:00 e 09:00, tarde: entre 13:00 e 15:00"

3. **Informar valores**:
   - "MAPA/MRPA particular: R$ 180 (ou R$ 160 com desconto)"
   - "UNIMED 40%: R$ 54, UNIMED 20%: R$ 27"

4. **Enviar orientações completas**:
   - Todas as instruções de preparo
   - O que trazer no dia
   - Regras de devolução

## Seção Técnica

### SQL Migration

```sql
-- 1. Atualizar business_rules com MAPA 24H e MRPA
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(config,
    '{servicos,MAPA 24H}', 
    '{
      "tipo_agendamento": "hora_marcada",
      "permite_online": true,
      "horarios_especificos": {"1": "08:00", "2": "09:00", "3": "10:00", "4": "10:30"},
      "limite_diario": 3,
      "tolerancia_minutos": 15,
      "antecedencia_chegada": 10,
      "valores": {"particular": 180, "particular_desconto": 160, "unimed_40": 54, "unimed_20": 27},
      "resultado": "No mesmo dia da devolução",
      "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
    }'::jsonb),
  '{servicos,MRPA}',
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_online": true,
    "dias_semana": [2, 3, 4],
    "periodos": {
      "manha": {"limite": 5, "atendimento_inicio": "08:00", "distribuicao_fichas": "07:00 às 09:00"},
      "tarde": {"limite": 5, "atendimento_inicio": "13:30", "distribuicao_fichas": "13:00 às 15:00"}
    },
    "valores": {"particular": 180, "particular_desconto": 160, "unimed_40": 54, "unimed_20": 27},
    "resultado": "7 dias após devolução",
    "duracao_exame": "4 dias consecutivos"
  }'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';

-- 2. Expandir constraint de tipos de mensagem
ALTER TABLE llm_mensagens DROP CONSTRAINT IF EXISTS llm_mensagens_tipo_check;
ALTER TABLE llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check 
CHECK (tipo IN (
  'bloqueio_agenda', 'confirmacao', 'sem_vaga', 'cancelamento', 
  'reagendamento', 'lembrete', 'orientacoes', 'boas_vindas',
  'convenio_nao_aceito', 'convenio_parceiro', 'orientacoes_teste',
  'valores_teste', 'documentos_exame',
  'orientacoes_mapa_24h', 'orientacoes_mrpa', 'documentos_mapa_mrpa', 'valores_mapa_mrpa'
));

-- 3. Inserir novas mensagens
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, mensagem, ativo) VALUES
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'orientacoes_mapa_24h', 
 '📋 *ORIENTAÇÕES MAPA 24H*\n\n*ANTES DO EXAME:*\n• Tomar banho ANTES de vir (NÃO pode com o aparelho)\n• Usar roupas confortáveis e mangas largas\n• NÃO interrompa medicamentos (exceto se médico solicitar)\n• Chegar 10 minutos antes do horário\n\n*DURANTE AS 24 HORAS:*\n• Vida normal de trabalho e atividades\n• NÃO pode retirar o aparelho\n• Evitar exercícios intensos e carregar peso\n• Evitar atividades com transpiração excessiva\n• Evitar dormir sobre o braço com aparelho\n• Celular: pode usar, mas não no mesmo braço\n\n*MEDIÇÕES:*\n• A cada 15 min durante o dia\n• A cada 30 min durante o sono\n\n*CUIDADOS COM O APARELHO:*\n• Evitar pancadas ou quedas\n• Uso exclusivo do paciente\n• Devolver com folha, bolsa e pilhas\n\n*DEVOLUÇÃO:*\n• Respeitar horário marcado\n• Atrasos podem gerar multa\n• Resultado sai NO MESMO DIA\n\n⚠️ Pacientes idosos devem vir acompanhados', 
 true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'orientacoes_mrpa',
 '📋 *ORIENTAÇÕES MRPA (MAPA 4 DIAS)*\n\n*NO DIA DA RETIRADA:*\n• Compareça no horário agendado\n• A secretária afere sua pressão 2 vezes\n• Receberá o aparelho e folha de anotações\n• O exame INICIA NO DIA SEGUINTE\n\n*DURANTE OS 4 DIAS:*\n• Medir 3x PELA MANHÃ e 3x À NOITE\n• Intervalo de 1-2 minutos entre medições\n• Anotar todas as medidas na folha\n\n*POSIÇÃO CORRETA:*\n• Sentar por 5 minutos antes\n• Dois pés no chão\n• Braço apoiado na altura do peito\n• Bexiga vazia\n• NÃO conversar durante medição\n• NÃO mexer o braço\n\n*MEDICAMENTOS:*\n• Se toma remédio para pressão, meça ANTES de tomar\n\n*VANTAGENS:*\n• Pode tomar banho e fazer exercícios (fora dos horários das medições)\n• Avalia efeito do "jaleco branco"\n\n*DEVOLUÇÃO:*\n• Devolver após 4 dias com folha preenchida\n• Resultado em 7 DIAS\n\n⚠️ Pacientes idosos devem vir acompanhados',
 true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'valores_mapa_mrpa',
 '💰 *VALORES MAPA 24H e MRPA*\n\n• Particular: R$ 180,00\n• Com desconto: R$ 160,00\n• UNIMED 40%: R$ 54,00\n• UNIMED 20%: R$ 27,00\n• UNIMED VSF/Nacional/Regional: sem coparticipação\n• HGU: conforme convênio',
 true);
```

### Arquivos Impactados
- **Database**: `business_rules`, `llm_mensagens`
- **Edge Function**: Documentação atualizada (opcional)

### Considerações sobre MAPA 24H

O MAPA 24H tem uma estrutura diferente dos outros exames:
- Horários fixos específicos por dia da semana (não é turno manhã/tarde)
- Segunda 08:00, Terça 09:00, Quarta 10:00, Quinta 10:30
- A lógica de disponibilidade precisará verificar se há vaga naquele horário específico

Isso pode exigir ajuste na lógica do `llm-agent-api` para tratar esse tipo de agendamento diferenciado.

