-- Pro Oftalmo (Dra. Maria Suely Amorim Mendes) — cadastro completo.
--
-- Mudanças:
--   1) Convênios:
--      - Adiciona MEDPREV (clínica atende; bloqueio global do agente foi
--        removido em paralelo neste deploy)
--      - Troca "SELECT" pelo nome completo "BRADESCO SAÚDE SELECT"
--   2) Novo serviço "Retorno" — gratuito, até 30 dias após consulta
--   3) Campos da clínica (endereço, telefones, horários da recepção etc)
--   4) Valores e formas de pagamento da Consulta
--   5) Mensagens WhatsApp formalizadas

DO $$
DECLARE
  v_medico_id  uuid := 'a38f801c-54fa-4676-b677-7593f05a527e';
  v_cliente_id uuid := '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad';
  v_br_id      uuid := '901daff7-bae6-4d0e-8720-2d0dc9983a24';
BEGIN
  -- ── 1) medicos.convenios_aceitos ─────────────────────────────────────────
  UPDATE public.medicos
  SET convenios_aceitos = (
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (
      SELECT unnest(convenios_aceitos) AS c
      FROM public.medicos
      WHERE id = v_medico_id
      UNION ALL SELECT 'MEDPREV'
      UNION ALL SELECT 'BRADESCO SAÚDE SELECT'
    ) sub
    WHERE c <> 'SELECT'
  )
  WHERE id = v_medico_id;

  -- ── 2) business_rules.config — atualização atômica ───────────────────────
  UPDATE public.business_rules
  SET config = jsonb_strip_nulls(
    config

    -- convenios_aceitos: add MEDPREV + BRADESCO SAÚDE SELECT, remove "SELECT"
    || jsonb_build_object(
      'convenios_aceitos',
      (
        SELECT jsonb_agg(DISTINCT c ORDER BY c)
        FROM (
          SELECT jsonb_array_elements_text(config->'convenios_aceitos') AS c
          WHERE jsonb_array_elements_text(config->'convenios_aceitos') <> 'SELECT'
          UNION ALL SELECT 'MEDPREV'
          UNION ALL SELECT 'BRADESCO SAÚDE SELECT'
        ) src
      )
    )

    -- Info da clínica (consumido pelo prompt do LLM via clinic-info)
    || jsonb_build_object(
      'endereco_completo',
        'Av. Cardoso de Sá, 776 – Cidade Universitária – Petrolina-PE – CEP 56328-020',
      'horario_recepcao', '08:00 às 18:00, sem intervalo para almoço',
      'telefone_urgencia', '(87) 3861-6214',
      'telefone_whatsapp', '(87) 98843-8731',
      'como_chegar',
        'Em frente ao Condomínio Iate Clube, ao lado da Farmácia Drogasil.',
      'emite_nota_fiscal', true,
      'nota_fiscal_mediante_solicitacao', true,
      'realiza_exames_complementares', false,
      'observacao_exames_complementares',
        'Não realizamos exames complementares (mapeamento de retina, tonometria, OCT, etc.). Apenas consultas.',
      'desconto_particular_a_vista', false,
      'tem_estacionamento_proprio', false
    )

    -- Mensagens WhatsApp padronizadas
    || jsonb_build_object(
      'mensagens', jsonb_build_object(
        'boas_vindas',
          'Olá, bem-vindo(a) à Pro Oftalmo! Dra. Suely Amorim agradece o contato. Em que podemos te ajudar?',
        'urgencia',
          'Em caso de urgência, ligue para (87) 3861-6214.',
        'formas_pagamento',
          'Aceitamos Cartão de Crédito/Débito, PIX ou Dinheiro.',
        'orientacao_atendimento',
          'A consulta tem horário marcado. Por favor, chegue 15 minutos antes. Nossa tolerância é de 30 minutos após o horário marcado.',
        'politica_retorno',
          'Retorno gratuito até 30 dias após a consulta.',
        'nota_fiscal',
          'Emitimos nota fiscal mediante solicitação no momento do pagamento.'
      )
    )
  )
  WHERE id = v_br_id;

  -- ── 3) Atualiza serviço Consulta com valores e novo serviço Retorno ─────
  UPDATE public.business_rules
  SET config = jsonb_set(
    jsonb_set(
      config,
      '{servicos,Consulta}',
      (config->'servicos'->'Consulta')
        || jsonb_build_object(
          'valor_particular', 350,
          'valor_coparticipacao_20', 38,
          'valor_coparticipacao_40', 78,
          'formas_pagamento', jsonb_build_array('Dinheiro', 'Cartão', 'PIX'),
          'observacao',
            'Hora marcada. Chegar 15 min antes. Tolerância de 30 min após horário marcado.'
        )
    ),
    '{servicos,Retorno}',
    jsonb_build_object(
      'tipo', 'retorno',
      'permite_online', true,
      'valor_particular', 0,
      'gratuito_dentro_de_30_dias', true,
      'observacao',
        'Retorno gratuito até 30 dias após a consulta. Após 30 dias, cobrado como nova consulta.',
      'periodos', config->'servicos'->'Consulta'->'periodos',
      'dias_atendimento', config->'servicos'->'Consulta'->'dias_atendimento'
    )
  )
  WHERE id = v_br_id;

  -- ── 4) Alinha medicos.convenios_aceitos final (sem SELECT, com extras) ──
  -- (já feito acima, mas garantir consistência aqui caso a sub-query do
  -- passo 1 tenha race com o cadastro original)
  UPDATE public.medicos
  SET convenios_aceitos = ARRAY(
    SELECT DISTINCT jsonb_array_elements_text(
      (SELECT config->'convenios_aceitos' FROM public.business_rules WHERE id = v_br_id)
    )
  )
  WHERE id = v_medico_id;
END $$;
