export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  workingHours: {
    start: string;
    end: string;
    days: number[]; // 0 = domingo, 1 = segunda, etc.
  };
  consultationDuration: number; // em minutos
}

export interface Patient {
  id?: string;
  fullName: string;
  birthDate: string;
  insurance: string;
  phone: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patient: Patient;
  date: string;
  time: string;
  type: 'consultation' | 'exam';
  status: 'scheduled' | 'completed' | 'cancelled';
  scheduledBy: 'receptionist' | 'n8n-agent';
  notes?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
}