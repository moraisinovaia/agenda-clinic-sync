-- ===================================================================
-- Dr. Marcelo D'Carli — correção de horários, limites e restrições
-- Fonte: feedback da secretária (PDF MUDANÇA IA INOVAIA)
--
-- Serviços alterados:
--   ECG              — dias/horários/limite corrigidos; remove Seg tarde e Sexta
--   Consulta         — remove Seg tarde; ficha 07:00-10:00/13:00-15:00; limite 14
--   Retorno          — espelha Consulta (compartilha_limite_com)
--   Teste Ergométrico — ficha 07:00-10:00/13:00-15:00; Dr 07:40/13:30; peso 150kg; fístula
--   MRPA             — remove Terça manhã; fim manhã 09:30
--   nota_fiscal_prazo — adicionado prazo de 72h
--
-- Serviços NÃO alterados (preservados pelo merge ||):
--   MAPA 24H, Agenda Particular Sexta Tarde
--
-- Idempotente: re-executar produz o mesmo resultado.
-- Escopo: medico_id + config_id do Dr. Marcelo principal.
-- ===================================================================

UPDATE public.business_rules
SET
  config = (
    config

    -- 1. Adiciona nota_fiscal_prazo ao topo do config
    || jsonb_build_object(
         'nota_fiscal_prazo',
         'Nota fiscal enviada em até 72 horas por e-mail ou retirada na clínica.'
       )

    -- 2. Substitui apenas os serviços alterados dentro de "servicos"
    --    Os demais (MAPA 24H, Agenda Particular Sexta Tarde) são preservados pelo ||
    || jsonb_build_object(
         'servicos',
         (config->'servicos') || jsonb_build_object(

           -- -------------------------------------------------------
           -- ECG (Eletrocardiograma)
           -- Dias: Seg manhã, Ter manhã, Qua tarde, Qui manhã
           -- Sexta NÃO faz (apenas particular à tarde via "Agenda Particular Sexta Tarde")
           -- Limite: 12 pacientes/sessão
           -- -------------------------------------------------------
           'ECG (Eletrocardiograma)', '{
             "tipo_agendamento": "ordem_chegada",
             "permite_online": false,
             "duracao": 10,
             "valor_particular": 80,
             "valor_desconto": 70,
             "coparticipacao_unimed_40": 10,
             "coparticipacao_unimed_20": 5,
             "observacao": "Sem agendamento. Ordem de chegada. Sextas-feiras somente particular à tarde, via Agenda Particular Sexta Tarde.",
             "periodos": {
               "manha": {
                 "ativo": true,
                 "dias_especificos": [1, 2, 4],
                 "inicio": "07:00",
                 "fim": "10:00",
                 "limite": 12,
                 "contagem_inicio": "07:00",
                 "contagem_fim": "10:00",
                 "distribuicao_fichas": "07:00 às 10:00 para fazer a ficha"
               },
               "tarde": {
                 "ativo": true,
                 "dias_especificos": [3],
                 "inicio": "13:00",
                 "fim": "15:00",
                 "limite": 12,
                 "contagem_inicio": "13:00",
                 "contagem_fim": "15:00",
                 "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
               }
             }
           }'::jsonb,

           -- -------------------------------------------------------
           -- Consulta Cardiológica
           -- Seg/Ter/Qui manhã 07:00-10:00  |  Qua tarde 13:00-15:00
           -- Limite: 14 | Sexta: apenas particular à tarde via "Agenda Particular Sexta Tarde"
           -- -------------------------------------------------------
           'Consulta Cardiológica', '{
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
                 "inicio": "07:00",
                 "fim": "10:00",
                 "atendimento_inicio": "07:30",
                 "limite": 14,
                 "contagem_inicio": "07:00",
                 "contagem_fim": "10:00",
                 "distribuicao_fichas": "07:00 às 10:00 para fazer a ficha",
                 "observacao": "Ficha das 07:00 às 10:00. Atendimento inicia 07:30"
               },
               "tarde": {
                 "ativo": true,
                 "dias_especificos": [3],
                 "inicio": "13:00",
                 "fim": "15:00",
                 "atendimento_inicio": "13:30",
                 "limite": 14,
                 "contagem_inicio": "13:00",
                 "contagem_fim": "15:00",
                 "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha",
                 "observacao": "Ficha das 13:00 às 15:00. Atendimento inicia 13:30"
               }
             }
           }'::jsonb,

           -- -------------------------------------------------------
           -- Retorno Cardiológico — espelha exatamente Consulta
           -- (compartilha_limite_com: "Consulta Cardiológica")
           -- -------------------------------------------------------
           'Retorno Cardiológico', '{
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
                 "inicio": "07:00",
                 "fim": "10:00",
                 "atendimento_inicio": "07:30",
                 "limite": 14,
                 "contagem_inicio": "07:00",
                 "contagem_fim": "10:00",
                 "distribuicao_fichas": "07:00 às 10:00 para fazer a ficha"
               },
               "tarde": {
                 "ativo": true,
                 "dias_especificos": [3],
                 "inicio": "13:00",
                 "fim": "15:00",
                 "atendimento_inicio": "13:30",
                 "limite": 14,
                 "contagem_inicio": "13:00",
                 "contagem_fim": "15:00",
                 "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
               }
             }
           }'::jsonb,

           -- -------------------------------------------------------
           -- Teste Ergométrico
           -- Manhã: Qua+Sex 07:00-10:00, Dr 07:40
           -- Tarde: Ter+Qui 13:00-15:00, Dr 13:30
           -- Limite peso: 150 kg | Fístula: NÃO pode realizar
           -- -------------------------------------------------------
           'Teste Ergométrico', '{
             "tipo_agendamento": "ordem_chegada",
             "permite_online": true,
             "duracao": 30,
             "valor_particular": 240,
             "valor_desconto": 220,
             "coparticipacao_unimed_40": 54,
             "coparticipacao_unimed_20": 26,
             "limite_diario": 13,
             "restricoes": {
               "peso_maximo": "Limite máximo de peso: 150kg.",
               "fistula_braco": "Pacientes com fístula no braço NÃO podem realizar o exame."
             },
             "observacao_unimed": "UNIMED não autoriza Teste Ergométrico e ECG no mesmo dia. Intervalo mínimo: 3 dias.",
             "mensagem_apos_agendamento": "Teste ergométrico agendado para {paciente} em {data}. Orientações sobre o teste ergométrico:\n\n• O paciente deve vir com roupa apropriada para prática de esportes.\n• Vir com sapato fechado sem salto.\n• Caso o paciente deseje, pode fazer o exame descalço.\n• Não pode estar de jejum e evitar alimentos de difícil digestão 2h antes.\n• Evitar ingesta de café no dia do exame.\n• Não fumar no dia do exame.\n• Não ingerir bebida alcoólica no dia do exame.\n• Homens com pelos no peito devem vir com o peito raspado.\n• Não usar creme corporal, hidratante ou protetor solar no tórax.\n• Mulheres gestantes não devem fazer o exame.\n• Evitar fazer exercícios no dia do exame.\n• Se usa medicação, pergunte ao médico se deve suspender antes.\n\nPosso ajudar em algo mais?",
             "periodos": {
               "manha": {
                 "ativo": true,
                 "dias_especificos": [3, 5],
                 "inicio": "07:00",
                 "fim": "10:00",
                 "atendimento_inicio": "07:40",
                 "limite": 13,
                 "contagem_inicio": "07:00",
                 "contagem_fim": "10:00",
                 "distribuicao_fichas": "07:00 às 10:00 para fazer a ficha",
                 "observacao": "Quarta e sexta manhã"
               },
               "tarde": {
                 "ativo": true,
                 "dias_especificos": [2, 4],
                 "inicio": "13:00",
                 "fim": "15:00",
                 "atendimento_inicio": "13:30",
                 "limite": 13,
                 "contagem_inicio": "13:00",
                 "contagem_fim": "15:00",
                 "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha",
                 "observacao": "Terça e quinta à tarde"
               }
             }
           }'::jsonb,

           -- -------------------------------------------------------
           -- MRPA
           -- Manhã: Qua+Qui 07:00-09:30, começa 08:00, 5 pacientes
           --        (removida Terça manhã)
           -- Tarde: Ter+Qua+Qui 13:00-15:00, começa 13:30, 5 pacientes
           -- -------------------------------------------------------
           'MRPA', '{
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
                 "dias_especificos": [3, 4],
                 "inicio": "07:00",
                 "fim": "09:30",
                 "atendimento_inicio": "08:00",
                 "limite": 5,
                 "contagem_inicio": "07:00",
                 "contagem_fim": "09:30",
                 "distribuicao_fichas": "07:00 às 09:30 para fazer a ficha"
               },
               "tarde": {
                 "ativo": true,
                 "dias_especificos": [2, 3, 4],
                 "inicio": "13:00",
                 "fim": "15:00",
                 "atendimento_inicio": "13:30",
                 "limite": 5,
                 "contagem_inicio": "13:00",
                 "contagem_fim": "15:00",
                 "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
               }
             }
           }'::jsonb

         ) -- fim jsonb_build_object dos serviços alterados
       )  -- fim jsonb_build_object de 'servicos'
  ),    -- fim config =
  updated_at = now(),
  version    = version + 1
WHERE config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND medico_id = '1e110923-50df-46ff-a57a-29d88e372900';
