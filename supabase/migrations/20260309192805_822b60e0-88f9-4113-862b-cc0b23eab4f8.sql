
-- 1. Expand check constraint to include new message types
ALTER TABLE public.llm_mensagens DROP CONSTRAINT llm_mensagens_tipo_check;
ALTER TABLE public.llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check CHECK (tipo = ANY (ARRAY[
  'agendamentos_antigos','bloqueio_agenda','boas_vindas','cancelamento','confirmacao',
  'convenio_nao_aceito','convenio_parceiro','data_bloqueada','documentos_exame','encaixe',
  'hora_marcada','lembrete','ordem_chegada','orientacoes','orientacoes_teste','pagamento',
  'reagendamento','sem_disponibilidade','sem_vaga','servico_nao_agendavel','valores_teste',
  'orientacoes_mapa_24h','orientacoes_mrpa','documentos_mapa_mrpa','valores_mapa_mrpa',
  'parecer_cardiologico','mapa_vs_mrpa','indicacoes_exames','urgencia','receita_handoff',
  'nota_fiscal_pix','criancas_atendimento','plano_hgu','confirmacao_3dias','valores_consulta','valores_ecg'
]));

-- 2. Update business_rules config for Dr. Marcelo
UPDATE public.business_rules
SET config = '{
  "nome": "Dr. Marcelo DCarli",
  "especialidade": "Cardiologista",
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "idade_minima": 0,
  "forma_pagamento": "Cartão (não parcela), Pix, Espécie",
  "contato_encaixes": "(87) 98112-6744 - Jeniffe ou Lu",
  "convenios_aceitos": ["PARTICULAR","UNIMED VSF","UNIMED NACIONAL","UNIMED REGIONAL","UNIMED INTERCÂMBIO","UNIMED 40%","UNIMED 20%","MEDPREV","HGU","CASEMPRABA (PERIODICO)"],
  "convenios": ["PARTICULAR","UNIMED VSF","UNIMED NACIONAL","UNIMED REGIONAL","UNIMED INTERCÂMBIO","UNIMED 40%","UNIMED 20%","MEDPREV","HGU","CASEMPRABA (PERIODICO)"],
  "servicos": {
    "Consulta Cardiológica": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "duracao": 20,
      "valor_particular": 350,
      "valor_desconto": 330,
      "pacote_consulta_ecg": 400,
      "coparticipacao_unimed_40": 52,
      "coparticipacao_unimed_20": 26,
      "compartilha_limite_com": "Retorno Cardiológico",
      "observacao_criancas": "Crianças: apenas para parecer cardiológico pré-operatório",
      "periodos": {
        "manha": {
          "ativo": true,
          "dias_especificos": [1, 2, 4],
          "inicio": "07:30",
          "fim": "10:30",
          "atendimento_inicio": "07:45",
          "limite": 15,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha",
          "observacao": "Ficha das 07:00 às 10:30. Atendimento inicia 07:30"
        },
        "tarde": {
          "ativo": true,
          "dias_especificos": [1, 3],
          "inicio": "13:30",
          "fim": "15:30",
          "atendimento_inicio": "13:45",
          "limite": 15,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha",
          "observacao": "Ficha das 13:00 às 15:30. Atendimento inicia 13:30"
        }
      }
    },
    "Retorno Cardiológico": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "duracao": 15,
      "valor_particular": 0,
      "compartilha_limite_com": "Consulta Cardiológica",
      "observacao": "Retorno válido por 30 dias. Gratuito.",
      "periodos": {
        "manha": {
          "ativo": true,
          "dias_especificos": [1, 2, 4],
          "inicio": "07:30",
          "fim": "10:30",
          "atendimento_inicio": "07:45",
          "limite": 15,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha"
        },
        "tarde": {
          "ativo": true,
          "dias_especificos": [1, 3],
          "inicio": "13:30",
          "fim": "15:30",
          "atendimento_inicio": "13:45",
          "limite": 15,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha"
        }
      }
    },
    "ECG (Eletrocardiograma)": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": false,
      "duracao": 10,
      "valor_particular": 80,
      "valor_desconto": 70,
      "coparticipacao_unimed_40": 10,
      "coparticipacao_unimed_20": 5,
      "observacao": "Não necessita agendamento. Ordem de chegada.",
      "periodos": {
        "manha": {
          "ativo": true,
          "dias_especificos": [1, 2, 4],
          "inicio": "07:30",
          "fim": "10:30",
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00"
        },
        "tarde": {
          "ativo": true,
          "dias_especificos": [1, 3],
          "inicio": "13:30",
          "fim": "15:30",
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00"
        }
      }
    },
    "Teste Ergométrico": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "duracao": 30,
      "valor_particular": 240,
      "valor_desconto": 220,
      "coparticipacao_unimed_40": 54,
      "coparticipacao_unimed_20": 26,
      "limite_diario": 13,
      "observacao_unimed": "UNIMED não autoriza Teste Ergométrico e ECG no mesmo dia.",
      "mensagem_apos_agendamento": "Teste ergométrico agendado para {paciente} em {data}. Orientações sobre o teste ergométrico:\n\n• O paciente deve vir com roupa apropriada para prática de esportes.\n• Vir com sapato fechado sem salto.\n• Caso o paciente deseje, pode fazer o exame descalço.\n• Não pode estar de jejum e evitar alimentos de difícil digestão 2h antes.\n• Evitar ingesta de café no dia do exame.\n• Não fumar no dia do exame.\n• Não ingerir bebida alcoólica no dia do exame.\n• Homens com pelos no peito devem vir com o peito raspado.\n• Não usar creme corporal, hidratante ou protetor solar no tórax.\n• Mulheres gestantes não devem fazer o exame.\n• Evitar fazer exercícios no dia do exame.\n• Se usa medicação, pergunte ao médico se deve suspender antes.\n\nPosso ajudar em algo mais?",
      "periodos": {
        "manha": {
          "ativo": true,
          "dias_especificos": [3, 5],
          "inicio": "07:30",
          "fim": "10:30",
          "atendimento_inicio": "07:30",
          "limite": 13,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha",
          "observacao": "Quarta e sexta manhã"
        },
        "tarde": {
          "ativo": true,
          "dias_especificos": [2, 4],
          "inicio": "13:30",
          "fim": "15:30",
          "atendimento_inicio": "13:30",
          "limite": 13,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha",
          "observacao": "Terça e quinta à tarde"
        }
      }
    },
    "MAPA 24H": {
      "tipo_agendamento": "hora_marcada",
      "permite_online": true,
      "limite_diario": 3,
      "antecedencia_chegada": 10,
      "tolerancia_minutos": 15,
      "resultado": "No mesmo dia da devolução",
      "convenios_aceitos": ["PARTICULAR","UNIMED VSF","UNIMED REGIONAL","UNIMED NACIONAL","HGU"],
      "valores": {
        "particular": 180,
        "particular_desconto": 160,
        "unimed_40": 54,
        "unimed_20": 27
      },
      "horarios_especificos": {
        "1": "08:00",
        "2": "09:00",
        "3": "10:00",
        "4": "10:30"
      }
    },
    "MRPA": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "ativo": true,
      "duracao_exame": "4 dias consecutivos",
      "resultado": "7 dias após devolução",
      "convenios_aceitos": ["PARTICULAR","UNIMED VSF","UNIMED REGIONAL","UNIMED NACIONAL","HGU"],
      "valores": {
        "particular": 180,
        "particular_desconto": 160,
        "unimed_40": 54,
        "unimed_20": 27
      },
      "dias_semana": [2, 3, 4],
      "periodos": {
        "manha": {
          "ativo": true,
          "dias_especificos": [2, 3, 4],
          "inicio": "07:00",
          "fim": "09:00",
          "atendimento_inicio": "08:00",
          "limite": 5,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "distribuicao_fichas": "07:00 às 09:00 para fazer a ficha"
        },
        "tarde": {
          "ativo": true,
          "dias_especificos": [2, 3, 4],
          "inicio": "13:00",
          "fim": "15:00",
          "atendimento_inicio": "13:30",
          "limite": 5,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
        }
      }
    },
    "Consulta Particular Sexta-feira": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "duracao": 20,
      "valor_particular": 350,
      "valor_desconto": 330,
      "pacote_consulta_ecg": 400,
      "convenios_aceitos": ["PARTICULAR"],
      "compartilha_limite_com": "Teste Ergométrico Particular Sexta-feira",
      "observacao": "Agenda exclusiva particular sexta-feira à tarde",
      "periodos": {
        "tarde": {
          "ativo": true,
          "dias_especificos": [5],
          "inicio": "13:00",
          "fim": "15:00",
          "atendimento_inicio": "14:00",
          "limite": 10,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
        }
      }
    },
    "Teste Ergométrico Particular Sexta-feira": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": true,
      "duracao": 30,
      "valor_particular": 240,
      "valor_desconto": 220,
      "convenios_aceitos": ["PARTICULAR"],
      "compartilha_limite_com": "Consulta Particular Sexta-feira",
      "observacao": "Agenda exclusiva particular sexta-feira à tarde",
      "periodos": {
        "tarde": {
          "ativo": true,
          "dias_especificos": [5],
          "inicio": "13:00",
          "fim": "15:00",
          "atendimento_inicio": "14:00",
          "limite": 10,
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00",
          "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
        }
      }
    },
    "ECG Particular Sexta-feira": {
      "tipo_agendamento": "ordem_chegada",
      "permite_online": false,
      "duracao": 10,
      "valor_particular": 80,
      "valor_desconto": 70,
      "convenios_aceitos": ["PARTICULAR"],
      "observacao": "Agenda exclusiva particular sexta-feira à tarde. Sem limite específico de ECG.",
      "periodos": {
        "tarde": {
          "ativo": true,
          "dias_especificos": [5],
          "inicio": "13:00",
          "fim": "15:00",
          "atendimento_inicio": "14:00",
          "contagem_inicio": "12:00",
          "contagem_fim": "18:00"
        }
      }
    }
  }
}'::jsonb,
updated_at = now()
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';

-- 3. Insert new llm_mensagens (correct cliente_id)
INSERT INTO public.llm_mensagens (cliente_id, config_id, medico_id, tipo, mensagem, ativo) VALUES

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'parecer_cardiologico',
'Todo parecer cardiológico (pré-cirúrgico, pré-operatório) necessita pelo menos de Consulta + ECG.

Se o paciente já tiver ECG recente (máximo 3 meses), normalmente não há necessidade de fazer outro.

Se o plano não autorizar o ECG no dia, será necessário pegar autorização da guia. Caso não consiga no mesmo dia, agendar nova consulta para avaliar o exame.

Marcação nos dias de consulta. No dia, trazer exames recentes, exames cardiológicos prévios e todas as medicações em uso (nome, dosagem e horários).

⚠️ Crianças: atendimento apenas para parecer cardiológico pré-operatório.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'mapa_vs_mrpa',
'Ambos avaliam a pressão arterial através de medidas repetidas.

📌 *MAPA 24H:* Aparelho automático, mede PA a cada 20-30 min por 24h (dia e noite). Avalia o sono. Desvantagem: desconforto, sem banho por 24h.

📌 *MRPA (4 dias):* Paciente faz em casa, horários específicos, por 4 dias. Mais confortável. Não avalia o sono.

Não existe um melhor que o outro.

Em geral:
• Avaliar controle da PA, efeito jaleco branco, diagnóstico de hipertensão → MRPA
• Avaliar PA em momentos específicos ou durante o sono → MAPA 24H

📋 Se na guia: "MRPA" → marcar MRPA
📋 Se na guia: "MAPA 24H" → marcar MAPA 24H
📋 Se na guia: apenas "MAPA" → perguntar preferência ao paciente

Caso persista dúvida, perguntar ao médico solicitante.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'indicacoes_exames',
'Indicações de locais para exames que não realizamos:

• Ecocardiograma → IPADO (Dr. Alessandro Dias) / CARDIOVASF / Clínica Plena
• Holter de 24h → CARDIOVASF
• USG Doppler de Carótidas → CARDIOVASF / Clínica Plena
• Tomografia de Tórax → CDI
• Angiotomografia de Coronárias → CDI
• Ressonância Cardíaca → Multimagem Juazeiro
• Polissinografia → Medivale Juazeiro / Clínica Todo Ser
• Espirometria → Medivale Juazeiro / Clínica Todo Ser
• Arritmologia e Marcapasso → Dr. Tibério Alencar (Ritmocor ou CARDIOVASF)

⚠️ Marcações para Dr. Alessandro Dias, Dra. Adriana Carla e Dr. Itamar Santos: diretamente no IPADO (87) 3866-4050.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'urgencia',
'Pacientes com sintomas necessitando avaliação de urgência: recomendamos procurar uma emergência. Caso já tenha ido, podemos colocar em lista de preferenciais para encaixe o mais rápido possível com o Dr. Marcelo.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'receita_handoff',
'Aguarde um pouco que retomaremos em breve seu atendimento. Vou encaminhar sua solicitação de receita para as secretárias.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'nota_fiscal_pix',
'📄 *Nota Fiscal:* Emitida na hora. Se solicitada por WhatsApp, prazo de 1 semana.

Dados para NFe: Nome completo, Rua, Bairro, Cidade, CEP, CPF, Procedimento e Valor.

💳 *Pagamento:* Cartão débito/crédito, Dinheiro, PIX.

📱 *PIX Dr. Marcelo De Carli:*
• CNPJ: 09.637.244/0001-54 (Sicredi)
• Telefone: (87) 98112-6744 (PagSeguro)
Nome: DE CARLI SERVIÇOS DE SAÚDE LTDA', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'plano_hgu',
'Plano HGU: Quando a guia vier autorizada como "Teste Ergométrico Computadorizado", serão feitos ECG e Teste Ergométrico juntos (ambos no mesmo momento).', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'valores_consulta',
'Consulta Cardiológica:
• Particular: R$ 350,00 (mínimo R$ 330,00)
• Pacote Consulta + ECG: R$ 400,00
• UNIMED 40%: R$ 52,00
• UNIMED 20%: R$ 26,00

Retorno: válido por 30 dias, gratuito.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'valores_ecg',
'ECG (Eletrocardiograma):
• Particular: R$ 80,00 (mínimo R$ 70,00)
• UNIMED 40%: R$ 10,00
• UNIMED 20%: R$ 5,00

Resultado no mesmo dia. Não necessita agendamento.', true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1e110923-50df-46ff-a57a-29d88e372900',
'confirmacao_3dias',
'Serão enviadas 3 confirmações: 3 dias, 2 dias e 1 dia antes.

Solicitamos confirmar ou cancelar com pelo menos 24h de antecedência para remanejar pacientes da fila de espera.

⚠️ Falta não comunicada → paciente vai para o fim da fila.', true);
