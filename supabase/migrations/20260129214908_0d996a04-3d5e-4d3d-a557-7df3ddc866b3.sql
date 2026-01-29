-- 1. Atualizar endereço completo na llm_clinic_config
UPDATE llm_clinic_config 
SET 
  endereco = 'Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE',
  updated_at = now()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 2. Atualizar business_rules com config completa do documento
UPDATE business_rules
SET config = '{
  "nome": "Dr. Marcelo D''Carli",
  "crm": "15056/PE",
  "rqe_cardiologia": "67",
  "rqe_ergometria": "16.683",
  "email": "drmarcelodecarli@gmail.com",
  "instagram": "@drmarcelodecarli",
  "empresa": "DE CARLI SERVIÇOS DE SAUDE LTDA",
  "cnpj": "09.637.244/0001-54",
  "especialidade": "Cardiologia/Ergometria",
  "tipo_agendamento": "ordem_chegada",
  "convenios_aceitos": ["UNIMED VSF", "UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCAMBIO", "UNIMED 40%", "UNIMED 20%", "HGU"],
  "convenios_restricoes": {
    "CASEMBRAPA": "Apenas exame periódico"
  },
  "convenios_parceiros": {
    "lista": ["MEDCLIN", "MEDPREV", "SEDILAB", "CLINICA VIDA", "CLINCENTER", "SERTAO SAUDE"],
    "mensagem": "Informações sobre atendimento devem ser obtidas diretamente com o convênio parceiro."
  },
  "convenios_nao_aceitos": ["SULAMERICA", "CASSI", "BRADESCO", "CAMED", "FUSEX", "CAPESAUDE"],
  "mensagem_convenio_nao_aceito": "Não atendemos este plano. O paciente pode fazer consulta particular e solicitar reembolso ao plano.",
  "servicos": {
    "Consulta Cardiológica": {
      "permite_online": true,
      "dias_semana": [1, 2, 3, 4, 5],
      "periodos": {
        "manha": {
          "limite": 9,
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "atendimento_inicio": "07:45",
          "distribuicao_fichas": "07:00 às 09:30 para fazer a ficha"
        },
        "tarde": {
          "limite": 9,
          "dias_especificos": [1, 3],
          "contagem_inicio": "13:00",
          "contagem_fim": "17:00",
          "atendimento_inicio": "13:45",
          "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha"
        }
      }
    },
    "Teste Ergométrico": {
      "permite_online": true,
      "dias_semana": [2, 3, 4, 5],
      "periodos": {
        "manha": {
          "limite": 13,
          "dias_especificos": [3, 5],
          "contagem_inicio": "07:00",
          "contagem_fim": "12:00",
          "atendimento_inicio": "07:30",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha"
        },
        "tarde": {
          "limite": 13,
          "dias_especificos": [2, 4],
          "contagem_inicio": "13:00",
          "contagem_fim": "17:00",
          "atendimento_inicio": "13:30",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha"
        }
      },
      "valores": {
        "particular": 240,
        "particular_minimo": 220,
        "unimed_40_porcento": 54,
        "unimed_20_porcento": 26
      },
      "resultado": "No mesmo dia",
      "orientacoes": [
        "Venha com roupa apropriada para prática de esportes",
        "Venha com sapato fechado sem salto (evite sandálias ou salto)",
        "Pode fazer o exame descalço, se preferir",
        "NÃO pode estar de jejum - evite alimentos de difícil digestão 2 horas antes",
        "Evite café no dia do exame",
        "NÃO fumar no dia do exame",
        "NÃO ingerir bebida alcoólica no dia do exame",
        "Homens com pelos no peito devem vir com o peito raspado",
        "NÃO usar creme corporal, hidratante ou protetor solar no tórax",
        "Gestantes NÃO devem fazer o exame",
        "Evite fazer exercícios no dia do exame",
        "Se usa medicação, pergunte ao médico se deve suspender antes do exame"
      ],
      "documentos_necessarios": [
        "Documento de identificação",
        "Carteira do plano de saúde (se houver)",
        "Guia de solicitação do exame (se por convênio)",
        "Verificar validade da guia autorizada (exames com senhas vencidas não são realizados)"
      ]
    },
    "ECG": {
      "permite_online": false,
      "mensagem": "O ECG (eletrocardiograma) não precisa de agendamento. Compareça à clínica durante o horário de atendimento."
    },
    "MAPA 24H": {
      "permite_online": false,
      "mensagem": "Para agendar MAPA 24H, entre em contato pelo WhatsApp: (87) 98112-6744"
    },
    "MRPA": {
      "permite_online": false,
      "mensagem": "Para agendar MRPA (MAPA de 4 dias), entre em contato pelo WhatsApp: (87) 98112-6744"
    }
  }
}'::jsonb,
    updated_at = now(),
    version = version + 1
WHERE config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 3. Adicionar novos tipos à constraint de llm_mensagens
ALTER TABLE llm_mensagens DROP CONSTRAINT IF EXISTS llm_mensagens_tipo_check;
ALTER TABLE llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check CHECK (
  tipo = ANY (ARRAY[
    'bloqueio_agenda'::text, 
    'confirmacao_agendamento'::text, 
    'data_bloqueada'::text, 
    'sem_disponibilidade'::text, 
    'agendamentos_antigos'::text, 
    'boas_vindas'::text, 
    'encerramento'::text, 
    'erro_generico'::text, 
    'ordem_chegada'::text, 
    'hora_marcada'::text, 
    'encaixe'::text, 
    'servico_nao_agendavel'::text, 
    'pagamento'::text,
    'convenio_nao_aceito'::text,
    'convenio_parceiro'::text,
    'orientacoes_teste'::text,
    'valores_teste'::text,
    'documentos_exame'::text
  ])
);

-- 4. Inserir novas mensagens personalizadas
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, mensagem, ativo)
VALUES 
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'convenio_nao_aceito', 
   'Infelizmente o Dr. Marcelo não atende por esse convênio. O paciente pode realizar consulta particular (R$ 240) e solicitar reembolso ao seu plano conforme as regras de cobertura.', 
   true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'convenio_parceiro', 
   'Esse convênio é um parceiro. Recomendamos obter informações sobre atendimento diretamente com o convênio.', 
   true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'orientacoes_teste', 
   '📋 *Orientações para o Teste Ergométrico:*

• Venha com roupa apropriada para prática de esportes
• Venha com sapato fechado sem salto (evite sandálias ou salto)
• Pode fazer o exame descalço, se preferir
• NÃO pode estar de jejum - evite alimentos de difícil digestão 2 horas antes
• Evite café no dia do exame
• NÃO fumar no dia do exame
• NÃO ingerir bebida alcoólica no dia do exame
• Homens com pelos no peito devem vir com o peito raspado
• NÃO usar creme corporal, hidratante ou protetor solar no tórax
• Gestantes NÃO devem fazer o exame
• Evite fazer exercícios no dia do exame
• Se usa medicação, pergunte ao médico se deve suspender antes do exame

📄 O resultado sai no mesmo dia!', 
   true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'valores_teste', 
   'Teste Ergométrico:
• Particular: R$ 240,00 (mínimo R$ 220,00)
• UNIMED 40%: R$ 54,00 (coparticipação)
• UNIMED 20%: R$ 26,00 (coparticipação)', 
   true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
   'documentos_exame', 
   'No dia do exame, traga:
• Documento de identificação
• Carteira do plano de saúde (se houver)
• Guia de solicitação do exame (se por convênio)

⚠️ Se a guia já vier autorizada, verifique a data de validade. Exames com senhas vencidas NÃO serão realizados.', 
   true);