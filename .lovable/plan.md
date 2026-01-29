# LLM Dedicado Dr. Marcelo D'Carli ✅ CONCLUÍDO

## Status: Implementado com Sucesso

### Resumo
Criada uma configuração LLM separada para o Dr. Marcelo D'Carli que:
- ✅ Usa os **mesmos dados de agendamentos/pacientes** do IPADO (mesmo `cliente_id`)
- ✅ Tem **informações próprias**: telefone, horários, limites e mensagens personalizadas
- ✅ É **editável pelo painel administrativo**
- ✅ Funciona via **endpoint dedicado** para o fluxo N8N/WhatsApp

## Dados Criados

### Config ID
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Informações da Clínica
| Campo | Valor |
|-------|-------|
| Nome | Consultório Dr. Marcelo D'Carli |
| Telefone | (87) 98112-6744 |
| WhatsApp | (87) 98112-6744 |
| Secretária | Jeniffe/Luh |
| Cliente ID | 2bfb98b5-ae41-4f96-8ba7-acc797c22054 (IPADO) |

### Business Rules
- **Médico**: Dr. Marcelo D'Carli (`1e110923-50df-46ff-a57a-29d88e372900`)
- **Tipo Agendamento**: ordem_chegada
- **Serviços**: Consulta Cardiológica, Teste Ergométrico
- **Limites**: 9 vagas manhã, 9 vagas tarde

### Mensagens Personalizadas
5 tipos configurados: bloqueio_agenda, data_bloqueada, sem_disponibilidade, ordem_chegada, encaixe

## Endpoint N8N

```
URL Base: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api-marcelo
```

### Endpoints Disponíveis
| Endpoint | Descrição |
|----------|-----------|
| POST /availability | Verificar disponibilidade |
| POST /schedule | Agendar consulta |
| POST /check-patient | Consultar agendamentos |
| POST /cancel | Cancelar |
| POST /confirm | Confirmar |
| POST /reschedule | Remarcar |
| POST /list-doctors | Listar médicos |
| POST /clinic-info | Informações da clínica |

## Gerenciamento pelo Admin Panel

1. Acesse **Configuração LLM API** no admin
2. No dropdown, selecione **"Consultório Dr. Marcelo D'Carli"**
3. Edite horários, limites, mensagens conforme necessário
4. Alterações aplicam em até 1 minuto (cache TTL)

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                     N8N WhatsApp Flow                       │
│                  (WhatsApp Dr. Marcelo)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            llm-agent-api-marcelo (Proxy)                    │
│  - Injeta config_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890   │
│  - Injeta cliente_id: IPADO                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               llm-agent-api (Principal)                     │
│  - Carrega config específica pelo config_id                 │
│  - Usa business_rules vinculadas ao config_id               │
│  - Usa llm_mensagens vinculadas ao config_id                │
└─────────────────────────────────────────────────────────────┘
```

## Diferenças IPADO vs Dr. Marcelo

| Aspecto | IPADO Principal | Dr. Marcelo Dedicado |
|---------|-----------------|----------------------|
| Telefone/WhatsApp | (87) 3024-1274 | (87) 98112-6744 |
| Mensagem bloqueio | Genérica | Secretária Jeniffe/Luh |
| Médicos | Todos | Apenas Dr. Marcelo |
| Dados (pacientes/agendamentos) | Compartilhados | Compartilhados |
