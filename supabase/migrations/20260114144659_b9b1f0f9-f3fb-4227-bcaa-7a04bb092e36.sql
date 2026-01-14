-- Atualizar mensagens da Clínica Orion com telefone correto (87) 3024-1274

UPDATE llm_mensagens
SET mensagem = 'Não encontrei agendamentos no sistema novo. Se sua consulta é anterior a janeiro/2026, os dados estão no sistema anterior. Entre em contato: (87) 3024-1274'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0' 
  AND tipo = 'agendamentos_antigos';

UPDATE llm_mensagens
SET mensagem = 'Agendamentos disponíveis a partir de janeiro/2026. Para datas anteriores, entre em contato pelo telefone: (87) 3024-1274'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0' 
  AND tipo = 'data_bloqueada';

UPDATE llm_mensagens
SET mensagem = 'Não há vagas disponíveis antes de janeiro/2026. Para consultas anteriores a esta data, ligue: (87) 3024-1274'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0' 
  AND tipo = 'sem_disponibilidade';

UPDATE llm_mensagens
SET mensagem = 'A agenda está bloqueada para essa data. Para verificar disponibilidade ou encaixe, entre em contato com a recepção pelo telefone (87) 3024-1274.'
WHERE config_id = '223a7ffd-337b-4379-95b6-85bed89e47d0' 
  AND tipo = 'bloqueio_agenda';