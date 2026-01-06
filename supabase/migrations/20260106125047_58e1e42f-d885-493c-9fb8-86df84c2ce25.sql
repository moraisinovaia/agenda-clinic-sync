
-- Configuração completa Dr. Edson Moreira - Gastroenterologista
-- Médico ID: 58b3d6f1-98ff-46c0-8b30-f3281dce816e
-- Cliente ENDOGASTRO ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253

-- 1. Criar Atendimentos para Dr. Edson Moreira
INSERT INTO public.atendimentos (nome, tipo, medico_id, cliente_id, valor_particular)
VALUES
  ('Consulta Gastroenterológica', 'consulta', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 500.00),
  ('Retorno Gastroenterológico', 'retorno', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', NULL),
  ('Endoscopia (EDA)', 'exame', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 500.00),
  ('Colonoscopia', 'exame', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 1000.00),
  ('pHmetria Esofágica', 'exame', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 700.00),
  ('Manometria Esofágica', 'exame', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 700.00),
  ('Cápsula Endoscopia', 'exame', '58b3d6f1-98ff-46c0-8b30-f3281dce816e', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', NULL);

-- 2. Atualizar idade mínima e observações no registro do médico
UPDATE public.medicos 
SET 
  idade_minima = 13,
  observacoes = 'FACHESF: NÃO atende cartões que começam com nº 43. CÁPSULA ENDOSCOPIA: Somente particular - paciente passa em triagem com o médico antes, deve trazer todos os exames já realizados. Após avaliação, médico dará orientações para agendamento. PAGAMENTO PARTICULAR: PIX ou Espécie. MEDPREV: Agendar direto na Med Prev.'
WHERE id = '58b3d6f1-98ff-46c0-8b30-f3281dce816e';

-- 3. Inserir/Atualizar Business Rules completas
INSERT INTO public.business_rules (medico_id, cliente_id, config, ativo)
VALUES (
  '58b3d6f1-98ff-46c0-8b30-f3281dce816e',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '{
    "nome": "Dr. Edson Moreira",
    "especialidade": "Gastroenterologista",
    "idade_minima": 13,
    "tipo_agendamento": "ordem_chegada",
    "convenios_aceitos": ["UNIMED", "BRADESCO", "POSTAL", "MINERAÇÃO", "FUSEX", "CAMED", "ASSEFAZ", "CODEVASF", "CASSIC", "CASSI", "ASFEB", "COMPESA", "CASSEB", "CAPSAÚDE", "PARTICULAR", "AGENDA VALE", "MEDPREV", "FACHESF"],
    "restricoes": {
      "fachesf": "NÃO atende Fachesf que comece com nº 43",
      "medprev": "Agendar direto na Med Prev"
    },
    "forma_pagamento": {
      "particular": ["PIX", "ESPÉCIE"]
    },
    "servicos": {
      "Consulta Gastroenterológica": {
        "valor": 500,
        "tipo": "consulta",
        "tipo_agendamento": "ordem_chegada",
        "horarios_por_dia": {
          "terca": {
            "total_pacientes": 11,
            "consultas": 9,
            "retornos": 3,
            "blocos": [
              {"horario": "15:00", "limite": 6, "ficha_inicio": "14:45", "ficha_fim": "15:45"},
              {"horario": "16:00", "limite": 5, "ficha_inicio": "15:45", "ficha_fim": "16:30"}
            ]
          },
          "quarta": {
            "total_pacientes": 11,
            "consultas": 9,
            "retornos": 3,
            "blocos": [
              {"horario": "08:30", "limite": 6, "ficha_inicio": "08:15", "ficha_fim": "09:00"},
              {"horario": "09:00", "limite": 5, "ficha_inicio": "08:45", "ficha_fim": "10:00"}
            ]
          }
        }
      },
      "Retorno Gastroenterológico": {
        "tipo": "retorno",
        "observacao": "Incluído nos 3 retornos das consultas de terça e quarta"
      },
      "Endoscopia (EDA)": {
        "valor": 500,
        "tipo": "exame",
        "tipo_agendamento": "ordem_chegada",
        "horarios_por_dia": {
          "segunda": {
            "total_pacientes": 4,
            "blocos": [
              {"horario": "08:30", "limite": 2, "ficha_inicio": "08:00", "ficha_fim": "09:00"},
              {"horario": "09:00", "limite": 2, "ficha_inicio": "08:45", "ficha_fim": "10:00"}
            ]
          },
          "sabado": {
            "total_pacientes": 9,
            "blocos": [
              {"horario": "08:30", "limite": 4, "ficha_inicio": "08:15", "ficha_fim": "09:00"},
              {"horario": "09:00", "limite": 3, "ficha_inicio": "08:45", "ficha_fim": "09:30"},
              {"horario": "09:30", "limite": 2, "ficha_inicio": "09:20", "ficha_fim": "10:00"}
            ]
          }
        }
      },
      "pHmetria Esofágica": {
        "valor": 700,
        "tipo": "exame",
        "tipo_agendamento": "ordem_chegada",
        "horarios_por_dia": {
          "segunda": {
            "horario": "10:00",
            "limite": 1,
            "ficha_inicio": "09:50",
            "observacao": "Pode fazer junto com MANO, mas conta como 1 paciente total"
          }
        }
      },
      "Manometria Esofágica": {
        "valor": 700,
        "tipo": "exame",
        "tipo_agendamento": "ordem_chegada",
        "horarios_por_dia": {
          "segunda": {
            "horario": "10:00",
            "limite": 1,
            "ficha_inicio": "09:50",
            "observacao": "Pode fazer junto com pHmetria, mas conta como 1 paciente total"
          }
        }
      },
      "Colonoscopia": {
        "valor": 1000,
        "tipo": "exame",
        "tipo_agendamento": "ordem_chegada"
      },
      "Cápsula Endoscopia": {
        "tipo": "exame",
        "somente_particular": true,
        "requer_triagem": true,
        "observacao": "Paciente passa em triagem com médico antes. Trazer todos os exames já realizados. Médico dará orientações para agendamento."
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (medico_id, cliente_id) 
DO UPDATE SET 
  config = EXCLUDED.config,
  ativo = true,
  updated_at = now();
