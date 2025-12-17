-- Desabilitar apenas triggers de usuário (não de sistema)
ALTER TABLE agendamentos DISABLE TRIGGER validate_appointment_date_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER validate_doctor_active_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER validate_insurance_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER validate_patient_age_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_validar_limite_agendamentos;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_enviar_confirmacao_whatsapp;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_n8n_appointment_created;
ALTER TABLE agendamentos DISABLE TRIGGER audit_agendamentos_trigger;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_liberar_horario;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_liberar_horario_edicao;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_processar_fila_cancelamento;
ALTER TABLE agendamentos DISABLE TRIGGER trigger_update_alterado_por;
ALTER TABLE agendamentos DISABLE TRIGGER update_agendamentos_updated_at;

-- MIGRAR AGENDAMENTOS HISTÓRICOS (apenas com pacientes existentes)
INSERT INTO agendamentos (
  id, paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
  convenio, observacoes, criado_por, status, 
  confirmado_por, confirmado_em, cancelado_por, cancelado_em,
  cliente_id, created_at, updated_at
)
SELECT 
  ea.agendamento_id_original,
  ea.paciente_id,
  COALESCE(tmm.principal_medico_id, m_fallback.id),
  COALESCE(
    (SELECT id FROM atendimentos WHERE id = ea.atendimento_id AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
    'ae8ddec1-8f81-4fb9-b335-f6925bb821a2'::uuid
  ),
  ea.data_agendamento,
  ea.hora_agendamento,
  UPPER(ea.convenio),
  COALESCE(ea.observacoes, '') || ' [MIGRADO]',
  COALESCE(ea.criado_por, 'sistema_migracao'),
  COALESCE(ea.status, 'agendado'),
  ea.confirmado_por,
  ea.confirmado_em,
  ea.cancelado_por,
  ea.cancelado_em,
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid,
  ea.created_at,
  ea.updated_at
FROM endogastro_agendamentos ea
LEFT JOIN temp_medico_mapping tmm ON tmm.endogastro_medico_id = ea.medico_id
LEFT JOIN medicos m_fallback ON m_fallback.id = ea.medico_id AND m_fallback.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE ea.paciente_id IN (SELECT id FROM pacientes)
  AND NOT EXISTS (SELECT 1 FROM agendamentos a WHERE a.id = ea.agendamento_id_original)
ON CONFLICT (id) DO NOTHING;

-- Reabilitar triggers
ALTER TABLE agendamentos ENABLE TRIGGER validate_appointment_date_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER validate_doctor_active_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER validate_insurance_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER validate_patient_age_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_validar_limite_agendamentos;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_enviar_confirmacao_whatsapp;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_n8n_appointment_created;
ALTER TABLE agendamentos ENABLE TRIGGER audit_agendamentos_trigger;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_liberar_horario;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_liberar_horario_edicao;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_processar_fila_cancelamento;
ALTER TABLE agendamentos ENABLE TRIGGER trigger_update_alterado_por;
ALTER TABLE agendamentos ENABLE TRIGGER update_agendamentos_updated_at;