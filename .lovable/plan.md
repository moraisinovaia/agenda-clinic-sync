

## Analise: A correção do webhook é suficiente?

### O que está quebrado

A migration `20260302011609` removeu o trigger `trigger_notificar_fila_webhook` e a função `notificar_fila_webhook()`. Esse é o **elo 2** da cadeia:

```text
Cancelamento → [1] trigger processar_fila_cancelamento → INSERT em fila_notificacoes
                [2] trigger notificar_fila_webhook → HTTP POST para n8n  ← QUEBRADO
                [3] n8n envia WhatsApp ao paciente
```

### O que já funciona

Verifiquei todos os componentes da cascata:

1. **Trigger `processar_fila_cancelamento`** -- Existe e ativo. Busca candidato por prioridade/antiguidade, insere em `fila_notificacoes`, atualiza status para `notificado`.

2. **`handleResponderFila` na llm-agent-api** -- Implementado com cascata completa:
   - SIM → `criar_agendamento_atomico_externo` → status `agendado`
   - NAO/TIMEOUT → busca proximo candidato → insere nova `fila_notificacoes` → dispara webhook via `dispararWebhookFilaEspera` → retorna dados do proximo para o Noah

3. **Webhook de cascata (NAO/TIMEOUT)** -- A llm-agent-api chama `dispararWebhookFilaEspera` diretamente (sem depender do trigger DB) para notificar o proximo candidato. Isso funciona independentemente do trigger.

### Resposta

**Sim, recriar o trigger resolve o problema.** O unico elo quebrado é o passo 2 -- o trigger que dispara o webhook para o n8n quando a primeira notificação é inserida via trigger PostgreSQL. A cascata subsequente (NAO → proximo candidato) já funciona porque a `llm-agent-api` dispara o webhook diretamente via codigo.

### Correção

Criar uma nova migration SQL que recria exatamente a função e o trigger da migration `20260302004104`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notificar_fila_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  payload jsonb;
  paciente_record RECORD;
BEGIN
  SELECT p.nome_completo, p.celular, m.nome as medico_nome,
         a.nome as atendimento_nome, fe.cliente_id
  INTO paciente_record
  FROM fila_espera fe
  JOIN pacientes p ON fe.paciente_id = p.id
  JOIN medicos m ON fe.medico_id = m.id
  JOIN atendimentos a ON fe.atendimento_id = a.id
  WHERE fe.id = NEW.fila_id;

  payload := jsonb_build_object(
    'notif_id', NEW.id, 'fila_id', NEW.fila_id,
    'cliente_id', paciente_record.cliente_id,
    'paciente_nome', paciente_record.paciente_nome,
    'paciente_celular', paciente_record.paciente_celular,
    'medico_nome', paciente_record.medico_nome,
    'atendimento_nome', paciente_record.atendimento_nome,
    'data_agendamento', NEW.data_agendamento,
    'hora_agendamento', NEW.hora_agendamento,
    'tempo_limite', NEW.tempo_limite
  );

  PERFORM net.http_post(
    url := 'https://n8n-medical.inovaia-automacao.com.br/webhook/fila-espera-notificar',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notificar_fila_webhook
AFTER INSERT ON public.fila_notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.notificar_fila_webhook();
```

Uma unica migration. Zero alterações de codigo frontend ou edge functions.

