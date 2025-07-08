import { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Appointment, Doctor, TimeSlot } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function useScheduling() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { toast } = useToast();

  const addAppointment = useCallback((appointment: Omit<Appointment, 'id'>) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    setAppointments(prev => [...prev, newAppointment]);
    
    toast({
      title: "Agendamento realizado com sucesso!",
      description: `Consulta marcada para ${format(new Date(appointment.date), 'dd/MM/yyyy')} às ${appointment.time}`,
    });

    return newAppointment;
  }, [toast]);

  const getAppointmentsForDoctor = useCallback((doctorId: string) => {
    return appointments.filter(apt => apt.doctorId === doctorId);
  }, [appointments]);

  const generateTimeSlots = useCallback((doctor: Doctor, selectedDate: Date): TimeSlot[] => {
    if (!selectedDate) return [];

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const doctorAppointments = appointments.filter(
      apt => apt.doctorId === doctor.id && apt.date === dateStr
    );

    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = doctor.workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = doctor.workingHours.end.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const existingAppointment = doctorAppointments.find(apt => apt.time === timeStr);
      
      slots.push({
        time: timeStr,
        available: !existingAppointment,
        appointmentId: existingAppointment?.id,
      });
      
      currentMinute += doctor.consultationDuration;
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }
    }
    
    return slots;
  }, [appointments]);

  const updateAppointmentStatus = useCallback((appointmentId: string, status: Appointment['status']) => {
    setAppointments(prev => 
      prev.map(apt => 
        apt.id === appointmentId ? { ...apt, status } : apt
      )
    );

    toast({
      title: "Status atualizado",
      description: `Agendamento ${status === 'completed' ? 'concluído' : 'cancelado'} com sucesso.`,
    });
  }, [toast]);

  const cancelAppointment = useCallback((appointmentId: string) => {
    updateAppointmentStatus(appointmentId, 'cancelled');
  }, [updateAppointmentStatus]);

  const completeAppointment = useCallback((appointmentId: string) => {
    updateAppointmentStatus(appointmentId, 'completed');
  }, [updateAppointmentStatus]);

  return {
    appointments,
    addAppointment,
    getAppointmentsForDoctor,
    generateTimeSlots,
    cancelAppointment,
    completeAppointment,
  };
}