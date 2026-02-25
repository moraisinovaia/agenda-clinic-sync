

## Separar "MAPA MRPA" em "MRPA MANHÃ" e "MRPA TARDE" na agenda MAPA do Dr. Marcelo

### Contexto

Atualmente, na agenda virtual "MAPA - Dr. Marcelo" (medico_id: `e6453b94`), existe apenas um atendimento chamado "MAPA MRPA". O usuário quer separar em dois: **MRPA MANHÃ** e **MRPA TARDE**, para que as recepcionistas possam selecionar o turno correto ao agendar.

### Dados atuais

- Atendimento existente: `MAPA MRPA` (id: `7fd294e3-74a6-40cb-83c8-56f4aeb38a04`)
- Médico virtual: `MAPA - Dr. Marcelo` (id: `e6453b94-840d-4adf-ab0f-fc22be7cd7f5`)
- Cliente: IPADO (`2bfb98b5-ae41-4f96-8ba7-acc797c22054`)
- 309 agendamentos existentes vinculados ao atendimento atual

### Mudanças necessárias

**1. Renomear atendimento existente**

Renomear "MAPA MRPA" para "MRPA MANHÃ" (mantém o id `7fd294e3` e preserva os 309 agendamentos históricos).

**2. Criar novo atendimento "MRPA TARDE"**

Novo registro na tabela `atendimentos` com:
- nome: "MRPA TARDE"
- tipo: "Exame"
- medico_id: `e6453b94-840d-4adf-ab0f-fc22be7cd7f5`
- cliente_id: `2bfb98b5-ae41-4f96-8ba7-acc797c22054`

**3. Atualizar business_rules do MAPA**

Na config do médico virtual MAPA (`e6453b94`), substituir o serviço "MAPA MRPA" por dois serviços:

```text
servicos:
  MAPA 24H: (sem alteração)
  MRPA MANHÃ:
    mensagem: "Para marcar MRPA manhã com o Dr. Marcelo..."
    permite_online: false
  MRPA TARDE:
    mensagem: "Para marcar MRPA tarde com o Dr. Marcelo..."
    permite_online: false
```

### Resultado esperado

O dropdown de "Tipo de Atendimento" na agenda MAPA mostrará:
- MAPA 24H - Exame
- MRPA MANHÃ - Exame
- MRPA TARDE - Exame

### Impacto

- Os 309 agendamentos existentes passam a aparecer como "MRPA MANHÃ" (sem perda de dados)
- Nenhuma alteração de código necessária -- apenas dados no banco
- A LLM API continuará funcionando normalmente pois lê os serviços dinamicamente

