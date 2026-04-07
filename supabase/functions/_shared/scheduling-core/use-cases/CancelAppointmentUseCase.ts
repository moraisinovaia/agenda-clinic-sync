import type { AppointmentRepository } from '../interfaces/AppointmentRepository.ts';
import type {
  CancelAppointmentInput,
  CancelAppointmentOutput,
} from '../domain/types.ts';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../domain/types.ts';

export class CancelAppointmentUseCase {
  constructor(private readonly repo: AppointmentRepository) {}

  async execute(input: CancelAppointmentInput): Promise<CancelAppointmentOutput> {
    const { appointmentId, clienteId, motivo, canceladoPor } = input;

    // 1. Buscar agendamento — garante tenant isolation no repo
    const appointment = await this.repo.findById({ id: appointmentId, clienteId });
    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    // 2. Validar transição de estado
    if (appointment.status === 'cancelled') {
      throw new InvalidStatusTransitionError(appointment.status);
    }

    const previousStatus = appointment.status as 'booked' | 'confirmed';

    // 3. Cancelar — o repo é responsável pelo append de observacoes
    await this.repo.cancel({ id: appointmentId, clienteId, motivo, canceladoPor });

    return { appointmentId, previousStatus };
  }
}
