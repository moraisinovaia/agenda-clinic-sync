-- Adicionar coluna horarios à tabela medicos
ALTER TABLE medicos ADD COLUMN horarios JSONB DEFAULT NULL;

-- Criar índice para consultas mais eficientes nos horários
CREATE INDEX idx_medicos_horarios ON medicos USING gin(horarios);

-- Atualizar horários dos médicos cardiologistas
UPDATE medicos SET horarios = '{
  "quarta": [
    {"inicio": "07:00", "fim": "08:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "08:00", "fim": "09:30", "tipo": "consulta", "vagas": 5},
    {"inicio": "09:00", "fim": "10:00", "tipo": "retorno", "vagas": 3},
    {"inicio": "09:30", "fim": "10:50", "tipo": "ECO", "vagas": 4},
    {"inicio": "13:00", "fim": "14:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "14:00", "fim": "15:00", "tipo": "consulta", "vagas": 4},
    {"inicio": "14:30", "fim": "15:00", "tipo": "retorno", "vagas": 3},
    {"inicio": "15:00", "fim": "16:00", "tipo": "teste", "vagas": 4},
    {"inicio": "16:00", "fim": "16:30", "tipo": "ECO", "vagas": 2}
  ]
}'::jsonb WHERE nome = 'Dr. Aristófilo Coelho';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "13:00", "fim": "14:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "14:00", "fim": "15:00", "tipo": "consulta", "vagas": 1},
    {"inicio": "15:00", "fim": "16:00", "tipo": "ECO", "vagas": 1}
  ],
  "terca": [
    {"inicio": "10:00", "fim": "11:30", "tipo": "ECO", "vagas": 6}
  ],
  "sexta": [
    {"inicio": "07:00", "fim": "08:30", "tipo": "ECG", "vagas": 1},
    {"inicio": "08:00", "fim": "09:30", "tipo": "consulta", "vagas": 1},
    {"inicio": "10:00", "fim": "11:00", "tipo": "ECO", "vagas": 1},
    {"inicio": "13:00", "fim": "14:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "14:00", "fim": "15:00", "tipo": "consulta", "vagas": 1},
    {"inicio": "15:00", "fim": "16:00", "tipo": "ECO", "vagas": 1}
  ]
}'::jsonb WHERE nome = 'Dr. Diego Tomás';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "09:00", "fim": "09:30", "tipo": "consulta", "vagas": 6}
  ],
  "quinta": [
    {"inicio": "13:00", "fim": "14:30", "tipo": "ECG", "vagas": 7},
    {"inicio": "14:00", "fim": "15:00", "tipo": "teste", "vagas": 4},
    {"inicio": "15:30", "fim": "16:30", "tipo": "consulta", "vagas": 5},
    {"inicio": "15:30", "fim": "16:30", "tipo": "retorno", "vagas": 3}
  ]
}'::jsonb WHERE nome = 'Dr. Heverson Alex';

UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "13:00", "fim": "16:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "14:00", "fim": "15:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "14:30", "fim": "15:00", "tipo": "retorno", "vagas": 3},
    {"inicio": "15:00", "fim": "16:00", "tipo": "teste", "vagas": 3}
  ],
  "quinta": [
    {"inicio": "09:00", "fim": "11:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "10:00", "fim": "11:00", "tipo": "retorno", "vagas": 3},
    {"inicio": "13:00", "fim": "16:00", "tipo": "ECG", "vagas": 1},
    {"inicio": "15:00", "fim": "16:20", "tipo": "teste", "vagas": 3}
  ]
}'::jsonb WHERE nome = 'Dr. Max Koki';

-- Clínico Geral
UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "11:00", "fim": "12:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "12:00", "fim": "12:45", "tipo": "consulta", "vagas": 5}
  ],
  "quinta": [
    {"inicio": "11:00", "fim": "12:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "12:00", "fim": "12:45", "tipo": "consulta", "vagas": 5}
  ]
}'::jsonb WHERE nome = 'Dr. Rivadávio Espínola';

-- Endocrinologista
UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "12:00", "fim": "13:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "13:00", "fim": "13:30", "tipo": "consulta", "vagas": 4}
  ],
  "terca": [
    {"inicio": "07:30", "fim": "08:30", "tipo": "consulta", "vagas": 5},
    {"inicio": "08:30", "fim": "09:00", "tipo": "consulta", "vagas": 4}
  ],
  "quarta": [
    {"inicio": "07:30", "fim": "08:30", "tipo": "consulta", "vagas": 5},
    {"inicio": "08:30", "fim": "09:00", "tipo": "consulta", "vagas": 4}
  ],
  "quinta": [
    {"inicio": "12:00", "fim": "13:00", "tipo": "consulta", "vagas": 5},
    {"inicio": "13:00", "fim": "13:30", "tipo": "consulta", "vagas": 4}
  ],
  "sexta": [
    {"inicio": "07:30", "fim": "08:30", "tipo": "consulta", "vagas": 5},
    {"inicio": "08:30", "fim": "09:00", "tipo": "consulta", "vagas": 4}
  ]
}'::jsonb WHERE nome = 'Dr. Cláudio Lustosa';

-- Gastroenterologistas
UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "EDA", "vagas": 5},
    {"inicio": "09:00", "fim": "10:00", "tipo": "EDA", "vagas": 2},
    {"inicio": "10:00", "fim": "10:10", "tipo": "PH", "vagas": 1},
    {"inicio": "10:00", "fim": "10:10", "tipo": "MANO", "vagas": 1}
  ],
  "terca": [
    {"inicio": "15:00", "fim": "16:00", "tipo": "consulta", "vagas": 6},
    {"inicio": "16:00", "fim": "17:00", "tipo": "consulta", "vagas": 5}
  ],
  "quarta": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "consulta", "vagas": 6},
    {"inicio": "08:00", "fim": "10:00", "tipo": "EDA", "vagas": 5},
    {"inicio": "09:00", "fim": "10:00", "tipo": "consulta", "vagas": 5}
  ],
  "sabado": [
    {"inicio": "08:00", "fim": "10:00", "tipo": "EDA", "vagas": 5}
  ]
}'::jsonb WHERE nome = 'Dr. Edson Moreira';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "08:00", "fim": "10:00", "tipo": "consulta", "vagas": 9},
    {"inicio": "08:00", "fim": "10:00", "tipo": "retorno", "vagas": 3}
  ],
  "terca": [
    {"inicio": "08:00", "fim": "10:00", "tipo": "EDA", "vagas": 5}
  ],
  "sexta": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "PHmetria", "vagas": 1},
    {"inicio": "08:00", "fim": "10:00", "tipo": "Manometria", "vagas": 4},
    {"inicio": "10:00", "fim": "11:30", "tipo": "consulta_particular", "vagas": 3}
  ]
}'::jsonb WHERE nome = 'Dra. Jeovana Brandão';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "EDA", "vagas": 3},
    {"inicio": "09:30", "fim": "10:00", "tipo": "consulta", "vagas": 5}
  ],
  "quinta": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "EDA", "vagas": 3},
    {"inicio": "09:30", "fim": "10:00", "tipo": "consulta", "vagas": 5}
  ],
  "sexta": [
    {"inicio": "09:00", "fim": "10:00", "tipo": "Colonoscopia", "vagas": 1}
  ]
}'::jsonb WHERE nome = 'Dra. Juliana Gama';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "08:00", "fim": "09:00", "tipo": "consulta", "vagas": 4},
    {"inicio": "08:00", "fim": "09:00", "tipo": "retorno", "vagas": 4}
  ],
  "terca": [
    {"inicio": "10:00", "fim": "11:00", "tipo": "Colonoscopia", "vagas": 1}
  ],
  "quarta": [
    {"inicio": "09:30", "fim": "10:00", "tipo": "Colonoscopia", "vagas": 2},
    {"inicio": "13:30", "fim": "14:00", "tipo": "consulta", "vagas": 4},
    {"inicio": "13:30", "fim": "14:00", "tipo": "retorno", "vagas": 4}
  ],
  "quinta": [
    {"inicio": "14:00", "fim": "15:00", "tipo": "consulta", "vagas": 4},
    {"inicio": "14:00", "fim": "15:00", "tipo": "retorno", "vagas": 4}
  ],
  "sexta": [
    {"inicio": "10:00", "fim": "10:30", "tipo": "Colonoscopia", "vagas": 2},
    {"inicio": "11:00", "fim": "12:00", "tipo": "retorno", "vagas": 3},
    {"inicio": "11:00", "fim": "12:00", "tipo": "consulta_particular", "vagas": 2}
  ]
}'::jsonb WHERE nome = 'Dra. Lara Eline Menezes';

UPDATE medicos SET horarios = '{
  "quarta": [
    {"inicio": "07:30", "fim": "08:00", "tipo": "EDA", "vagas": 5}
  ],
  "sexta": [
    {"inicio": "14:00", "fim": "16:00", "tipo": "consulta", "vagas": 6}
  ]
}'::jsonb WHERE nome = 'Dra. Luziane Sabino';

UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "08:00", "fim": "08:30", "tipo": "EDA", "vagas": 5}
  ]
}'::jsonb WHERE nome = 'Dra. Thalita Mariano';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "15:00", "fim": "17:00", "tipo": "consulta", "vagas": 12}
  ],
  "terca": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "EDA", "vagas": 12},
    {"inicio": "09:30", "fim": "12:00", "tipo": "Colonoscopia", "vagas": 3}
  ],
  "quarta": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "EDA", "vagas": 12},
    {"inicio": "09:30", "fim": "12:00", "tipo": "Colonoscopia", "vagas": 3}
  ],
  "sexta": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "EDA", "vagas": 12},
    {"inicio": "11:00", "fim": "12:00", "tipo": "consulta", "vagas": 10}
  ]
}'::jsonb WHERE nome = 'Dr. Sydney Ribeiro';

-- Neurologista
UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "08:00", "fim": "09:30", "tipo": "EEG", "vagas": 4},
    {"inicio": "13:00", "fim": "15:00", "tipo": "consulta", "vagas": 7}
  ],
  "quarta": [
    {"inicio": "07:30", "fim": "10:00", "tipo": "ENMG", "vagas": 14},
    {"inicio": "08:00", "fim": "09:30", "tipo": "consulta", "vagas": 4},
    {"inicio": "12:30", "fim": "16:00", "tipo": "ENMG", "vagas": 10}
  ],
  "quinta": [
    {"inicio": "13:00", "fim": "15:00", "tipo": "consulta", "vagas": 7}
  ],
  "sexta": [
    {"inicio": "07:30", "fim": "10:00", "tipo": "ENMG", "vagas": 20},
    {"inicio": "13:00", "fim": "15:30", "tipo": "ENMG", "vagas": 14}
  ],
  "sabado": [
    {"inicio": "08:00", "fim": "09:30", "tipo": "EEG", "vagas": 4}
  ]
}'::jsonb WHERE nome = 'Dr. Fábio Drubi';

-- Outros especialistas
UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "14:00", "fim": "14:30", "tipo": "consulta", "vagas": 5}
  ],
  "sexta": [
    {"inicio": "14:00", "fim": "14:30", "tipo": "consulta", "vagas": 5}
  ]
}'::jsonb WHERE nome = 'Dra. Vaníria Brandão';

UPDATE medicos SET horarios = '{
  "terca": [
    {"inicio": "14:00", "fim": "16:00", "tipo": "consulta", "vagas": 8},
    {"inicio": "14:00", "fim": "16:00", "tipo": "mapeamento", "vagas": 2}
  ],
  "quinta": [
    {"inicio": "14:00", "fim": "16:00", "tipo": "consulta", "vagas": 8},
    {"inicio": "14:00", "fim": "16:00", "tipo": "mapeamento", "vagas": 2}
  ]
}'::jsonb WHERE nome = 'Dr. Carlos Philliph';

UPDATE medicos SET horarios = '{
  "sexta": [
    {"inicio": "14:00", "fim": "16:00", "tipo": "consulta", "vagas": 4, "quinzenal": true}
  ]
}'::jsonb WHERE nome = 'Dra. Camila Helena';

UPDATE medicos SET horarios = '{
  "quinta": [
    {"inicio": "09:00", "fim": "10:20", "tipo": "consulta", "vagas": 10}
  ]
}'::jsonb WHERE nome = 'Dr. Darcy Muritiba';

UPDATE medicos SET horarios = '{
  "segunda": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "USG", "vagas": 8}
  ],
  "terca": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "USG", "vagas": 8}
  ],
  "quarta": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "USG", "vagas": 8}
  ],
  "quinta": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "USG", "vagas": 8}
  ],
  "sexta": [
    {"inicio": "07:00", "fim": "09:00", "tipo": "USG", "vagas": 8}
  ]
}'::jsonb WHERE nome = 'Dr. Pedro Francisco';