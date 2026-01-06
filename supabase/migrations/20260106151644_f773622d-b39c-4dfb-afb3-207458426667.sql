-- =====================================================
-- CONFIGURAÇÃO COMPLETA: DRA. JEOVANA BRANDÃO
-- Gastroenterologia e Hepatologia - ENDOGASTRO
-- =====================================================

-- Variáveis de referência:
-- medico_id: e12528a9-5b88-426f-8ef9-d0213effd886
-- cliente_id: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253

-- 1. INSERIR ATENDIMENTOS (sem ON CONFLICT pois não há constraint único)
INSERT INTO public.atendimentos (nome, tipo, valor_particular, ativo, cliente_id)
SELECT 'Consulta Gastroenterológica e Hepatologia', 'consulta', 500.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE NOT EXISTS (SELECT 1 FROM public.atendimentos WHERE nome = 'Consulta Gastroenterológica e Hepatologia' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

INSERT INTO public.atendimentos (nome, tipo, valor_particular, ativo, cliente_id)
SELECT 'pHmetria Esofágica', 'exame', 700.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE NOT EXISTS (SELECT 1 FROM public.atendimentos WHERE nome = 'pHmetria Esofágica' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

INSERT INTO public.atendimentos (nome, tipo, valor_particular, ativo, cliente_id)
SELECT 'Manometria Esofágica', 'exame', 700.00, true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE NOT EXISTS (SELECT 1 FROM public.atendimentos WHERE nome = 'Manometria Esofágica' AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 2. ATUALIZAR DADOS DO MÉDICO
UPDATE public.medicos 
SET 
  idade_minima = 13,
  observacoes = 'CONVÊNIOS: Unimed, Agenda Vale, Particular (pacientes antigos outros convênios verificar)
PAGAMENTO PARTICULAR: PIX ou Espécie - R$ 500,00
RESTRIÇÃO IMPORTANTE: NÃO atende pacientes novos - APENAS pacientes já da médica
EXCEÇÃO: Particulares podem ser de 1ª vez
SEM AGENDA FIXA - verificar com a médica quando abre
SEXTA: 1 pHmetria (08:00) + 4 Manometria (08:30-10:00) - sempre confirmar com médica
SEGUNDA MANHÃ: 12 consultas (07:00-10:30) - só pacientes dela
SEGUNDA TARDE: 4 consultas (14:00-15:30)
TERÇA: 5 EDA (07:00-08:00) + 4 consultas (09:30-11:00)'
WHERE id = 'e12528a9-5b88-426f-8ef9-d0213effd886';

-- 3. ATUALIZAR BUSINESS RULES (ela já tem, então UPDATE)
UPDATE public.business_rules 
SET 
  config = '{
    "nome": "Dra. Jeovana Brandão",
    "especialidade": "Gastroenterologia e Hepatologia",
    "idade_minima": 13,
    "tipo_agendamento": "ordem_chegada",
    "convenios_aceitos": ["UNIMED", "AGENDA VALE", "PARTICULAR"],
    "restricoes": {
      "geral": "NÃO ATENDE pacientes novos - APENAS pacientes já da médica",
      "particular_excecao": "Pacientes particulares podem ser de 1ª vez",
      "outros_convenios": "Pacientes antigos com outros convênios devem verificar com a médica"
    },
    "forma_pagamento": {
      "particular": ["PIX", "ESPÉCIE"]
    },
    "agenda_fixa": false,
    "observacao_agenda": "Sem agenda fixa - verificar com a médica quando abre",
    "servicos": {
      "Consulta Gastroenterológica e Hepatologia": {
        "valor": 500,
        "tipo_agendamento": "ordem_chegada",
        "restricao": "Só pacientes da médica (exceto particular 1ª vez)",
        "horarios_por_dia": {
          "segunda_manha": {
            "total_pacientes": 12,
            "blocos": [
              { "horario": "07:00", "limite": 2, "ficha_inicio": "07:00", "ficha_fim": "08:00" },
              { "horario": "08:00", "limite": 2, "ficha_inicio": "07:45", "ficha_fim": "09:00" },
              { "horario": "08:30", "limite": 1, "ficha_inicio": "08:15", "ficha_fim": "09:20" },
              { "horario": "09:00", "limite": 2, "ficha_inicio": "08:45", "ficha_fim": "09:30" },
              { "horario": "09:30", "limite": 3, "ficha_inicio": "09:15", "ficha_fim": "10:00" },
              { "horario": "10:00", "limite": 2, "ficha_inicio": "09:50", "ficha_fim": "10:30" }
            ]
          },
          "segunda_tarde": {
            "total_pacientes": 4,
            "blocos": [
              { "horario": "14:00", "limite": 2, "ficha_inicio": "13:45", "ficha_fim": "15:00" },
              { "horario": "15:00", "limite": 2, "ficha_inicio": "14:45", "ficha_fim": "15:30" }
            ]
          },
          "terca": {
            "total_pacientes": 4,
            "restricao": "Só pacientes da médica",
            "blocos": [
              { "horario": "09:30", "limite": 1, "ficha_inicio": "09:15", "ficha_fim": "10:00" },
              { "horario": "10:00", "limite": 2, "ficha_inicio": "09:45", "ficha_fim": "10:30" },
              { "horario": "11:00", "limite": 1, "ficha_inicio": "10:45", "ficha_fim": "11:00" }
            ]
          }
        }
      },
      "Endoscopia (EDA)": {
        "valor": 500,
        "tipo_agendamento": "ordem_chegada",
        "horarios_por_dia": {
          "terca": {
            "total_pacientes": 5,
            "blocos": [
              { "horario": "07:00", "limite": 2, "ficha_inicio": "07:00", "ficha_fim": "08:00" },
              { "horario": "08:00", "limite": 3, "ficha_inicio": "07:00", "ficha_fim": "08:00" }
            ]
          }
        }
      },
      "pHmetria Esofágica": {
        "valor": 700,
        "tipo_agendamento": "ordem_chegada",
        "observacao": "Sempre verificar com a médica - Sexta",
        "horarios_por_dia": {
          "sexta": {
            "total_pacientes": 1,
            "horario": "08:00",
            "limite": 1
          }
        }
      },
      "Manometria Esofágica": {
        "valor": 700,
        "tipo_agendamento": "ordem_chegada",
        "observacao": "Sempre verificar com a médica - Sexta",
        "horarios_por_dia": {
          "sexta": {
            "total_pacientes": 4,
            "blocos": [
              { "horario": "08:30", "limite": 1 },
              { "horario": "09:00", "limite": 1 },
              { "horario": "09:30", "limite": 1 },
              { "horario": "10:00", "limite": 1 }
            ]
          }
        }
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE medico_id = 'e12528a9-5b88-426f-8ef9-d0213effd886';