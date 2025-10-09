# 🚀 Setup Rápido - N8N com Sistema de Agendamentos

## ✅ Pré-requisitos
- Sistema publicado no Lovable
- Conta N8N (cloud ou self-hosted)
- API Key configurada no Supabase

---

## 🔑 Passo 1: Obter sua API Key

1. Acesse: https://supabase.com/dashboard/project/qxlvzbvzajibdtlzngdy/settings/functions
2. Vá em **Edge Functions → Secrets**
3. Localize o secret `N8N_API_KEY`
4. Copie o valor (você vai precisar dele no N8N)

> ⚠️ **Segurança:** Nunca compartilhe esta chave! Ela dá acesso total ao sistema.

---

## 🤖 Passo 2: Configurar N8N

### 2.1 Adicionar Credencial (Header Auth)

1. No N8N, vá em **Settings → Credentials**
2. Clique em **Add Credential**
3. Procure por **"Header Auth"**
4. Configure:
   - **Name:** `Sistema Agendamentos API`
   - **Header Name:** `x-api-key`
   - **Header Value:** Cole a API Key copiada do Supabase
5. Clique em **Save**

### 2.2 Importar Workflow de Exemplo

1. No N8N, clique em **Workflows → Add Workflow**
2. Clique nos 3 pontinhos (⋮) → **Import from File**
3. Selecione o arquivo: `docs/integracoes/n8n-workflow-exemplo.json`
4. O workflow será importado automaticamente

### 2.3 Configurar Autenticação nos Nodes

Para **cada HTTP Request node** no workflow:

1. Abra o node
2. Em **Authentication**, selecione: `Header Auth`
3. Em **Credential for Header Auth**, selecione: `Sistema Agendamentos API`
4. Salve o node

---

## 🧪 Passo 3: Testar a Conexão

### Teste 1: Listar Médicos

1. Crie um novo workflow
2. Adicione um **HTTP Request node**
3. Configure:
   - **Method:** GET
   - **URL:** `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/n8n-api/medicos`
   - **Authentication:** Header Auth (use a credencial criada)
4. Clique em **Execute Node**

✅ **Resultado esperado:** Lista de médicos em JSON

❌ **Se der erro:**
- Verifique se a API Key está correta
- Confirme que a URL está completa
- Veja os logs da Edge Function no Supabase

---

## 📋 Passo 4: Casos de Uso Práticos

### Caso 1: Bot WhatsApp que Agenda Consultas

```
Webhook (WhatsApp) → 
Listar Médicos → 
Verificar Disponibilidade → 
Criar Agendamento → 
Enviar Confirmação (WhatsApp)
```

### Caso 2: Integração com Google Calendar

```
Cron Trigger (diário) → 
Consultar Agenda → 
Criar Eventos no Google Calendar
```

### Caso 3: Envio de Lembretes Automáticos

```
Cron Trigger (manhã) → 
Consultar Agenda (dia seguinte) → 
Enviar SMS/WhatsApp para cada paciente
```

---

## 🎯 Endpoints Mais Usados

| Ação | Método | Endpoint |
|------|--------|----------|
| Listar médicos | GET | `/medicos` |
| Listar atendimentos | GET | `/atendimentos` |
| Verificar disponibilidade | GET | `/disponibilidade` |
| Consultar agenda | GET | `/agenda` |
| Criar agendamento | POST | `/agendamento` |
| Remarcar agendamento | PUT | `/agendamento/{id}` |
| Cancelar agendamento | DELETE | `/agendamento/{id}` |

---

## 🔒 Boas Práticas de Segurança

1. **Nunca exponha a API Key:**
   - Use sempre credenciais do N8N
   - Não coloque a chave diretamente nos workflows
   - Não commite em repositórios Git

2. **Valide dados de entrada:**
   - Sempre valide telefones, datas, horários
   - Use nodes de validação antes de criar agendamentos

3. **Trate erros adequadamente:**
   - Adicione nodes de tratamento de erro
   - Envie notificações se algo falhar
   - Não exponha mensagens de erro técnicas para usuários finais

4. **Monitore uso:**
   - Verifique logs regularmente no Supabase
   - Configure alertas para erros frequentes
   - Audite acessos suspeitos

---

## 📚 Próximos Passos

1. ✅ Testar todos os endpoints manualmente
2. 📖 Ler documentação completa: `docs/integracoes/n8n-api-reference.md`
3. 🎨 Criar workflows personalizados para seu caso de uso
4. 🤖 Integrar com WhatsApp, Telegram, ou outras plataformas
5. 📊 Configurar dashboards e relatórios

---

## 🆘 Problemas Comuns

### Erro 401 - Unauthorized
- **Causa:** API Key inválida ou ausente
- **Solução:** Verifique se configurou a credencial Header Auth corretamente

### Erro 404 - Not Found
- **Causa:** URL incorreta ou endpoint não existe
- **Solução:** Confira a URL base e o caminho do endpoint

### Erro 400 - Bad Request
- **Causa:** Parâmetros obrigatórios faltando
- **Solução:** Veja a documentação do endpoint e envie todos os campos obrigatórios

### Erro 500 - Internal Server Error
- **Causa:** Problema no servidor ou lógica da API
- **Solução:** Veja os logs da Edge Function no Supabase Dashboard

---

## 💡 Dicas Pro

1. **Use variáveis de ambiente no N8N** para facilitar mudança entre dev/prod
2. **Crie workflows reutilizáveis** com sub-workflows
3. **Implemente retry logic** para operações críticas
4. **Cache dados** que não mudam frequentemente (médicos, atendimentos)
5. **Teste em homologação** antes de usar em produção

---

## 📞 Suporte

- 📖 Documentação completa: `n8n-api-reference.md`
- 🎥 Exemplos de workflows: `n8n-workflows-exemplos.md`
- 🔧 Troubleshooting: `n8n-troubleshooting.md`
- 📊 Dashboard Supabase: https://supabase.com/dashboard/project/qxlvzbvzajibdtlzngdy
