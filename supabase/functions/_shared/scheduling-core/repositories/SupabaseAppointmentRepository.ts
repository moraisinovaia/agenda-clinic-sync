import type {
  AppointmentRepository,
  CountByPeriodParams,
  CountByPoolParams,
  IsSlotTakenParams,
  FindDuplicateParams,
  DuplicateResult,
  CreateAppointmentParams,
  CreateAppointmentResult,
  CancelAppointmentRepoParams,
} from '../interfaces/AppointmentRepository.ts';
import { SlotAlreadyTakenError } from '../domain/types.ts';
import type { AppointmentDetails, AppointmentStatus } from '../domain/types.ts';
import { InvalidStatusTransitionError } from '../domain/types.ts';

export class SupabaseAppointmentRepository implements AppointmentRepository {
  // deno-lint-ignore no-explicit-any
  constructor(private readonly supabase: any) {}

  async countByPeriod(params: CountByPeriodParams): Promise<number> {
    let query = this.supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', params.medicoId)
      .eq('cliente_id', params.clienteId)
      .eq('data_agendamento', params.date)
      .gte('hora_agendamento', params.start)
      .lte('hora_agendamento', params.end)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado']);

    if (params.minimumDate) {
      query = query.gte('data_agendamento', params.minimumDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).length;
  }

  async countByPool(params: CountByPoolParams): Promise<number> {
    let query = this.supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', params.medicoId)
      .eq('cliente_id', params.clienteId)
      .eq('data_agendamento', params.date)
      .gte('hora_agendamento', params.poolStart)
      .lte('hora_agendamento', params.poolEnd)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado']);

    if (params.minimumDate) {
      query = query.gte('data_agendamento', params.minimumDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).length;
  }

  async isSlotTaken(params: IsSlotTakenParams): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', params.medicoId)
      .eq('cliente_id', params.clienteId)
      .eq('data_agendamento', params.date)
      .eq('hora_agendamento', params.time)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async findDuplicate(params: FindDuplicateParams): Promise<DuplicateResult> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select('id, paciente_id')
      .eq('cliente_id', params.clienteId)
      .eq('idempotency_key', params.idempotencyKey)
      .is('excluido_em', null)
      .in('status', ['agendado', 'confirmado'])
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return { found: false };
    return { found: true, appointmentId: data[0].id, patientId: data[0].paciente_id };
  }

  async create(params: CreateAppointmentParams): Promise<CreateAppointmentResult> {
    const { data, error } = await this.supabase
      .rpc('criar_agendamento_atomico_externo', {
        p_cliente_id: params.clienteId,
        p_nome_completo: params.nomeCompleto,
        p_data_nascimento: params.dataNascimento,
        p_convenio: params.convenio,
        p_telefone: params.telefone ?? null,
        p_celular: params.celular,
        p_medico_id: params.medicoId,
        p_atendimento_id: params.atendimentoId,
        p_data_agendamento: params.date,
        p_hora_agendamento: params.time,
        p_observacoes: params.observacoes,
        p_criado_por: params.criadoPor,
        p_force_conflict: false,
        p_idempotency_key: params.idempotencyKey ?? null,
      });

    if (error) throw error;

    if (!data?.success) {
      if (data?.error === 'CONFLICT') {
        throw new SlotAlreadyTakenError({
          medicoId: params.medicoId,
          date: params.date,
          time: params.time,
        });
      }
      throw new Error(data?.error || data?.message || 'Appointment creation failed');
    }

    return {
      appointmentId: data.agendamento_id,
      patientId: data.paciente_id,
      backendMessage: data.message ?? undefined,
    };
  }

  // ─── Status mapping ───────────────────────────────────────────────────────

  private mapStatus(raw: string): AppointmentStatus {
    const map: Record<string, AppointmentStatus> = {
      agendado: 'booked',
      confirmado: 'confirmed',
      cancelado: 'cancelled',
    };
    return map[raw] ?? ('booked' as AppointmentStatus);
  }

  async findById(params: { id: string; clienteId: string }): Promise<AppointmentDetails | null> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select('id, cliente_id, medico_id, atendimento_id, paciente_id, data_agendamento, hora_agendamento, status, observacoes')
      .eq('id', params.id)
      .eq('cliente_id', params.clienteId)
      .is('excluido_em', null)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      clienteId: data.cliente_id,
      medicoId: data.medico_id,
      atendimentoId: data.atendimento_id,
      pacienteId: data.paciente_id,
      date: data.data_agendamento,
      time: data.hora_agendamento,
      status: this.mapStatus(data.status),
      observacoes: data.observacoes ?? undefined,
    };
  }

  async cancel(params: CancelAppointmentRepoParams): Promise<void> {
    // Ler observacoes atuais para fazer o append (findById já foi chamado pelo use case,
    // mas não carregamos observacoes naquele momento de forma isolada — lemos aqui)
    const { data: current } = await this.supabase
      .from('agendamentos')
      .select('observacoes')
      .eq('id', params.id)
      .eq('cliente_id', params.clienteId)
      .single();

    const suffix = params.motivo
      ? `Cancelado via ${params.canceladoPor}: ${params.motivo}`
      : `Cancelado via ${params.canceladoPor}`;

    const existingObs = current?.observacoes || '';
    const newObs = existingObs ? `${existingObs}\n${suffix}` : suffix;

    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        observacoes: newObs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('cliente_id', params.clienteId)
      .in('status', ['agendado', 'confirmado'])
      .select('id');

    if (error) throw error;

    // 0 linhas afetadas → outro worker cancelou antes desta transação completar
    if (!data || data.length === 0) {
      throw new InvalidStatusTransitionError('cancelled');
    }
  }
}
