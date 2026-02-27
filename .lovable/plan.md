

## Plano: Fila de Espera Inteligente na LLM Agent API

Incorporando os 3 pontos reforçados pelo usuário.

### Arquivo editado: `supabase/functions/llm-agent-api/index.ts`

**1. `handleCancel` — trigger de fila isolado com try/catch**
- Após linha 3902 (resposta de sucesso já montada), adicionar bloco try/catch isolado
- Busca `fila_espera` por `medico_id` + `atendimento_id` + `status = 'aguardando'`, ordenado por `prioridade DESC, created_at ASC`
- Se encontrar candidato: atualiza status para `notificado`, cria registro em `fila_notificacoes` com `tempo_limite` de 2h
- Adiciona campo `fila_espera_notificado` na resposta (dados do paciente da fila para o Noah enviar WhatsApp)
- Se falhar: `console.error` e retorna o sucesso do cancelamento normalmente — nunca bloqueia

**2. `handleAdicionarFila` — resolver paciente_id antes de inserir**
- Reutilizar o mesmo padrão do `handleSchedule`: buscar paciente por `nome_completo + data_nascimento + celular` com `cliente_id`
- Se não existir, criar via a mesma lógica (INSERT em `pacientes`)
- Depois inserir na `fila_espera` com o `paciente_id` resolvido
- Campos: `nomeCompleto`, `dataNascimento`, `convenio`, `celular`, `medicoId`, `atendimentoId`, `dataPreferida`, `periodoPreferido`, `observacoes`

**3. `handleResponderFila` — usar RPC `criar_agendamento_atomico_externo`**
- Quando resposta = SIM: chamar `supabase.rpc('criar_agendamento_atomico_externo', {...})` com os dados do paciente e horário vago
- Isso garante validação de conflito, criação/busca de paciente, e atomicidade
- Atualizar `fila_espera.status = 'agendado'` e `fila_notificacoes.resposta_paciente = 'aceito'`
- Quando resposta = NÃO ou timeout: voltar `fila_espera.status = 'aguardando'`, buscar próximo candidato, repetir ciclo de notificação (mesma lógica do trigger no handleCancel)

**4. `handleConsultarFila` — consulta simples**
- Listar `fila_espera` com joins em `pacientes`, `medicos`, `atendimentos`
- Filtros: `medico_id`, `atendimento_id`, `status` (default: `aguardando`)
- Ordenado por `prioridade DESC, created_at ASC`

**5. Registrar no switch/case principal (~linha 1773)**
- 3 novos cases: `consultar-fila`, `adicionar-fila`, `responder-fila`
- Atualizar documentação do `info_clinica` com descrição das novas tools

### Resumo de segurança
- Trigger no cancelamento isolado com try/catch — zero risco de regressão
- Agendamento via RPC atômica — sem INSERT direto, sem duplicatas
- Resolução de paciente antes da fila — mesmo padrão existente
- Filtro por `cliente_id` em todas as queries — isolamento multi-tenant mantido

### Deploy
- 1 arquivo editado, deploy automático da edge function
- Sem alterações de schema no banco

