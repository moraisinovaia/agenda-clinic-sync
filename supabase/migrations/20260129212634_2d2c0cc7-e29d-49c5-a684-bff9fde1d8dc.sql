
-- Inserir configuração LLM para Consultório Dr. Marcelo D'Carli
-- Usa o mesmo cliente_id do IPADO para compartilhar dados de pacientes/agendamentos

INSERT INTO llm_clinic_config (
  id,
  cliente_id,
  nome_clinica,
  telefone,
  whatsapp,
  endereco,
  dias_busca_inicial,
  dias_busca_expandida,
  data_minima_agendamento,
  mensagem_bloqueio_padrao,
  ativo
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Consultório Dr. Marcelo D''Carli',
  '(87) 98112-6744',
  '(87) 98112-6744',
  'IPADO - Petrolina-PE',
  14,
  45,
  '2026-01-01',
  'Para tentar encaixe entre em contato com a secretária Jeniffe ou Luh no WhatsApp: (87) 98112-6744',
  true
) ON CONFLICT (id) DO NOTHING;

-- Inserir business rules específicas para Dr. Marcelo nesta config
INSERT INTO business_rules (
  cliente_id,
  config_id,
  medico_id,
  config,
  ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '1e110923-50df-46ff-a57a-29d88e372900',
  '{
    "nome": "Dr. Marcelo D''Carli",
    "especialidade": "Cardiologia",
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "servicos": {
      "Consulta Cardiológica": {
        "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": { "limite": 9, "inicio": "07:00", "fim": "12:00" },
          "tarde": { "limite": 9, "inicio": "13:00", "fim": "18:00" }
        }
      },
      "Teste Ergométrico": {
        "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": { "limite": 9, "inicio": "07:45", "fim": "12:00" },
          "tarde": { "limite": 9, "inicio": "13:45", "fim": "17:00" }
        }
      }
    }
  }'::jsonb,
  true
);

-- Inserir mensagens personalizadas para Dr. Marcelo (usando tipos válidos)
INSERT INTO llm_mensagens (cliente_id, config_id, medico_id, tipo, mensagem, ativo)
VALUES 
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'bloqueio_agenda', 
   'A agenda do Dr. Marcelo está bloqueada. Para encaixes, fale com Jeniffe/Luh: (87) 98112-6744', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'data_bloqueada',
   'Esta data está bloqueada para o Dr. Marcelo. Para encaixes, fale com Jeniffe/Luh: (87) 98112-6744', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'sem_disponibilidade',
   'Não há vagas disponíveis no momento para o Dr. Marcelo. Para encaixes, fale com Jeniffe/Luh: (87) 98112-6744', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'ordem_chegada',
   'Agendamento por ordem de chegada. Chegue entre {horario_inicio} e {horario_fim} para fazer a ficha.', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'encaixe',
   'Para tentar encaixe, fale diretamente com Jeniffe/Luh: (87) 98112-6744', true);
