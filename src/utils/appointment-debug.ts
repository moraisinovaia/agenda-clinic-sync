/**
 * Funções globais de debug para diagnosticar problemas de agendamentos
 */

import { format } from 'date-fns';
import { AppointmentWithRelations } from '@/types/scheduling';
import { Doctor } from '@/types/scheduling';

declare global {
  interface Window {
    debugAppointments: (appointments: AppointmentWithRelations[]) => void;
    debugDoctorSchedule: (doctor: Doctor, appointments: AppointmentWithRelations[], targetDate?: string) => void;
    debugSeptemberAppointments: (appointments: AppointmentWithRelations[]) => void;
  }
}

// Função global para debug de agendamentos
export const setupAppointmentDebugFunctions = (appointments: AppointmentWithRelations[]) => {
  // Debug geral de agendamentos
  window.debugAppointments = (appointmentList: AppointmentWithRelations[]) => {
    console.group('🔍 DEBUG APPOINTMENTS');
    console.log('Total appointments:', appointmentList.length);
    
    // Agrupar por mês
    const byMonth = appointmentList.reduce((acc, apt) => {
      const month = apt.data_agendamento?.substring(0, 7) || 'unknown';
      if (!acc[month]) acc[month] = [];
      acc[month].push(apt);
      return acc;
    }, {} as Record<string, AppointmentWithRelations[]>);
    
    console.log('By month:', Object.entries(byMonth).map(([month, apts]) => ({
      month,
      count: apts.length,
      doctors: [...new Set(apts.map(a => a.medicos?.nome))].filter(Boolean)
    })));
    
    // Setembro específico
    const september = appointmentList.filter(apt => 
      apt.data_agendamento >= '2025-09-01' && apt.data_agendamento <= '2025-09-30'
    );
    console.log('September 2025 appointments:', september.length);
    september.forEach(apt => {
      console.log(`  ${apt.data_agendamento} ${apt.hora_agendamento} - ${apt.medicos?.nome} - ${apt.pacientes?.nome_completo}`);
    });
    
    console.groupEnd();
  };

  // Debug específico para médico
  window.debugDoctorSchedule = (doctor: Doctor, appointmentList: AppointmentWithRelations[], targetDate?: string) => {
    console.group(`🩺 DEBUG DOCTOR: ${doctor.nome}`);
    console.log('Doctor ID:', doctor.id);
    console.log('Doctor ID type:', typeof doctor.id);
    
    // Todos os agendamentos do médico
    const doctorAppointments = appointmentList.filter(apt => 
      String(apt.medico_id) === String(doctor.id)
    );
    console.log('Total appointments for doctor:', doctorAppointments.length);
    
    // Por data
    const byDate = doctorAppointments.reduce((acc, apt) => {
      const date = apt.data_agendamento || 'unknown';
      if (!acc[date]) acc[date] = [];
      acc[date].push(apt);
      return acc;
    }, {} as Record<string, AppointmentWithRelations[]>);
    
    console.log('By date:', Object.entries(byDate).map(([date, apts]) => ({
      date,
      count: apts.length,
      times: apts.map(a => a.hora_agendamento).sort()
    })));
    
    if (targetDate) {
      const targetAppointments = doctorAppointments.filter(apt => 
        apt.data_agendamento === targetDate
      );
      console.log(`Appointments on ${targetDate}:`, targetAppointments);
    }
    
    console.groupEnd();
  };

  // Debug específico para setembro
  window.debugSeptemberAppointments = (appointmentList: AppointmentWithRelations[]) => {
    console.group('📅 DEBUG SEPTEMBER 2025');
    
    const september = appointmentList.filter(apt => 
      apt.data_agendamento >= '2025-09-01' && apt.data_agendamento <= '2025-09-30'
    );
    
    console.log('Total September appointments:', september.length);
    
    // Por médico
    const byDoctor = september.reduce((acc, apt) => {
      const doctorId = apt.medico_id || 'unknown';
      const doctorName = apt.medicos?.nome || 'Unknown';
      const key = `${doctorName} (${doctorId})`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(apt);
      return acc;
    }, {} as Record<string, AppointmentWithRelations[]>);
    
    console.log('September by doctor:');
    Object.entries(byDoctor).forEach(([doctor, apts]) => {
      console.log(`  ${doctor}: ${apts.length} appointments`);
      apts.forEach(apt => {
        console.log(`    ${apt.data_agendamento} ${apt.hora_agendamento} - ${apt.pacientes?.nome_completo}`);
      });
    });
    
    console.groupEnd();
  };

  // Executar debug inicial
  if (appointments.length > 0) {
    console.log('🚀 Appointment debug functions loaded. Use:');
    console.log('  window.debugAppointments(appointments)');
    console.log('  window.debugDoctorSchedule(doctor, appointments, "2025-09-01")');
    console.log('  window.debugSeptemberAppointments(appointments)');
    
    // Auto-debug setembro se houver dados
    window.debugSeptemberAppointments(appointments);
  }
};