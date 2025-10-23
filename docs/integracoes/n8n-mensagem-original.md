# 💬 Campo `mensagem_original` na LLM Agent API

## 🎯 Propósito
Permite que a API de availability tenha acesso ao contexto completo da pergunta do usuário, melhorando significativamente a precisão na interpretação de consultas ambíguas.

## 📊 Impacto

### Antes (sem mensagem_original)
```
Usuário: "quando tem vaga para a dra adriana?"
N8N extrai: { medico_nome: "Dra Adriana", atendimento_nome: "Consulta" }
API: Retorna próximas datas (funciona, mas sem contexto do tipo de pergunta)
```

### Depois (com mensagem_original)
```
Usuário: "quando tem vaga para a dra adriana?"
N8N extrai: { 
  medico_nome: "Dra Adriana", 
  atendimento_nome: "Consulta",
  mensagem_original: "quando tem vaga para a dra adriana?"
}
API: Detecta pergunta aberta + logs contextualizados + pode expandir busca
```

---

## 📝 Exemplos de Uso

### Exemplo 1: Pergunta Aberta
**Mensagem do Usuário**: "quando tem vaga para a dra adriana?"

**Dados Enviados para API**:
```json
{
  "medico_nome": "Dra Adriana",
  "atendimento_nome": "Consulta Endocrinológica",
  "mensagem_original": "quando tem vaga para a dra adriana?"
}
```

**Comportamento da API**: 
- Detecta palavras-chave: "quando" → pergunta aberta
- Busca múltiplas datas disponíveis (padrão: 14 dias)
- Logs: `🔍 Pergunta aberta detectada. Buscando múltiplas datas disponíveis.`

---

### Exemplo 2: Data Específica
**Mensagem do Usuário**: "tem vaga dia 15/01 com a dra adriana?"

**Dados Enviados para API**:
```json
{
  "medico_nome": "Dra Adriana",
  "atendimento_nome": "Consulta",
  "data_consulta": "2026-01-15",
  "mensagem_original": "tem vaga dia 15/01 com a dra adriana?"
}
```

**Comportamento da API**: 
- Verifica disponibilidade apenas para 15/01/2026
- Mensagem original ajuda a confirmar intenção do usuário

---

### Exemplo 3: Dia da Semana (futuro)
**Mensagem do Usuário**: "tem vaga na segunda com a dra adriana?"

**Dados Enviados para API**:
```json
{
  "medico_nome": "Dra Adriana",
  "atendimento_nome": "Consulta",
  "mensagem_original": "tem vaga na segunda com a dra adriana?"
}
```

**Comportamento da API**: 
- Detecta menção a dia da semana: "segunda" → dia 1
- Logs: `📅 Dia da semana detectado na mensagem: segunda (1)`
- Nota: Filtro por dia da semana pode ser implementado futuramente

---

## 🔧 Schema da API

### Endpoint: `/llm-agent-api/availability`

**Request Body**:
```typescript
{
  medico_nome?: string;           // Nome do médico (busca parcial aceita)
  medico_id?: string;             // ID do médico (busca exata)
  atendimento_nome: string;       // OBRIGATÓRIO: tipo de atendimento
  data_consulta?: string;         // Formato: YYYY-MM-DD ou DD/MM/YYYY
  dias_busca?: number;            // Padrão: 14 dias
  mensagem_original?: string;     // 🆕 NOVO: texto original do paciente
}
```

**Response**:
```typescript
{
  success: boolean;
  disponivel: boolean;
  medico?: string;
  servico?: string;
  data?: string;
  horarios?: Array<{
    data: string;
    periodo: string;
    tipo: string;
  }>;
  bloqueada?: boolean;           // Se agenda está bloqueada
  motivo_bloqueio?: string;      // Motivo do bloqueio
  message?: string;
}
```

---

## 🧪 Testes

### Teste 1: Pergunta Aberta
```bash
curl -X POST https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability \
  -H "apikey: YOUR_SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "medico_nome": "Dra Adriana",
    "atendimento_nome": "Consulta Endocrinológica",
    "mensagem_original": "quando tem vaga para a dra adriana?"
  }'
```

**Resultado Esperado**: 
- ✅ Múltiplas datas disponíveis
- ✅ Log: `🔍 Pergunta aberta detectada`

---

### Teste 2: Data Específica
```bash
curl -X POST https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability \
  -H "apikey: YOUR_SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "medico_nome": "Dra Adriana",
    "atendimento_nome": "Consulta",
    "data_consulta": "2026-01-15",
    "mensagem_original": "tem vaga dia 15/01 com a dra adriana?"
  }'
```

**Resultado Esperado**: 
- ✅ Disponibilidade apenas para 15/01/2026

---

### Teste 3: Retrocompatibilidade (sem mensagem_original)
```bash
curl -X POST https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability \
  -H "apikey: YOUR_SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "medico_nome": "Dra Adriana",
    "atendimento_nome": "Consulta"
  }'
```

**Resultado Esperado**: 
- ✅ Funciona normalmente (sem logs de mensagem original)

---

## 🔍 Palavras-chave Detectadas

### Perguntas Abertas
- "quando"
- "próxima" / "proxima"
- "disponível" / "disponivel"

### Dias da Semana
- domingo (0), segunda (1), terça/terca (2)
- quarta (3), quinta (4), sexta (5)
- sábado/sabado (6)

---

## 🚀 Configuração no N8N

### Tool "📅 Horários Disponíveis"

**Body Parameters**:
```json
{
  "name": "mensagem_original",
  "value": "={{ $json.mensagem_original || $('Webhook WhatsApp').item.json.body.message.text }}"
}
```

**Explicação**:
- Prioriza `$json.mensagem_original` se já extraído pelo AI Agent
- Fallback para texto bruto do WhatsApp se não disponível

---

## ✅ Benefícios

1. **Melhor Compreensão**: API entende contexto da pergunta
2. **Logs Melhores**: Debugging mais fácil com contexto completo
3. **Retrocompatível**: Campo opcional, não quebra integrações existentes
4. **Futuro-Proof**: Base para features futuras (filtro por dia da semana, horário preferido, etc.)

---

## 📚 Referências

- [LLM Agent API Documentation](./n8n-llm-whatsapp-guide.md)
- [N8N Workflow Setup](./n8n-tutorial-visual.md)
- [Supabase Edge Functions](../../supabase/functions/llm-agent-api/index.ts)
