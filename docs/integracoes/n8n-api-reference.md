# API N8N - Documentação Completa

## 🔐 Autenticação

Todas as requisições devem incluir o header:
```
x-api-key: SUA_API_KEY_AQUI
```

**Onde encontrar a API Key:**
1. Acesse o Dashboard Supabase
2. Vá em Project Settings → Edge Functions → Secrets
3. Copie o valor de `N8N_API_KEY`

---

## 📋 Base URL

**Desenvolvimento:** `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api`

**Produção:** (após publicar no Lovable com domínio próprio)

---

## 🩺 Endpoints Disponíveis

### 1. **Listar Médicos**
```http
GET /medicos
```

**Resposta:**
```json
{
  "success": true,
  "medicos": [
    {
      "id": "uuid",
      "nome": "Dr. João Silva",
      "especialidade": "Gastroenterologia",
      "convenios_aceitos": ["UNIMED", "BRADESCO"],
      "ativo": true,
      "horarios": {...}
    }
  ]
}
```

---

### 2. **Listar Atendimentos/Exames**
```http
GET /atendimentos
```

**Resposta:**
```json
{
  "success": true,
  "atendimentos": [
    {
      "id": "uuid",
      "nome": "Endoscopia Digestiva Alta",
      "tipo": "exame",
      "codigo": "EDA001",
      "medico_id": "uuid",
      "ativo": true
    }
  ]
}
```

---

### 3. **Consultar Disponibilidade**
```http
GET /disponibilidade?medico_id=UUID&data_inicio=2025-01-10&data_fim=2025-01-17
```

**Parâmetros:**
- `medico_id` (obrigatório): UUID do médico
- `data_inicio` (obrigatório): Data início (YYYY-MM-DD)
- `data_fim` (obrigatório): Data fim (YYYY-MM-DD)

**Resposta:**
```json
{
  "success": true,
  "horarios_ocupados": [
    {
      "data_agendamento": "2025-01-10",
      "hora_agendamento": "14:00"
    }
  ]
}
```

---

### 4. **Consultar Agenda**
```http
GET /agenda?data=2025-01-10&medico_id=UUID
```

**Parâmetros (opcionais):**
- `data`: Filtrar por data específica (YYYY-MM-DD)
- `medico_id`: Filtrar por médico específico

**Resposta:**
```json
{
  "success": true,
  "agendamentos": [
    {
      "id": "uuid",
      "data_agendamento": "2025-01-10",
      "hora_agendamento": "14:00",
      "status": "agendado",
      "observacoes": "Paciente em jejum",
      "convenio": "UNIMED",
      "pacientes": {
        "nome_completo": "Maria Santos",
        "celular": "11999998888",
        "data_nascimento": "1980-05-15"
      },
      "medicos": {
        "nome": "Dr. João Silva",
        "especialidade": "Gastroenterologia"
      },
      "atendimentos": {
        "nome": "Endoscopia",
        "tipo": "exame"
      }
    }
  ]
}
```

---

### 5. **Criar Agendamento**
```http
POST /agendamento
```

**Body (JSON):**
```json
{
  "paciente_nome": "Maria Santos",
  "paciente_data_nascimento": "1980-05-15",
  "paciente_convenio": "UNIMED",
  "paciente_telefone": "1133334444",
  "paciente_celular": "11999998888",
  "medico_id": "uuid-do-medico",
  "atendimento_id": "uuid-do-atendimento",
  "data_agendamento": "2025-01-15",
  "hora_agendamento": "14:00",
  "observacoes": "Paciente diabético, trazer exames anteriores"
}
```

**Campos Obrigatórios:**
- ✅ paciente_nome
- ✅ paciente_data_nascimento
- ✅ paciente_convenio
- ✅ paciente_celular
- ✅ medico_id
- ✅ atendimento_id
- ✅ data_agendamento
- ✅ hora_agendamento

**Resposta:**
```json
{
  "success": true,
  "agendamento": {
    "id": "uuid",
    "status": "agendado",
    ...
  }
}
```

---

### 6. **Remarcar Agendamento**
```http
PUT /agendamento/{id}
```

**Body (JSON):**
```json
{
  "data_agendamento": "2025-01-20",
  "hora_agendamento": "10:00",
  "observacoes": "Remarcado a pedido do paciente"
}
```

**Resposta:**
```json
{
  "success": true,
  "agendamento": {...}
}
```

---

### 7. **Cancelar Agendamento**
```http
DELETE /agendamento/{id}
```

**Resposta:**
```json
{
  "success": true,
  "agendamento": {
    "id": "uuid",
    "status": "cancelado",
    ...
  }
}
```

---

## 🤖 Exemplo de Workflow N8N

### 1. **HTTP Request Node (N8N)**

**Configuração:**
- Method: `POST`
- URL: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api/agendamento`
- Headers:
  - `x-api-key`: `{{$env.N8N_API_KEY}}`
  - `Content-Type`: `application/json`

**Body:**
```json
{
  "paciente_nome": "{{$json.paciente_nome}}",
  "paciente_data_nascimento": "{{$json.data_nascimento}}",
  "paciente_convenio": "{{$json.convenio}}",
  "paciente_celular": "{{$json.celular}}",
  "medico_id": "{{$json.medico_id}}",
  "atendimento_id": "{{$json.atendimento_id}}",
  "data_agendamento": "{{$json.data}}",
  "hora_agendamento": "{{$json.hora}}",
  "observacoes": "Agendado via bot WhatsApp"
}
```

---

## 🔒 Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 401 | API Key inválida ou ausente |
| 400 | Parâmetros obrigatórios faltando |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## 📝 Notas Importantes

1. **Todos os horários são em UTC-3 (horário de Brasília)**
2. **Formato de data:** YYYY-MM-DD
3. **Formato de hora:** HH:MM (24h)
4. **UUIDs:** Use os IDs retornados pelas consultas de médicos/atendimentos
5. **Pacientes duplicados:** O sistema evita duplicação por nome + data de nascimento
6. **Status de agendamento:** `agendado`, `confirmado`, `cancelado`

---

## 🚀 Como Configurar no N8N

1. **Salve sua API Key** no N8N:
   - Settings → Environments → Add Variable
   - Nome: `N8N_API_KEY`
   - Valor: (copie do Supabase Dashboard)

2. **Crie um workflow** com HTTP Request nodes

3. **Configure headers** em todas as requisições:
   ```
   x-api-key: {{$env.N8N_API_KEY}}
   ```

4. **Teste primeiro** com GET /medicos para validar conexão

---

## 📞 Suporte

Em caso de dúvidas ou erros:
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Confirme que a API Key está correta
3. Valide o formato JSON das requisições
4. Teste endpoints individuais antes de workflows complexos
