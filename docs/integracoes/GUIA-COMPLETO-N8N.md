# 📘 Guia Completo: Conectando N8N ao Sistema de Agendamentos

## 🎯 Objetivo
Ao final deste guia, você terá o N8N conectado ao sistema e conseguirá criar agendamentos automaticamente.

---

## 📋 Checklist Inicial

Antes de começar, certifique-se que você tem:
- [ ] Sistema publicado no Lovable (botão "Publish")
- [ ] Conta no N8N (https://n8n.io) - pode ser gratuita
- [ ] Acesso ao Dashboard do Supabase

---

# PARTE 1: CONFIGURAÇÃO INICIAL (15 minutos)

## 🔐 Passo 1: Copiar sua API Key do Supabase

### 1.1 Acessar Dashboard Supabase
1. Abra em uma nova aba: https://supabase.com/dashboard/project/qxlvzbvzajibdtlzngdy/settings/functions
2. Faça login se necessário

### 1.2 Localizar a API Key
1. No menu lateral, clique em **⚙️ Project Settings**
2. Clique em **Edge Functions**
3. Role a página até encontrar a seção **"Secrets"**
4. Procure por: `N8N_API_KEY`
5. Clique no ícone 👁️ (olho) para revelar a chave
6. Clique no ícone 📋 (copiar) para copiar a chave

> ⚠️ **IMPORTANTE:** Esta chave é como uma senha! Não compartilhe com ninguém.

### 1.3 Salvar temporariamente
Cole a chave em um arquivo de texto temporário (você vai precisar dela no próximo passo).

**Exemplo de chave:**
```
sk_n8n_abc123def456ghi789jkl...
```

---

## 🤖 Passo 2: Configurar N8N

### 2.1 Criar conta no N8N (se ainda não tem)
1. Acesse: https://n8n.io
2. Clique em **"Get started for free"**
3. Crie sua conta (email + senha)
4. Confirme o email

### 2.2 Acessar N8N Cloud ou Self-Hosted
- **N8N Cloud:** Já vai abrir automaticamente após criar conta
- **Self-Hosted:** Acesse seu endereço local/servidor

### 2.3 Criar Credencial para API
1. No N8N, clique no ícone de **engrenagem ⚙️** (canto superior direito)
2. No menu lateral, clique em **"Credentials"**
3. Clique no botão **"+ Add Credential"** (canto superior direito)
4. Na busca, digite: **"Header Auth"**
5. Clique em **"Header Auth"**

### 2.4 Configurar a Credencial
Preencha os campos:

**Name:**
```
Sistema Agendamentos - API
```

**Header Name:**
```
x-api-key
```

**Header Value:**
```
[COLE AQUI A API KEY que você copiou no Passo 1]
```

6. Clique em **"Save"** (botão verde)

✅ **Sucesso!** Sua credencial foi criada.

---

## 🧪 Passo 3: Testar Conexão (Seu Primeiro Workflow)

### 3.1 Criar Novo Workflow
1. No menu lateral do N8N, clique em **"Workflows"**
2. Clique em **"+ Add Workflow"** (canto superior direito)
3. Dê um nome ao workflow: `Teste Conexão - Agendamentos`

### 3.2 Adicionar Node Manual
1. Clique no botão **"+"** grande no centro
2. Na busca, digite: **"Manual Trigger"**
3. Clique em **"On clicking 'execute'"**

### 3.3 Adicionar Node HTTP Request
1. Clique no **"+"** à direita do node "Manual Trigger"
2. Na busca, digite: **"HTTP Request"**
3. Clique em **"HTTP Request"**

### 3.4 Configurar HTTP Request
No node que abriu, configure:

**Method:**
```
GET
```

**URL:**
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api/medicos
```

**Authentication:**
1. Clique no dropdown
2. Selecione: **"Header Auth"**

**Credential for Header Auth:**
1. Clique no dropdown
2. Selecione: **"Sistema Agendamentos - API"** (a que você criou)

### 3.5 Executar o Teste
1. Clique no botão **"Execute Node"** (dentro do node HTTP Request)
2. Aguarde alguns segundos...

✅ **Resultado Esperado:**
Você verá um JSON com a lista de médicos:
```json
{
  "success": true,
  "medicos": [
    {
      "id": "...",
      "nome": "Dr. Nome do Médico",
      "especialidade": "...",
      ...
    }
  ]
}
```

❌ **Se der erro:**
- **401 Unauthorized:** API Key incorreta → Volte ao Passo 1 e copie a chave correta
- **404 Not Found:** URL incorreta → Copie e cole a URL exatamente como mostrado
- **Timeout:** Sistema não publicado → Publique no Lovable primeiro

---

# PARTE 2: CRIANDO SEU PRIMEIRO AGENDAMENTO (10 minutos)

## 📅 Passo 4: Obter IDs Necessários

Antes de criar um agendamento, você precisa de:
- ID de um médico
- ID de um atendimento/exame

### 4.1 Pegar ID do Médico
1. No resultado do teste anterior (Passo 3.5), copie o **`id`** de um médico
2. Salve temporariamente (ex: num bloco de notas)

**Exemplo:**
```
medico_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### 4.2 Listar Atendimentos
1. Crie um novo node **HTTP Request** no mesmo workflow
2. Configure:

**Method:** `GET`

**URL:**
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api/atendimentos
```

**Authentication:** `Header Auth` (mesma credencial)

3. Execute o node
4. Copie o **`id`** de um atendimento
5. Salve temporariamente

**Exemplo:**
```
atendimento_id: "z9y8x7w6-v5u4-3210-zyxw-vu9876543210"
```

---

## 🆕 Passo 5: Criar um Agendamento via N8N

### 5.1 Adicionar Node de Criação
1. Adicione um novo **HTTP Request** node
2. Configure:

**Method:**
```
POST
```

**URL:**
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api/agendamento
```

**Authentication:** `Header Auth` (mesma credencial)

### 5.2 Configurar Body
1. Clique na aba **"Body"**
2. Ative: **"Specify Body"** (toggle ON)
3. **Body Content Type:** Selecione `JSON`
4. Cole este JSON (SUBSTITUA os IDs pelos que você copiou):

```json
{
  "paciente_nome": "João da Silva Teste",
  "paciente_data_nascimento": "1990-05-15",
  "paciente_convenio": "UNIMED",
  "paciente_telefone": "1133334444",
  "paciente_celular": "11999998888",
  "medico_id": "COLE_AQUI_O_ID_DO_MEDICO",
  "atendimento_id": "COLE_AQUI_O_ID_DO_ATENDIMENTO",
  "data_agendamento": "2025-01-20",
  "hora_agendamento": "14:00",
  "observacoes": "Agendamento de teste via N8N"
}
```

### 5.3 Executar
1. Clique em **"Execute Node"**
2. Aguarde...

✅ **Resultado Esperado:**
```json
{
  "success": true,
  "agendamento": {
    "id": "...",
    "status": "agendado",
    "paciente_id": "...",
    ...
  }
}
```

### 5.4 Verificar no Sistema
1. Abra seu sistema publicado no Lovable
2. Faça login
3. Vá na tela de agendamentos
4. **Você deve ver o agendamento que acabou de criar!** 🎉

---

# PARTE 3: AUTOMATIZANDO (Opcional)

## 🔄 Passo 6: Criar Webhook para Receber Solicitações

### 6.1 Adicionar Webhook Trigger
1. Crie um **novo workflow**
2. Nome: `Agendamento Automático - Webhook`
3. Adicione node: **"Webhook"**
4. Configure:

**HTTP Method:** `POST`

**Path:**
```
agendar
```

5. Copie a **"Production URL"** que aparece
6. Salve o workflow

### 6.2 Testar Webhook
Use um cliente HTTP (Postman, Insomnia, ou curl):

```bash
curl -X POST \
  'SUA_WEBHOOK_URL_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "paciente_nome": "Maria Teste",
    "paciente_data_nascimento": "1985-03-20",
    "paciente_convenio": "UNIMED",
    "paciente_celular": "11988887777",
    "medico_id": "ID_DO_MEDICO",
    "atendimento_id": "ID_DO_ATENDIMENTO",
    "data_agendamento": "2025-01-25",
    "hora_agendamento": "10:00"
  }'
```

---

# PARTE 4: CASOS DE USO PRÁTICOS

## 💬 Caso 1: Bot WhatsApp

**Fluxo:**
```
WhatsApp Trigger →
Extrair dados da mensagem →
Listar médicos disponíveis →
Verificar disponibilidade →
Criar agendamento →
Enviar confirmação WhatsApp
```

## 📧 Caso 2: Email de Confirmação

**Fluxo:**
```
Webhook (novo agendamento) →
Buscar dados completos →
Enviar email Gmail/Outlook →
Salvar log
```

## 📅 Caso 3: Sincronizar com Google Calendar

**Fluxo:**
```
Cron (diário às 6h) →
Consultar agenda do dia →
Para cada agendamento:
  → Criar evento Google Calendar
```

---

# 📊 RESUMO - O QUE VOCÊ TEM AGORA

✅ **API REST completa** conectada ao sistema  
✅ **Credencial configurada** no N8N  
✅ **Primeiro teste bem-sucedido**  
✅ **Agendamento criado** via N8N  
✅ **Base para automações** complexas  

---

# 🆘 TROUBLESHOOTING

## Erro: "401 Unauthorized"
**Problema:** API Key incorreta  
**Solução:**
1. Volte ao Supabase Dashboard
2. Copie a API Key novamente
3. Atualize a credencial no N8N

## Erro: "404 Not Found"
**Problema:** URL incorreta ou sistema não publicado  
**Solução:**
1. Verifique se o sistema está publicado no Lovable
2. Copie a URL exatamente como mostrado no guia

## Erro: "400 Bad Request - Campos obrigatórios faltando"
**Problema:** JSON incompleto  
**Solução:**
Certifique-se que o JSON contém todos os campos:
- paciente_nome
- paciente_data_nascimento
- paciente_convenio
- paciente_celular
- medico_id
- atendimento_id
- data_agendamento
- hora_agendamento

## Agendamento não aparece no sistema
**Possíveis causas:**
1. Status diferente de 'agendado'
2. Data muito antiga (filtros ativos)
3. Médico inativo

**Solução:**
- Verifique o JSON de resposta do agendamento
- Tente com data futura
- Confirme que o médico está ativo

---

# 📚 PRÓXIMOS PASSOS

1. ✅ Teste todos os endpoints (consultar, remarcar, cancelar)
2. 🎨 Crie workflows personalizados para seu caso de uso
3. 🤖 Integre com WhatsApp/Telegram
4. 📊 Configure relatórios e dashboards
5. 🔔 Implemente lembretes automáticos

---

# 📞 DOCUMENTAÇÃO ADICIONAL

- **Referência completa da API:** `docs/integracoes/n8n-api-reference.md`
- **Exemplos de workflows:** `docs/integracoes/n8n-workflows-exemplos.md`
- **Troubleshooting avançado:** `docs/integracoes/n8n-troubleshooting.md`

---

# 🎉 PARABÉNS!

Você configurou com sucesso a integração N8N com o sistema de agendamentos!

Agora você pode criar automações poderosas para:
- Agendar via WhatsApp
- Enviar lembretes automáticos
- Sincronizar com calendários
- Gerar relatórios
- E muito mais!

**Boa automação! 🚀**
