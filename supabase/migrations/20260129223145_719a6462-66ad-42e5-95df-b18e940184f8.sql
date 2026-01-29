-- 1. Atualizar business_rules com MAPA 24H e MRPA
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(config,
    '{servicos,MAPA 24H}', 
    '{
      "tipo_agendamento": "hora_marcada",
      "permite_online": true,
      "horarios_especificos": {"1": "08:00", "2": "09:00", "3": "10:00", "4": "10:30"},
      "limite_diario": 3,
      "tolerancia_minutos": 15,
      "antecedencia_chegada": 10,
      "valores": {"particular": 180, "particular_desconto": 160, "unimed_40": 54, "unimed_20": 27},
      "resultado": "No mesmo dia da devolução",
      "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
    }'::jsonb),
  '{servicos,MRPA}',
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_online": true,
    "dias_semana": [2, 3, 4],
    "periodos": {
      "manha": {"limite": 5, "atendimento_inicio": "08:00", "distribuicao_fichas": "07:00 às 09:00"},
      "tarde": {"limite": 5, "atendimento_inicio": "13:30", "distribuicao_fichas": "13:00 às 15:00"}
    },
    "valores": {"particular": 180, "particular_desconto": 160, "unimed_40": 54, "unimed_20": 27},
    "resultado": "7 dias após devolução",
    "duracao_exame": "4 dias consecutivos",
    "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
  }'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';

-- 2. Expandir constraint incluindo TODOS os tipos existentes + novos
ALTER TABLE llm_mensagens DROP CONSTRAINT IF EXISTS llm_mensagens_tipo_check;
ALTER TABLE llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check 
CHECK (tipo IN (
  'agendamentos_antigos', 'bloqueio_agenda', 'boas_vindas', 'cancelamento',
  'confirmacao', 'convenio_nao_aceito', 'convenio_parceiro', 'data_bloqueada',
  'documentos_exame', 'encaixe', 'hora_marcada', 'lembrete', 'ordem_chegada',
  'orientacoes', 'orientacoes_teste', 'pagamento', 'reagendamento',
  'sem_disponibilidade', 'sem_vaga', 'servico_nao_agendavel', 'valores_teste',
  'orientacoes_mapa_24h', 'orientacoes_mrpa', 'documentos_mapa_mrpa', 'valores_mapa_mrpa'
));

-- 3. Inserir novas mensagens
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, mensagem, ativo) VALUES
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '20b48124-ae41-4e54-8a7e-3e236b8b4829',
 'orientacoes_mapa_24h', 
 '📋 *ORIENTAÇÕES MAPA 24H*

*ANTES DO EXAME:*
• Tomar banho ANTES de vir (NÃO pode com o aparelho)
• Usar roupas confortáveis e mangas largas
• NÃO interrompa medicamentos (exceto se médico solicitar)
• Chegar 10 minutos antes do horário

*DURANTE AS 24 HORAS:*
• Vida normal de trabalho e atividades
• NÃO pode retirar o aparelho
• Evitar exercícios intensos e carregar peso
• Evitar atividades com transpiração excessiva
• Evitar dormir sobre o braço com aparelho
• Celular: pode usar, mas não no mesmo braço

*MEDIÇÕES:*
• A cada 15 min durante o dia
• A cada 30 min durante o sono

*CUIDADOS COM O APARELHO:*
• Evitar pancadas ou quedas
• Uso exclusivo do paciente
• Devolver com folha, bolsa e pilhas

*DEVOLUÇÃO:*
• Respeitar horário marcado
• Atrasos podem gerar multa
• Resultado sai NO MESMO DIA

⚠️ Pacientes idosos devem vir acompanhados', 
 true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '20b48124-ae41-4e54-8a7e-3e236b8b4829',
 'orientacoes_mrpa',
 '📋 *ORIENTAÇÕES MRPA (MAPA 4 DIAS)*

*NO DIA DA RETIRADA:*
• Compareça no horário agendado
• A secretária afere sua pressão 2 vezes
• Receberá o aparelho e folha de anotações
• O exame INICIA NO DIA SEGUINTE

*DURANTE OS 4 DIAS:*
• Medir 3x PELA MANHÃ e 3x À NOITE
• Intervalo de 1-2 minutos entre medições
• Anotar todas as medidas na folha

*POSIÇÃO CORRETA:*
• Sentar por 5 minutos antes
• Dois pés no chão
• Braço apoiado na altura do peito
• Bexiga vazia
• NÃO conversar durante medição
• NÃO mexer o braço

*MEDICAMENTOS:*
• Se toma remédio para pressão, meça ANTES de tomar

*VANTAGENS:*
• Pode tomar banho e fazer exercícios (fora dos horários das medições)
• Avalia efeito do "jaleco branco"

*DEVOLUÇÃO:*
• Devolver após 4 dias com folha preenchida
• Resultado em 7 DIAS

⚠️ Pacientes idosos devem vir acompanhados',
 true),

('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '20b48124-ae41-4e54-8a7e-3e236b8b4829',
 'valores_mapa_mrpa',
 '💰 *VALORES MAPA 24H e MRPA*

• Particular: R$ 180,00
• Com desconto: R$ 160,00
• UNIMED 40%: R$ 54,00
• UNIMED 20%: R$ 27,00
• UNIMED VSF/Nacional/Regional: sem coparticipação
• HGU: conforme convênio',
 true);