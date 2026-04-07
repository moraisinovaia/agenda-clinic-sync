import type { AppointmentRepository } from '../interfaces/AppointmentRepository.ts';
import type {
  BookAppointmentInput,
  BookAppointmentOutput,
} from '../domain/types.ts';
import { SlotAlreadyTakenError } from '../domain/types.ts';

export class BookAppointmentUseCase {
  constructor(private readonly repo: AppointmentRepository) {}

  async execute(input: BookAppointmentInput): Promise<BookAppointmentOutput> {
    const { patient, appointment, meta } = input;

    // 1. Idempotency: se já existe agendamento com essa chave, retornar sem criar
    const duplicate = await this.repo.findDuplicate({
      idempotencyKey: meta.idempotencyKey,
      clienteId: appointment.clienteId,
    });
    if (duplicate.found) {
      return {
        appointmentId: duplicate.appointmentId!,
        patientId: duplicate.patientId!,
        created: false,
      };
    }

    // 2. Pré-check de UX: slot ocupado → erro explícito antes de chamar a RPC
    const slotTaken = await this.repo.isSlotTaken({
      medicoId: appointment.medicoId,
      clienteId: appointment.clienteId,
      date: appointment.date,
      time: appointment.time,
    });
    if (slotTaken) {
      throw new SlotAlreadyTakenError({
        medicoId: appointment.medicoId,
        date: appointment.date,
        time: appointment.time,
      });
    }

    // 3. Criação atômica via RPC — lança SlotAlreadyTakenError em caso de CONFLICT
    const result = await this.repo.create({
      clienteId: appointment.clienteId,
      nomeCompleto: patient.nomeCompleto,
      dataNascimento: patient.dataNascimento,
      convenio: patient.convenio,
      telefone: patient.telefone,
      celular: patient.celular,
      medicoId: appointment.medicoId,
      atendimentoId: appointment.atendimentoId,
      date: appointment.date,
      time: appointment.time,
      observacoes: appointment.observacoes ?? 'Agendamento via LLM Agent WhatsApp',
      criadoPor: meta.criadoPor,
      idempotencyKey: meta.idempotencyKey,
    });

    return {
      appointmentId: result.appointmentId,
      patientId: result.patientId,
      created: true,
      backendMessage: result.backendMessage,
    };
  }
}
