import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabaseScheduling } from '@/hooks/useSupabaseScheduling';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotifications } from '@/hooks/useNotifications';
import { MultipleSchedulingModal } from '@/components/scheduling/MultipleSchedulingModal';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useFilaEspera } from '@/hooks/useFilaEspera';
import { useViewMode } from '@/hooks/useViewMode';
import { useGoogleTranslateDetection } from '@/hooks/useGoogleTranslateDetection';
import { SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { useStableAuth } from '@/hooks/useStableAuth';
import { GoogleTranslateWarning } from '@/components/ui/google-translate-warning';
import { DoctorScheduleGenerator } from '@/components/scheduling/DoctorScheduleGenerator';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { usePartnerBranding } from '@/hooks/usePartnerBranding';
import { AppViews } from '@/pages/AppViews';

const Index = () => {
  const { user, profile, loading: authLoading, signOut, isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const partnerBranding = usePartnerBranding();
  
  // Debug log
  console.log('🏠 Index: Estado atual -', {
    isAdmin,
    isClinicAdmin,
    clinicAdminClienteId,
    profileStatus: profile?.status,
    userId: user?.id
  });
  
  // Estados sempre inicializados na mesma ordem (antes de qualquer return)
  const [searchTerm, setSearchTerm] = useState('');
  const [multipleSchedulingOpen, setMultipleSchedulingOpen] = useState(false);
  const [emptySlots, setEmptySlots] = useState<any[]>([]);
  const [scheduleGenOpen, setScheduleGenOpen] = useState(false);
  const [selectedAppointmentTime, setSelectedAppointmentTime] = useState<string | undefined>();
  const [userClienteId, setUserClienteId] = useState<string | null>(null);
  
  // Atualizar cliente_id quando profile carregar
  useEffect(() => {
    if (profile?.cliente_id) {
      console.log('🔑 Cliente ID do usuário:', profile.cliente_id);
      setUserClienteId(profile.cliente_id);
    }
  }, [profile]);
  
  // Ref para função de preencher último paciente (F12)
  const fillLastPatientRef = useRef<(() => void) | null>(null);
  
  const {
    viewMode,
    setViewMode,
    selectedDoctor,
    setSelectedDoctor,
    lastAppointmentDate,
    setLastAppointmentDate,
    selectedAppointmentDate,
    setSelectedAppointmentDate,
    editingAppointment,
    setEditingAppointment,
    goBack,
    goBackToFilaEspera
  } = useViewMode();

  // Hook para detectar Google Translate
  const { 
    isGoogleTranslateActive, 
    showWarning: shouldShowGoogleWarning, 
    resetWarning 
  } = useGoogleTranslateDetection();

  const [showGoogleTranslateWarning, setShowGoogleTranslateWarning] = useState(false);

  // Mostrar aviso quando Google Translate for detectado
  useEffect(() => {
    if (shouldShowGoogleWarning()) {
      setShowGoogleTranslateWarning(true);
    }
  }, [isGoogleTranslateActive, shouldShowGoogleWarning]);

  const handleDismissGoogleWarning = () => {
    setShowGoogleTranslateWarning(false);
    resetWarning();
  };

  const {
    doctors,
    atendimentos,
    appointments,
    blockedDates,
    loading,
    createAppointment,
    cancelAppointment, 
    deleteAppointment,
    confirmAppointment,
    unconfirmAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch
  } = useSupabaseScheduling();

  // Force refresh quando entra na agenda de um médico específico
  useEffect(() => {
    if (viewMode === 'schedule' && selectedDoctor) {
      console.log('🔄 Forçando refresh para agenda do médico:', selectedDoctor.nome);
      refetch();
    }
  }, [viewMode, selectedDoctor, refetch]);

  // Buscar horários vazios
  useEffect(() => {
    const fetchEmptySlots = async () => {
      // Verificar se cliente_id está disponível
      if (!userClienteId) {
        console.warn('⚠️ cliente_id não disponível, aguardando...');
        return;
      }

      console.log('🔍 Buscando horários vazios:', {
        cliente_id: userClienteId,
        data_inicio: format(new Date(), 'yyyy-MM-dd')
      });

      let query = supabase
        .from('horarios_vazios')
        .select('*')
        .eq('cliente_id', userClienteId)
        .eq('status', 'disponivel')
        .gte('data', format(new Date(), 'yyyy-MM-dd'));

      // Filtrar por médico selecionado para evitar limite de 1000 linhas do Supabase
      if (selectedDoctor?.id) {
        query = query.eq('medico_id', selectedDoctor.id);
      } else {
        query = query.limit(5000);
      }

      const { data, error } = await query;
      
      if (error) {
        if (error.code === '42501') {
          console.error('🚫 Erro de permissão RLS ao buscar horários vazios:', error.message);
        } else {
          console.error('❌ Erro ao buscar horários vazios:', error);
        }
        return;
      }

      if (data) {
        console.log('✅ Horários vazios carregados:', data.length);
        setEmptySlots(data);
      }
    };
    
    fetchEmptySlots();
    
    // 🚨 OTIMIZAÇÃO FASE 2: Aumentar para 60s e verificar visibilidade da página
    const interval = setInterval(() => {
      // Só buscar se a página está visível (economiza recursos quando aba está inativa)
      if (document.visibilityState === 'visible') {
        fetchEmptySlots();
      }
    }, 60000); // 60 segundos (antes: 30s)

    // Listener para atualizar quando usuário voltar para a aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEmptySlots(); // Atualizar imediatamente ao voltar
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userClienteId, selectedDoctor?.id]);

  // Função centralizada para recarregar horários vazios
  const reloadEmptySlots = useCallback(async () => {
    if (!userClienteId) return;
    let query = supabase
      .from('horarios_vazios')
      .select('*')
      .eq('cliente_id', userClienteId)
      .eq('status', 'disponivel')
      .gte('data', format(new Date(), 'yyyy-MM-dd'));

    if (selectedDoctor?.id) {
      query = query.eq('medico_id', selectedDoctor.id);
    } else {
      query = query.limit(5000);
    }

    const { data, error } = await query;
    if (!error && data) {
      console.log('✅ Horários vazios recarregados:', data.length);
      setEmptySlots(data);
    }
  }, [userClienteId, selectedDoctor?.id]);

  const {
    filaEspera,
    loading: filaLoading,
    error: filaError,
    fetchFilaEspera,
    adicionarFilaEspera,
    atualizarStatusFila,
    removerDaFila,
    getFilaStatus
  } = useFilaEspera();

  const {
    notifyNewAppointment,
    notifyAppointmentConflict,
    notifyCancellation,
  } = useNotifications();

  // Setup keyboard shortcuts - atalhos específicos e funcionais
  const shortcuts = [
    {
      key: 'n',
      ctrlKey: true,
      action: () => {
        console.log('🎯 Atalho Ctrl+N: Mudando para novo agendamento');
        setViewMode('new-appointment');
      },
      description: 'Ctrl+N - Novo agendamento'
    },
    {
      key: 'm',
      ctrlKey: true,
      action: () => {
        console.log('🎯 Atalho Ctrl+M: Mudando para agendamento múltiplo');
        // Resetar estado do modal antes de mudar viewMode
        setMultipleSchedulingOpen(false);
        setViewMode('multiple-appointment');
      },
      description: 'Ctrl+M - Agendamento múltiplo'
    },
    {
      key: 'l',
      ctrlKey: true,
      action: () => {
        console.log('🎯 Atalho Ctrl+L: Mudando para lista de agendamentos');
        setViewMode('appointments-list');
      },
      description: 'Ctrl+L - Lista de agendamentos'
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => {
        console.log('🎯 Atalho Ctrl+D: Mudando para dashboard/médicos');
        setViewMode('doctors');
      },
      description: 'Ctrl+D - Dashboard/Médicos'
    },
    {
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      action: () => {
        console.log('🎯 Atalho Ctrl+Shift+F: Mudando para fila de espera');
        setViewMode('fila-espera');
      },
      description: 'Ctrl+Shift+F - Fila de espera'
    },
    {
      key: 'Escape',
      action: () => {
        console.log('🎯 Atalho Escape: Voltando...');
        if (viewMode !== 'doctors') {
          goBack();
        }
      },
      description: 'Esc - Voltar/Fechar'
    },
    {
      key: 'F12',
      action: () => {
        console.log('🎯 Atalho F12: Tentando preencher último paciente...');
        if ((viewMode === 'new-appointment' || viewMode === 'edit-appointment')) {
          if (fillLastPatientRef.current) {
            console.log('✅ Executando função F12');
            try {
              fillLastPatientRef.current();
            } catch (error) {
              console.error('❌ Erro ao executar F12:', error);
            }
          } else {
            console.log('⚠️ Função F12 não está disponível (ref não definida)');
          }
        } else {
          console.log('⚠️ F12 disponível apenas nas telas de agendamento');
        }
      },
      description: 'F12 - Preencher último paciente agendado'
    }
  ];

  useKeyboardShortcuts(shortcuts);

  // Setup do sistema com controle de execução
  const hasSetupRun = useRef(false);
  
  useEffect(() => {
    // Só executar setup uma vez para usuário aprovado
    if (profile?.status === 'aprovado' && !hasSetupRun.current) {
      hasSetupRun.current = true;
      console.log('✅ Sistema configurado com sucesso');
    }
  }, [profile?.status]);

  // Efeito para abrir modal de agendamento múltiplo
  useEffect(() => {
    if (viewMode === 'multiple-appointment') {
      setMultipleSchedulingOpen(true);
    }
  }, [viewMode]);

  // Handlers de sucesso
  const handleAppointmentSuccess = async () => {
    await fetchFilaEspera(true);
    setViewMode('doctors');
  };

  const handleMultipleAppointmentSuccess = async (data: { medicoId: string; dataAgendamento: string }) => {
    await refetch();
    await fetchFilaEspera(true);
    setMultipleSchedulingOpen(false);
    const doctor = doctors.find(d => d.id === data.medicoId);
    if (doctor) {
      setSelectedDoctor(doctor);
      setLastAppointmentDate(data.dataAgendamento);
      setViewMode('schedule');
    } else {
      setViewMode('doctors');
    }
  };

  // Controlar fechamento do modal múltiplo com melhor sincronização
  const handleMultipleSchedulingClose = (open: boolean) => {
    console.log('🎯 Fechando modal múltiplo:', { open, currentViewMode: viewMode });
    setMultipleSchedulingOpen(open);
    if (!open && viewMode === 'multiple-appointment') {
      console.log('🎯 Voltando para doctors após fechar modal múltiplo');
      setViewMode('doctors');
    }
  };

  // Convênios únicos disponíveis - preservando capitalização original
  const uniqueConvenios = Array.from(
    doctors.flatMap(doctor => doctor.convenios_aceitos || [])
      .reduce((map, convenio) => {
        const key = convenio.toLowerCase();
        if (!map.has(key)) {
          map.set(key, convenio); // Preserva a primeira ocorrência com capitalização original
        }
        return map;
      }, new Map())
      .values()
  ).filter(Boolean).sort();
  
  
  // AuthGuard já cuida da verificação de autenticação e aprovação
  // Remover verificações duplicadas para evitar loops
  
  // Loading state durante verificação de autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20 mx-auto"></div>
          </div>
          <div>
           <p className="text-lg font-medium">Carregando sistema...</p>
            <p className="text-muted-foreground">Verificando autenticação...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleScheduleDoctor = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (doctor) {
      setSelectedDoctor(doctor);
      setViewMode('new-appointment');
    }
  };

  const handleViewSchedule = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (doctor) {
      setSelectedDoctor(doctor);
      setLastAppointmentDate(null);
      setViewMode('schedule');
    }
  };

  // Handler para formulário simples - NORMAL
  const handleSimpleAppointmentSubmit = async (formData: SchedulingFormData) => {
    console.log('🎯🎯🎯 Index.tsx: handleSimpleAppointmentSubmit INICIADO!', { formData, editingId: editingAppointment?.id });
    
    try {
      console.log('📲 Index.tsx: Chamando createAppointment...');
      // Tentar criar o agendamento NORMAL (sem forçar conflito)
      await createAppointment(formData, editingAppointment?.id);
      
      console.log('✅ Index.tsx: Agendamento criado com sucesso - navegando');
      
      // SUCESSO - navegar APENAS após sucesso confirmado
      const doctor = doctors.find(d => d.id === formData.medicoId);
      if (doctor) {
        // Send notification for new appointment (only if not editing)
        if (!editingAppointment) {
          notifyNewAppointment(
            formData.nomeCompleto,
            doctor.nome,
            formData.horaAgendamento
          );
        }
        
        // Navigate based on context
        if (editingAppointment) {
          setSelectedDoctor(doctor);
          setLastAppointmentDate(formData.dataAgendamento);
          setEditingAppointment(null);
          setViewMode('schedule');
        } else {
          setSelectedDoctor(doctor);
          setLastAppointmentDate(formData.dataAgendamento);
          setViewMode('schedule');
        }
      }
    } catch (error) {
      console.log('❌ Index.tsx: Erro capturado - NÃO navegando, deixando formulário intacto');
      // CRÍTICO: Em caso de erro, NÃO fazer nenhuma mudança de estado
      // Deixar o erro subir para o SimpleSchedulingForm tratar
      throw error;
    }
  };

  // Handler para formulário simples - COM FORÇA DE CONFLITO
  const handleSimpleAppointmentSubmitWithForce = async (formData: SchedulingFormData) => {
    console.log('🎯 Index.tsx: handleSimpleAppointmentSubmitWithForce chamado');
    
    try {
      // Tentar criar o agendamento FORÇANDO CONFLITO
      await createAppointment(formData, editingAppointment?.id, true); // force = true
      
      console.log('✅ Index.tsx: Agendamento criado com conflito forçado - navegando');
      
      // SUCESSO - navegar APENAS após sucesso confirmado
      const doctor = doctors.find(d => d.id === formData.medicoId);
      if (doctor) {
        // Send notification for forced appointment
        if (!editingAppointment) {
          notifyNewAppointment(
            formData.nomeCompleto,
            doctor.nome,
            formData.horaAgendamento
          );
        }
        
        // Navigate based on context
        if (editingAppointment) {
          setSelectedDoctor(doctor);
          setLastAppointmentDate(formData.dataAgendamento);
          setEditingAppointment(null);
          setViewMode('schedule');
        } else {
          setSelectedDoctor(doctor);
          setLastAppointmentDate(formData.dataAgendamento);
          setViewMode('schedule');
        }
      }
    } catch (error) {
      console.log('❌ Index.tsx: Erro ao forçar agendamento');
      throw error;
    }
  };

  const handleNavigateToAppointment = (appointment: AppointmentWithRelations) => {
    // Encontrar o médico do agendamento
    const doctor = doctors.find(d => d.id === appointment.medico_id);
    
    if (doctor) {
      // Setar o médico selecionado
      setSelectedDoctor(doctor);
      
      // Setar a data do agendamento para o calendário posicionar automaticamente
      setLastAppointmentDate(appointment.data_agendamento);
      setSelectedAppointmentDate(appointment.data_agendamento);
      
      // Navegar para a agenda do médico
      setViewMode('schedule');
      
      console.log('📍 Navegando para agenda do médico:', {
        medico: doctor.nome,
        data: appointment.data_agendamento
      });
    }
  };

  const handleNewAppointmentWithTime = (date: string, time: string) => {
    setSelectedAppointmentDate(date);
    setSelectedAppointmentTime(time);
    setViewMode('new-appointment');
  };

  const handleEditAppointment = (appointment: AppointmentWithRelations) => {
    const doctor = doctors.find(d => d.id === appointment.medico_id);
    if (doctor) {
      setSelectedDoctor(doctor);
      setEditingAppointment(appointment);
      setViewMode('edit-appointment');
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      await confirmAppointment(appointmentId);
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error);
    }
  };

  const handleUnconfirmAppointment = async (appointmentId: string) => {
    try {
      await unconfirmAppointment(appointmentId);
    } catch (error) {
      console.error('Erro ao desconfirmar agendamento:', error);
    }
  };

  const handleDoctorChange = (doctorId: string) => {
    const newDoctor = doctors.find(d => d.id === doctorId);
    if (newDoctor) {
      setSelectedDoctor(newDoctor);
      setLastAppointmentDate(null);
    }
  };

  const handleNewAppointmentFromCalendar = (selectedDate?: string) => {
    if (selectedDate) setSelectedAppointmentDate(selectedDate);
    setSelectedAppointmentTime(undefined);
    setViewMode('new-appointment');
  };

  const handleConfigureSchedule = () => {
    setScheduleGenOpen(true);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20 mx-auto"></div>
          </div>
          <div>
            <p className="text-lg font-medium">{partnerBranding.partnerName}</p>
            <p className="text-muted-foreground">Carregando dados da clínica...</p>
            <div className="mt-2 w-64 mx-auto bg-secondary rounded-full h-2">
              <div className="bg-primary h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        viewMode={viewMode}
        profileName={profile?.nome}
        profileRole={isAdmin ? 'admin' : isClinicAdmin ? 'admin_clinica' : 'user'}
        onBack={goBack}
        onBackToFilaEspera={goBackToFilaEspera}
        onSignOut={signOut}
      />

      <div className="container mx-auto px-4 pt-4">
        <GoogleTranslateWarning
          isVisible={showGoogleTranslateWarning}
          onDismiss={handleDismissGoogleWarning}
        />
      </div>

      <AppViews
        viewMode={viewMode}
        setViewMode={setViewMode}
        goBack={goBack}
        goBackToFilaEspera={goBackToFilaEspera}
        isAdmin={isAdmin}
        isClinicAdmin={isClinicAdmin}
        doctors={doctors}
        appointments={appointments}
        atendimentos={atendimentos}
        blockedDates={blockedDates}
        emptySlots={emptySlots}
        selectedDoctor={selectedDoctor ?? undefined}
        lastAppointmentDate={lastAppointmentDate}
        selectedAppointmentDate={selectedAppointmentDate}
        selectedAppointmentTime={selectedAppointmentTime}
        editingAppointment={editingAppointment}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        fillLastPatientRef={fillLastPatientRef}
        filaEspera={filaEspera}
        filaLoading={filaLoading}
        filaError={filaError}
        getFilaStatus={getFilaStatus}
        isDateBlocked={isDateBlocked}
        getAtendimentosByDoctor={getAtendimentosByDoctor}
        searchPatientsByBirthDate={searchPatientsByBirthDate}
        cancelAppointment={cancelAppointment}
        deleteAppointment={deleteAppointment}
        confirmAppointment={confirmAppointment}
        unconfirmAppointment={unconfirmAppointment}
        adicionarFilaEspera={adicionarFilaEspera}
        atualizarStatusFila={atualizarStatusFila}
        removerDaFila={removerDaFila}
        fetchFilaEspera={fetchFilaEspera}
        refetch={refetch}
        reloadEmptySlots={reloadEmptySlots}
        handleSimpleAppointmentSubmit={handleSimpleAppointmentSubmit}
        handleSimpleAppointmentSubmitWithForce={handleSimpleAppointmentSubmitWithForce}
        handleScheduleDoctor={handleScheduleDoctor}
        handleViewSchedule={handleViewSchedule}
        handleEditAppointment={handleEditAppointment}
        handleConfirmAppointment={handleConfirmAppointment}
        handleUnconfirmAppointment={handleUnconfirmAppointment}
        handleNavigateToAppointment={handleNavigateToAppointment}
        handleNewAppointmentWithTime={handleNewAppointmentWithTime}
        handleMultipleAppointmentSuccess={handleMultipleAppointmentSuccess}
        handleDoctorChange={handleDoctorChange}
        handleNewAppointmentFromCalendar={handleNewAppointmentFromCalendar}
        handleConfigureSchedule={handleConfigureSchedule}
      />


      {/* Modal de Agendamento Múltiplo */}
      <MultipleSchedulingModal
        open={multipleSchedulingOpen}
        onOpenChange={handleMultipleSchedulingClose}
        doctors={doctors}
        atendimentos={atendimentos}
        availableConvenios={uniqueConvenios}
        onSuccess={handleMultipleAppointmentSuccess}
      />

      {/* Modal de Configuração de Horários */}
      <DoctorScheduleGenerator
        open={scheduleGenOpen}
        onOpenChange={setScheduleGenOpen}
        doctors={doctors}
        onSuccess={reloadEmptySlots}
      />
    </div>
  );
};

export default Index;
