# N8N Troubleshooting Guide

## 1. Problemas Comuns de Conexão

### Erro: "Connection refused"
**Causa**: URL incorreta ou serviço indisponível
**Solução**:
```javascript
// Verificar URL base
const baseUrl = "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api";

// Testar conectividade
fetch(baseUrl)
  .then(response => console.log("Status:", response.status))
  .catch(error => console.error("Erro:", error));
```

### Erro: "Unauthorized"
**Causa**: Token de autorização inválido ou ausente
**Solução**:
```json
{
  "headers": {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8",
    "Content-Type": "application/json"
  }
}
```

### Erro: "CORS policy"
**Causa**: Headers CORS não configurados
**Solução**: A API já possui CORS configurado. Verifique se está usando HTTPS.

## 2. Problemas de Validação

### Erro: "Médico não encontrado"
**Causa**: ID do médico inválido
**Debug**:
```javascript
// Function Node para verificar médicos disponíveis
const response = await fetch('https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api');
const data = await response.json();
console.log("Médicos disponíveis:", data.medicos);
```

### Erro: "Este horário já está ocupado"
**Causa**: Conflito de agendamento
**Solução**:
```javascript
// Verificar disponibilidade antes de agendar
const checkUrl = `${baseUrl}/availability?doctorId=${doctorId}&date=${date}`;
const availability = await fetch(checkUrl);
const slots = await availability.json();
console.log("Horários livres:", slots);
```

### Erro: "Idade incompatível"
**Causa**: Paciente fora da faixa etária do médico
**Debug**:
```javascript
// Calcular idade do paciente
const birthDate = new Date($node["Input"].json.data_nascimento);
const today = new Date();
const age = today.getFullYear() - birthDate.getFullYear();
console.log("Idade do paciente:", age);
```

## 3. Problemas de Parsing

### WhatsApp Message Parsing
**Problema**: Dados não extraídos corretamente
**Solução**:
```javascript
// Function Node robusto para parsing
function parseWhatsAppMessage(message) {
  const cleanMessage = message.toLowerCase().normalize('NFD');
  
  const patterns = {
    nome: /(?:nome|paciente):\s*(.+?)(?:\n|$)/i,
    nascimento: /(?:nascimento|nasc):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    convenio: /(?:convenio|conv):\s*(.+?)(?:\n|$)/i,
    data: /(?:data|dia):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    hora: /(?:hora|horario):\s*(\d{1,2}:\d{2})/i,
    medico: /(?:medico|dr|dra):\s*(.+?)(?:\n|$)/i
  };
  
  const result = {};
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = cleanMessage.match(pattern);
    if (match) {
      result[key] = match[1].trim();
    }
  }
  
  // Validar campos obrigatórios
  const required = ['nome', 'data', 'hora'];
  const missing = required.filter(field => !result[field]);
  
  if (missing.length > 0) {
    throw new Error(`Campos obrigatórios faltando: ${missing.join(', ')}`);
  }
  
  return result;
}
```

## 4. Error Response Handling

### Função de Mapeamento de Erros
```javascript
function mapErrorToUserFriendly(apiError) {
  const errorMappings = {
    // Conflitos
    "horário já está ocupado": {
      message: "⏰ Este horário não está mais disponível",
      suggestion: "Escolha outro horário ou consulte a disponibilidade"
    },
    
    // Validações de médico
    "Médico não encontrado": {
      message: "👨‍⚕️ Médico não localizado",
      suggestion: "Verifique o nome do médico"
    },
    "Médico não está ativo": {
      message: "👨‍⚕️ Médico indisponível",
      suggestion: "Escolha outro médico"
    },
    
    // Validações de paciente
    "idade mínima": {
      message: "👶 Faixa etária incompatível",
      suggestion: "Este médico não atende esta idade"
    },
    "idade máxima": {
      message: "👴 Faixa etária incompatível", 
      suggestion: "Este médico não atende esta idade"
    },
    
    // Convênio
    "Convênio": {
      message: "🏥 Convênio não aceito",
      suggestion: "Verificar convênios aceitos pelo médico"
    },
    
    // Agenda
    "agenda está bloqueada": {
      message: "🚫 Agenda bloqueada",
      suggestion: "Escolha outra data"
    },
    
    // Data/Hora
    "data/hora que já passou": {
      message: "⏰ Data/hora inválida",
      suggestion: "Não é possível agendar no passado"
    }
  };
  
  for (const [pattern, response] of Object.entries(errorMappings)) {
    if (apiError.toLowerCase().includes(pattern.toLowerCase())) {
      return `${response.message}\n\n💡 ${response.suggestion}`;
    }
  }
  
  // Erro genérico
  return `❌ Erro: ${apiError}\n\n💡 Verifique os dados e tente novamente.`;
}
```

## 5. Retry Logic

### Implementação de Retry
```javascript
// Function Node para retry automático
async function retryApiCall(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return await response.json();
      }
      
      // Se não é erro de rede, não retry
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json();
        throw new Error(error.error || 'Erro na requisição');
      }
      
      throw new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      console.log(`Tentativa ${attempt} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Backoff exponencial
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## 6. Debugging Tools

### Log Estruturado
```javascript
// Function Node para logging
function logApiCall(endpoint, method, body, response) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    body: JSON.stringify(body),
    response: JSON.stringify(response),
    success: response.success || false,
    executionId: $executionId
  };
  
  console.log('API_CALL_LOG:', JSON.stringify(logEntry));
  
  return logEntry;
}
```

### Health Check Workflow
```javascript
// Workflow para verificar saúde da API
async function healthCheck() {
  const checks = [
    {
      name: "API Connectivity",
      url: "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api"
    },
    {
      name: "Availability Endpoint",
      url: "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/availability?date=2025-12-31"
    }
  ];
  
  const results = [];
  
  for (const check of checks) {
    try {
      const start = Date.now();
      const response = await fetch(check.url);
      const duration = Date.now() - start;
      
      results.push({
        name: check.name,
        status: response.ok ? 'OK' : 'FAIL',
        duration: `${duration}ms`,
        httpStatus: response.status
      });
    } catch (error) {
      results.push({
        name: check.name,
        status: 'ERROR',
        error: error.message
      });
    }
  }
  
  return results;
}
```

## 7. Performance Optimization

### Caching Strategy
```javascript
// Function Node para cache simples
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Exemplo de uso para buscar médicos
const cacheKey = 'doctors_list';
let doctors = getCachedData(cacheKey);

if (!doctors) {
  const response = await fetch(apiUrl);
  doctors = await response.json();
  setCachedData(cacheKey, doctors);
}
```

## 8. Monitoring e Alertas

### Métricas de Performance
```javascript
// Function Node para métricas
function trackMetrics(operation, startTime, success, error = null) {
  const metrics = {
    operation,
    duration: Date.now() - startTime,
    success,
    error,
    timestamp: new Date().toISOString()
  };
  
  // Log para sistema de monitoramento
  console.log('METRICS:', JSON.stringify(metrics));
  
  // Alertas para operações lentas
  if (metrics.duration > 5000) {
    console.warn('SLOW_OPERATION:', operation, metrics.duration + 'ms');
  }
  
  // Alertas para falhas
  if (!success) {
    console.error('OPERATION_FAILED:', operation, error);
  }
  
  return metrics;
}
```

### Rate Limiting Detection
```javascript
// Function Node para detectar rate limiting
function handleRateLimit(response) {
  const remaining = response.headers['x-ratelimit-remaining'];
  const resetTime = response.headers['x-ratelimit-reset'];
  
  if (remaining && parseInt(remaining) < 10) {
    console.warn('RATE_LIMIT_WARNING:', `${remaining} requests remaining`);
  }
  
  if (response.status === 429) {
    const retryAfter = response.headers['retry-after'] || 60;
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
  }
}
```

## 9. Checklist de Troubleshooting

### Antes de Reportar Problema
- [ ] Verificar conectividade de rede
- [ ] Confirmar headers de autorização
- [ ] Validar formato dos dados de entrada
- [ ] Testar com dados conhecidos válidos
- [ ] Verificar logs da API
- [ ] Confirmar IDs de médico/atendimento existem
- [ ] Validar formato de data/hora
- [ ] Testar endpoint diretamente (Postman/curl)

### Informações para Suporte
```javascript
// Coletar informações para debug
function collectDebugInfo(error, requestData) {
  return {
    timestamp: new Date().toISOString(),
    error: error.message,
    requestData,
    executionId: $executionId,
    nodeId: $node.name,
    workflow: $workflow.name,
    version: "1.0"
  };
}
```