import { useState, useMemo, useCallback } from 'react';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { useDebounce } from './useDebounce';

interface DoctorWithStats extends Doctor {
  appointmentCount: number;
  todayAppointments: number;
  recentlyUsed: boolean;
}

export const useAdvancedDoctorSearch = (
  doctors: Doctor[], 
  appointments: AppointmentWithRelations[]
) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [showOnlyWithAppointments, setShowOnlyWithAppointments] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Calcular estatísticas dos médicos
  const doctorsWithStats = useMemo((): DoctorWithStats[] => {
    const today = new Date().toISOString().split('T')[0];
    
    return doctors.map(doctor => {
      const doctorAppointments = appointments.filter(apt => apt.medico_id === doctor.id);
      const todayAppointments = doctorAppointments.filter(apt => 
        apt.data_agendamento === today && 
        apt.status !== 'cancelado' && 
        apt.status !== 'cancelado_bloqueio'
      );
      
      // Considerar como "recentemente usado" se teve agendamentos nos últimos 7 dias
      const recentAppointments = appointments.filter(apt => {
        const appointmentDate = new Date(apt.data_agendamento);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return apt.medico_id === doctor.id && appointmentDate >= sevenDaysAgo;
      });

      return {
        ...doctor,
        appointmentCount: doctorAppointments.length,
        todayAppointments: todayAppointments.length,
        recentlyUsed: recentAppointments.length > 0,
      };
    });
  }, [doctors, appointments]);

  // Obter especialidades únicas
  const specialties = useMemo(() => {
    const uniqueSpecialties = [...new Set(doctors.map(doctor => doctor.especialidade))];
    return uniqueSpecialties.sort();
  }, [doctors]);

  // Pesquisa fuzzy simples
  const fuzzyMatch = useCallback((text: string, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedSearch = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Busca exata
    if (normalizedText.includes(normalizedSearch)) return true;
    
    // Busca por iniciais (ex: "dr silva" -> "Doutor Roberto Silva")
    const words = normalizedText.split(' ');
    const searchWords = normalizedSearch.split(' ');
    
    return searchWords.every(searchWord => 
      words.some(word => word.startsWith(searchWord))
    );
  }, []);

  // Filtrar e ordenar médicos
  const filteredDoctors = useMemo(() => {
    let filtered = doctorsWithStats.filter(doctor => {
      if (!doctor.ativo) return false;

      // Filtro de busca
      const matchesSearch = fuzzyMatch(doctor.nome, debouncedSearchTerm) ||
                           fuzzyMatch(doctor.especialidade, debouncedSearchTerm);

      // Filtro de especialidade
      const matchesSpecialty = selectedSpecialty === 'all' || 
                              doctor.especialidade === selectedSpecialty;

      // Filtro de médicos com agendamentos hoje
      const matchesAppointmentFilter = !showOnlyWithAppointments || 
                                     doctor.todayAppointments > 0;

      return matchesSearch && matchesSpecialty && matchesAppointmentFilter;
    });

    // Ordenação inteligente
    filtered.sort((a, b) => {
      // Priorizar médicos recentemente usados
      if (a.recentlyUsed && !b.recentlyUsed) return -1;
      if (!a.recentlyUsed && b.recentlyUsed) return 1;
      
      // Depois por número de agendamentos hoje
      if (a.todayAppointments !== b.todayAppointments) {
        return b.todayAppointments - a.todayAppointments;
      }
      
      // Por último, ordem alfabética
      return a.nome.localeCompare(b.nome);
    });

    return filtered;
  }, [doctorsWithStats, debouncedSearchTerm, selectedSpecialty, showOnlyWithAppointments, fuzzyMatch]);

  // Médicos mais utilizados (top 5)
  const mostUsedDoctors = useMemo(() => {
    return [...doctorsWithStats]
      .filter(doctor => doctor.ativo)
      .sort((a, b) => b.appointmentCount - a.appointmentCount)
      .slice(0, 5);
  }, [doctorsWithStats]);

  // Médicos com agendamentos hoje
  const doctorsWithTodayAppointments = useMemo(() => {
    return doctorsWithStats.filter(doctor => 
      doctor.ativo && doctor.todayAppointments > 0
    ).sort((a, b) => b.todayAppointments - a.todayAppointments);
  }, [doctorsWithStats]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSelectedSpecialty('all');
    setShowOnlyWithAppointments(false);
  }, []);

  const selectDoctor = useCallback((doctorId: string) => {
    const doctor = doctorsWithStats.find(d => d.id === doctorId);
    return doctor;
  }, [doctorsWithStats]);

  return {
    // State
    searchTerm,
    selectedSpecialty,
    showOnlyWithAppointments,
    
    // Setters
    setSearchTerm,
    setSelectedSpecialty,
    setShowOnlyWithAppointments,
    
    // Results
    filteredDoctors,
    mostUsedDoctors,
    doctorsWithTodayAppointments,
    specialties,
    
    // Utils
    clearSearch,
    selectDoctor,
    
    // Stats
    totalDoctors: doctors.length,
    activeDoctors: doctors.filter(d => d.ativo).length,
    filteredCount: filteredDoctors.length,
  };
};