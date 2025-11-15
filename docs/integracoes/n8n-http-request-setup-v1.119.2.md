# Configuração N8N v1.119.2 - HTTP Request para LLM Agent API

## 📋 Informações Gerais

**Base URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api`

**Headers Obrigatórios** (todos os endpoints):
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8
```

---

## 🔧 Configuração dos Nós HTTP Request

### ⚙️ Configurações Globais (Todos os nós)

1. **Authentication**: `None` (auth vai no header)
2. **Request Method**: `POST` (todas as tools usam POST)
3. **Send Body**: ✅ Ativado
4. **Body Content Type**: `JSON`
5. **JSON/RAW Parameters**: Usar o campo `Body` com JSON

---

## 🩺 Tool 1: VERIFICAR_PACIENTE (Consultar Agendamentos)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/check-patient`

**Method**: `POST`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
}
```

**Body (JSON)**:
```json
{
  "paciente_nome": "Gabriela Lima de Morais",
  "data_nascimento": "03/04/2001",
  "celular": "87991311991"
}
```

**Campos**:
- `paciente_nome` (opcional): Nome completo do paciente
- `data_nascimento` (opcional): Formato DD/MM/YYYY ou YYYY-MM-DD
- `celular` (opcional): Telefone com DDD (sem formatação)

**⚠️ Importante**: Pelo menos 1 campo deve ser preenchido. Aceita valores como `"indefinido"` que serão ignorados automaticamente.

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "1 consulta(s) encontrada(s)",
  "consultas": [
    {
      "id": "uuid",
      "paciente": "GABRIELA LIMA DE MORAIS",
      "medico": "DR. MARCELO D'CARLI",
      "especialidade": "Cardiologia",
      "atendimento": "Consulta Cardiológica",
      "data": "2025-01-15",
      "hora": "07:00",
      "status": "agendado",
      "convenio": "SUS"
    }
  ],
  "total": 1
}
```

---

## 📅 Tool 2: CONSULTAR_DISPONIBILIDADE (Horários Livres)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability`

**Method**: `POST`

**Headers**: (mesmos da Tool 1)

**Body (JSON)**:
```json
{
  "medico_nome": "Dr. Marcelo D'Carli",
  "atendimento_nome": "Consulta Cardiológica",
  "data_consulta": "2025-01-20"
}
```

**Campos**:
- `medico_nome` (opcional): Nome do médico (fuzzy search)
- `medico_id` (opcional): UUID do médico (mais preciso)
- `atendimento_nome` (opcional): Nome do serviço
- `data_consulta` (opcional): Data específica (YYYY-MM-DD ou DD/MM/YYYY)
- `periodo` (opcional): "manha", "tarde", ou "noite"

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "12 horários disponíveis encontrados",
  "medico": "DR. MARCELO D'CARLI",
  "medico_id": "1e110923-50df-46ff-a57a-29d88e372900",
  "atendimento": "Consulta Cardiológica",
  "data": "2025-01-20",
  "horarios_disponiveis": [
    {
      "hora": "07:00:00",
      "disponivel": true,
      "periodo": "manhã",
      "tipo": "ordem_chegada",
      "vagas_restantes": 5
    },
    {
      "hora": "08:00:00",
      "disponivel": true,
      "periodo": "manhã"
    }
  ]
}
```

---

## ✅ Tool 3: AGENDAR_CONSULTA (Criar Agendamento)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/schedule`

**Method**: `POST`

**Headers**: (mesmos da Tool 1)

**Body (JSON)**:
```json
{
  "paciente_nome": "Gabriela Lima de Morais",
  "data_nascimento": "03/04/2001",
  "convenio": "SUS",
  "telefone": "8733334444",
  "celular": "87991311991",
  "medico_nome": "Dr. Marcelo D'Carli",
  "atendimento_nome": "Consulta Cardiológica",
  "data_consulta": "2025-01-20",
  "hora_consulta": "07:00",
  "observacoes": "Agendado via WhatsApp"
}
```

**Campos Obrigatórios**:
- ✅ `paciente_nome`: Nome completo
- ✅ `data_nascimento`: DD/MM/YYYY ou YYYY-MM-DD
- ✅ `convenio`: SUS, UNIMED, PARTICULAR, etc.
- ✅ `celular`: Telefone com DDD
- ✅ `medico_nome` ou `medico_id`: Identificação do médico
- ✅ `atendimento_nome` ou `atendimento_id`: Identificação do serviço
- ✅ `data_consulta`: Data do agendamento
- ✅ `hora_consulta`: Hora no formato HH:MM

**Campos Opcionais**:
- `telefone`: Telefone fixo
- `observacoes`: Notas adicionais

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "Consulta agendada com sucesso para GABRIELA LIMA DE MORAIS",
  "agendamento_id": "uuid",
  "paciente_id": "uuid",
  "medico": "DR. MARCELO D'CARLI",
  "atendimento": "Consulta Cardiológica",
  "data": "2025-01-20",
  "hora": "07:00",
  "convenio": "SUS",
  "tipo_agendamento": "ordem_chegada",
  "instrucoes": "Compareça às 07:45. Distribuição de fichas: 07:00 às 09:30"
}
```

---

## 🔄 Tool 4: REMARCAR_CONSULTA (Alterar Data/Hora)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/reschedule`

**Method**: `POST`

**Headers**: (mesmos da Tool 1)

**Body (JSON)**:
```json
{
  "agendamento_id": "uuid-do-agendamento",
  "nova_data": "2025-01-22",
  "nova_hora": "08:00",
  "observacoes": "Remarcado a pedido do paciente"
}
```

**Campos Obrigatórios**:
- ✅ `agendamento_id`: UUID do agendamento (obtido via VERIFICAR_PACIENTE)
- ✅ `nova_data`: Nova data (YYYY-MM-DD ou DD/MM/YYYY)
- ✅ `nova_hora`: Novo horário (HH:MM)

**Campos Opcionais**:
- `observacoes`: Motivo da remarcação

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "Consulta remarcada com sucesso",
  "agendamento_id": "uuid",
  "data_anterior": "2025-01-20",
  "hora_anterior": "07:00",
  "nova_data": "2025-01-22",
  "nova_hora": "08:00"
}
```

---

## ❌ Tool 5: CANCELAR_CONSULTA (Cancelar Agendamento)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/cancel`

**Method**: `POST`

**Headers**: (mesmos da Tool 1)

**Body (JSON)**:
```json
{
  "agendamento_id": "uuid-do-agendamento",
  "motivo": "Paciente não poderá comparecer"
}
```

**Campos Obrigatórios**:
- ✅ `agendamento_id`: UUID do agendamento

**Campos Opcionais**:
- `motivo`: Motivo do cancelamento

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "Consulta cancelada com sucesso",
  "agendamento_id": "uuid",
  "paciente": "GABRIELA LIMA DE MORAIS",
  "data": "2025-01-20",
  "hora": "07:00"
}
```

---

## ✔️ Tool 6: CONFIRMAR_CONSULTA (Confirmar Agendamento)

### Configuração HTTP Request Node

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/confirm`

**Method**: `POST`

**Headers**: (mesmos da Tool 1)

**Body (JSON)**:
```json
{
  "agendamento_id": "uuid-do-agendamento"
}
```

**Campos Obrigatórios**:
- ✅ `agendamento_id`: UUID do agendamento

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "Consulta confirmada com sucesso",
  "agendamento_id": "uuid",
  "paciente": "GABRIELA LIMA DE MORAIS",
  "data": "2025-01-20",
  "hora": "07:00",
  "confirmado_em": "2025-01-15T10:30:00"
}
```

---

## 🛠️ Configuração Passo a Passo no N8N v1.119.2

### 1. Adicionar Nó HTTP Request

1. Clique no botão `+` no canvas
2. Procure por "HTTP Request"
3. Selecione "HTTP Request"

### 2. Configurar URL e Método

1. **URL**: Cole a URL completa da tool desejada
2. **Method**: Selecione `POST`
3. **Authentication**: `None`

### 3. Adicionar Headers

1. Clique em "Add Option"
2. Selecione "Headers"
3. Adicione 2 headers:
   - **Name**: `Content-Type` → **Value**: `application/json`
   - **Name**: `Authorization` → **Value**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (token completo)

### 4. Configurar Body

1. Em "Send Body": Ative ✅
2. Em "Body Content Type": Selecione `JSON`
3. Em "Specify Body": Selecione `Using JSON`
4. No campo "JSON": Cole o JSON de exemplo da tool
5. Substitua valores fixos por expressões N8N:
   ```json
   {
     "paciente_nome": "{{ $json.nome }}",
     "celular": "{{ $json.telefone }}",
     "data_nascimento": "{{ $json.data_nasc }}"
   }
   ```

### 5. Configurar Tratamento de Erros

1. Clique em "Add Option"
2. Selecione "Ignore SSL Issues" (se necessário)
3. Em "Retry on Fail": Configure tentativas automáticas

---

## 🐛 Tratamento de Erros Comuns

### Erro 400: Bad Request
```json
{
  "error": "Campos obrigatórios ausentes",
  "missing_fields": ["paciente_nome", "celular"]
}
```
**Solução**: Verificar se todos os campos obrigatórios estão no body.

### Erro 404: Not Found
```json
{
  "error": "Médico não encontrado: Dr. João"
}
```
**Solução**: Verificar nome do médico (usar fuzzy search ou obter lista de médicos).

### Erro 409: Conflict
```json
{
  "error": "Horário já está ocupado",
  "conflito": {
    "data": "2025-01-20",
    "hora": "07:00",
    "paciente_existente": "Maria Silva"
  }
}
```
**Solução**: Consultar disponibilidade antes de agendar.

### Erro 422: Business Rule Violation
```json
{
  "error": "Este serviço não requer agendamento online",
  "servico": "ECG",
  "instrucoes": "Compareça por ordem de chegada..."
}
```
**Solução**: Informar ao paciente as instruções corretas.

---

## 📊 Exemplo de Workflow Completo

```
[Webhook WhatsApp] 
    ↓
[Function: Extrair Dados da Mensagem]
    ↓
[HTTP Request: VERIFICAR_PACIENTE] ← Busca consultas existentes
    ↓
[IF: Paciente já tem consulta?]
    ├─ SIM → [Formatar Resposta: "Você já tem consulta marcada..."]
    └─ NÃO → [HTTP Request: CONSULTAR_DISPONIBILIDADE]
                ↓
             [IF: Horário disponível?]
                ├─ SIM → [HTTP Request: AGENDAR_CONSULTA]
                │           ↓
                │        [Formatar Resposta: "Consulta agendada!"]
                └─ NÃO → [Formatar Resposta: "Horário indisponível"]
                            ↓
                         [WhatsApp: Enviar Resposta]
```

---

## 🔍 Dicas de Debugging

### 1. Testar no Postman Primeiro
Antes de configurar no N8N, teste os endpoints no Postman para garantir que funcionam.

### 2. Usar o Editor de Expressões do N8N
Para campos dinâmicos, use expressões como:
```javascript
{{ $json.campo_anterior }}
{{ $node["Nome do Nó Anterior"].json.campo }}
```

### 3. Verificar Logs da Edge Function
Acesse o Supabase Dashboard → Edge Functions → Logs para ver erros detalhados.

### 4. Adicionar Function Node de Log
```javascript
// Adicione ANTES do HTTP Request
console.log('Dados enviados:', $input.all());
return $input.all();
```

---

## 🆘 Suporte

**Problemas com a API?**
1. Verifique os logs no Supabase Dashboard
2. Confirme que o token de autorização está correto
3. Valide o formato dos dados no body

**Problemas no N8N?**
1. Execute o workflow manualmente com dados de teste
2. Verifique a saída de cada nó
3. Use o "Run Node" para testar individualmente

---

## 📚 Referências

- [Documentação N8N HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [N8N Expressions](https://docs.n8n.io/code/expressions/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
