# LLM Agent API - Clínica Vênus

## Visão Geral

API para integração com chatbot WhatsApp da Clínica Vênus via N8N.

## Informações da Clínica

| Campo | Valor |
|-------|-------|
| Nome | Clínica Vênus |
| Endereço | Rua das Orquídeas, 210 – Centro, Cidade Vênus – SP |
| WhatsApp | (11) 90000-0000 |
| Telefone | (11) 4000-0000 |
| E-mail | contato@clinicavenus.com |
| Horário | Seg-Sex: 08h-19h \| Sábado: 08h-12h |

## Equipe Médica

### Dr. João Silva - Cardiologista
- **Tipo de agendamento:** HORA MARCADA
- **Horários:**
  - Segunda e Quarta: 14h às 19h
  - Sexta: 08h às 12h
- **Serviços:** Consulta Cardiológica (R$ 300), Eletrocardiograma (R$ 150)
- **Retorno:** Gratuito em até 30 dias
- **Convênios:** PARTICULAR, UNIMED 40%, UNIMED 20%, UNIMED REGIONAL, UNIMED INTERCÂMBIO, UNIMED NACIONAL

### Dra. Gabriela Batista - Gastroenterologista
- **Tipo de agendamento:** ORDEM DE CHEGADA
- **Horários:**
  - Terça e Quinta: 08h às 16h
  - Sábado: 08h às 12h
- **Serviços:** Consulta Gastroenterológica (R$ 280), Endoscopia Digestiva Alta (R$ 500)
- **Retorno:** Gratuito em até 20 dias
- **Convênios:** PARTICULAR, UNIMED 40%, UNIMED 20%, UNIMED REGIONAL, UNIMED INTERCÂMBIO, UNIMED NACIONAL

---

## Base URL

```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api-venus
```

## Headers

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
}
```

---

## Endpoints

### 1. Verificar Disponibilidade

**POST** `/availability`

```json
{
  "medico_nome": "João Silva",
  "atendimento_nome": "consulta",
  "data_consulta": "2026-01-15",
  "periodo": "tarde",
  "quantidade_dias": 14
}
```

**Resposta:**
```json
{
  "success": true,
  "disponivel": true,
  "tipo_agendamento": "hora_marcada",
  "medico": "DR. JOÃO SILVA",
  "especialidade": "Cardiologista",
  "servico": "Consulta Cardiológica",
  "proximas_datas": [
    {
      "data": "15/01/2026",
      "data_iso": "2026-01-15",
      "dia_semana": "Quarta",
      "periodo": "Tarde",
      "horario_distribuicao": "14:00 às 19:00",
      "vagas_disponiveis": 10
    }
  ],
  "valor": 300,
  "convenios_aceitos": ["PARTICULAR", "UNIMED 40%", "..."],
  "mensagem_whatsapp": "..."
}
```

### 2. Agendar Consulta

**POST** `/schedule`

```json
{
  "paciente_nome": "Maria Silva",
  "data_nascimento": "15/03/1985",
  "convenio": "UNIMED REGIONAL",
  "telefone": "11900000000",
  "celular": "11900000000",
  "medico_nome": "João Silva",
  "atendimento_nome": "consulta cardiológica",
  "data_consulta": "2026-01-15",
  "hora_consulta": "14:30:00",
  "observacoes": "Paciente com histórico de hipertensão"
}
```

**Resposta:**
```json
{
  "success": true,
  "agendamento_id": "uuid-do-agendamento",
  "paciente_id": "uuid-do-paciente",
  "mensagem_whatsapp": "✅ AGENDAMENTO CONFIRMADO!..."
}
```

### 3. Verificar Agendamentos do Paciente

**POST** `/check-patient`

```json
{
  "paciente_nome": "Maria",
  "celular": "11900000000"
}
```

### 4. Cancelar Agendamento

**POST** `/cancel`

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "motivo": "Paciente solicitou cancelamento"
}
```

Ou buscar pelo paciente:
```json
{
  "paciente_nome": "Maria Silva",
  "celular": "11900000000"
}
```

### 5. Confirmar Presença

**POST** `/confirm`

```json
{
  "agendamento_id": "uuid-do-agendamento"
}
```

### 6. Listar Médicos

**POST** `/list-doctors`

(Sem body necessário)

### 7. Informações da Clínica

**POST** `/clinic-info`

(Sem body necessário)

---

## Exemplo de Workflow N8N

### Nó 1: Webhook (Receber mensagem WhatsApp)

```
Method: POST
Path: /webhook/clinica-venus
```

### Nó 2: Function (Processar intenção)

```javascript
const message = $input.first().json.body.message?.conversation || '';
const from = $input.first().json.body.key?.remoteJid?.replace('@s.whatsapp.net', '');

let intent = 'unknown';
let params = { celular: from };

const msgLower = message.toLowerCase();

if (msgLower.includes('agendar') || msgLower.includes('marcar')) {
  intent = 'schedule';
} else if (msgLower.includes('cancelar')) {
  intent = 'cancel';
} else if (msgLower.includes('confirmar') || message === '1') {
  intent = 'confirm';
} else if (msgLower.includes('horário') || msgLower.includes('disponib')) {
  intent = 'availability';
} else if (msgLower.includes('consulta') || msgLower.includes('agendamento')) {
  intent = 'check-patient';
} else if (msgLower.includes('médico') || msgLower.includes('doutor')) {
  intent = 'list-doctors';
}

return { intent, params, message, from };
```

### Nó 3: HTTP Request (Chamar API)

```
URL: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api-venus/{{ $json.intent }}
Method: POST
Headers:
  - Content-Type: application/json
  - Authorization: Bearer <TOKEN>
Body: {{ JSON.stringify($json.params) }}
```

### Nó 4: Send WhatsApp (Responder)

```
Phone: {{ $('Webhook').item.json.from }}
Message: {{ $json.mensagem_whatsapp || $json.message }}
```

---

## Tratamento de Erros

Todas as respostas retornam HTTP 200 com estrutura JSON:

**Sucesso:**
```json
{
  "success": true,
  ...dados
}
```

**Erro:**
```json
{
  "success": false,
  "codigo_erro": "MEDICO_NAO_ENCONTRADO",
  "mensagem_usuario": "Texto amigável para o paciente"
}
```

### Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| MEDICO_NAO_ENCONTRADO | Médico não existe ou nome incorreto |
| ATENDIMENTO_NAO_ENCONTRADO | Tipo de consulta/exame não disponível |
| SEM_DISPONIBILIDADE | Sem vagas no período solicitado |
| AGENDAMENTO_NAO_ENCONTRADO | Não há agendamento para o paciente |
| DADOS_INCOMPLETOS | Faltam dados obrigatórios |
| ERRO_AGENDAMENTO | Erro ao criar/modificar agendamento |

---

## Formas de Pagamento

- Pix
- Cartão (débito/crédito)
- Dinheiro

**Observação para Unimed:** Caso o plano Unimed seja coparticipação ou particular, recebemos apenas em espécie.
