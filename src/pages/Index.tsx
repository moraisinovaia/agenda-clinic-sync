import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseScheduling } from '@/hooks/useSupabaseScheduling';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotifications } from '@/hooks/useNotifications';

import { SchedulingForm } from '@/components/scheduling/SchedulingForm';
import { SimpleSchedulingForm } from '@/components/scheduling/SimpleSchedulingForm';
import { MultipleSchedulingModal } from '@/components/scheduling/MultipleSchedulingModal';

import { DoctorSchedule } from '@/components/scheduling/DoctorSchedule';
import { AppointmentsList } from '@/components/scheduling/AppointmentsList';
import { BloqueioAgenda } from '@/components/scheduling/BloqueioAgenda';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaList } from '@/components/fila-espera/FilaEsperaList';
import { RelatorioAgenda } from '@/components/scheduling/RelatorioAgenda';

import { StatsCards } from '@/components/dashboard/StatsCards';
import { SystemHealthDashboard } from '@/components/dashboard/SystemHealthDashboard';
import { DoctorsView } from '@/components/dashboard/DoctorsView';
import { DashboardActions } from '@/components/dashboard/DashboardActions';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UserApprovalPanel } from '@/components/admin/UserApprovalPanel';
import { ClinicManagementPanel } from '@/components/admin/ClinicManagementPanel';
import { DoctorManagementPanel } from '@/components/admin/DoctorManagementPanel';
import { ServiceManagementPanel } from '@/components/admin/ServiceManagementPanel';
import DoctorScheduleConfigPanel from '@/components/admin/DoctorScheduleConfigPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LazyDashboard, 
  LazySchedulingForm, 
  LazyAppointmentsList, 
  LazyFilaEspera,
  LazyWrapper 
} from '@/components/performance/LazyComponents';

import { SystemMonitor } from '@/components/system/SystemMonitor';
import { SchedulingErrorBoundary } from '@/components/error/SchedulingErrorBoundary';

import { useFilaEspera } from '@/hooks/useFilaEspera';
import { useViewMode } from '@/hooks/useViewMode';
import { useGoogleTranslateDetection } from '@/hooks/useGoogleTranslateDetection';
import { SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Button } from '@/components/ui/button';
import { NavigationHeader } from '@/components/ui/navigation-header';
import { GoogleTranslateWarning } from '@/components/ui/google-translate-warning';
import PendingApproval from '@/components/PendingApproval';
import { DoctorScheduleGenerator } from '@/components/scheduling/DoctorScheduleGenerator';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const Index = () => {
  const { user, profile, loading: authLoading, signOut, isAdmin } = useStableAuth();
  
  // Debug log
  console.log('🏠 Index: Estado atual -', {
    isAdmin,
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

      const { data, error } = await supabase
        .from('horarios_vazios')
        .select('*')
        .eq('cliente_id', userClienteId)
        .eq('status', 'disponivel')
        .gte('data', format(new Date(), 'yyyy-MM-dd'));
      
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
  }, [userClienteId]);

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
            <p className="text-lg font-medium">INOVAIA</p>
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


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20 mx-auto"></div>
          </div>
          <div>
            <p className="text-lg font-medium">INOVAIA</p>
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
        profileRole={isAdmin ? 'admin' : 'user'}
        onBack={goBack}
        onBackToFilaEspera={goBackToFilaEspera}
        onSignOut={signOut}
      />

      {/* Aviso sobre Google Translate */}
      <div className="container mx-auto px-4 pt-4">
        <GoogleTranslateWarning 
          isVisible={showGoogleTranslateWarning}
          onDismiss={handleDismissGoogleWarning}
        />
      </div>

      <div className="container mx-auto px-4 py-6">
        {viewMode === 'doctors' && (
          <div className="space-y-6">
            {/* Admin view - apenas gerenciamento de usuários */}
            {isAdmin ? (
              <Tabs defaultValue="usuarios" className="w-full">
                <TabsList className="grid w-full grid-cols-5 max-w-3xl mb-6">
                  <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                  <TabsTrigger value="clinicas">Clínicas</TabsTrigger>
                  <TabsTrigger value="medicos">Médicos</TabsTrigger>
                  <TabsTrigger value="servicos">Serviços</TabsTrigger>
                  <TabsTrigger value="horarios">Horários</TabsTrigger>
                </TabsList>
                <TabsContent value="usuarios">
                  <UserApprovalPanel />
                </TabsContent>
                <TabsContent value="clinicas">
                  <ClinicManagementPanel />
                </TabsContent>
                <TabsContent value="medicos">
                  <DoctorManagementPanel />
                </TabsContent>
                <TabsContent value="servicos">
                  <ServiceManagementPanel />
                </TabsContent>
                <TabsContent value="horarios">
                  <DoctorScheduleConfigPanel />
                </TabsContent>
              </Tabs>
            ) : (
              // Receptionist view - dashboard completo
              <>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3">
                    <StatsCards doctors={doctors} appointments={appointments} />
                    
                    <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div className="relative max-w-md">
                        {/* This will be moved to DoctorsView component */}
                      </div>
                      <DashboardActions 
                        onViewChange={setViewMode}
                        onConfigureSchedule={() => setScheduleGenOpen(true)}
                      />
                    </div>

                    <DoctorsView
                      doctors={doctors}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onScheduleDoctor={handleScheduleDoctor}
                      onViewSchedule={handleViewSchedule}
                    />
                  </div>
                  
                  <div className="lg:col-span-1">
                    <SystemMonitor />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {viewMode === 'schedule' && selectedDoctor && (
          <div className="space-y-6">
            <NavigationHeader
              title={`Agenda - ${selectedDoctor.nome}`}
              subtitle={selectedDoctor.especialidade}
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <SchedulingErrorBoundary>
              <DoctorSchedule
                doctor={selectedDoctor}
                appointments={appointments.filter(apt => apt.medico_id === selectedDoctor.id)}
                blockedDates={blockedDates}
                isDateBlocked={isDateBlocked}
                onCancelAppointment={cancelAppointment}
                onDeleteAppointment={deleteAppointment}
                onConfirmAppointment={handleConfirmAppointment}
                onUnconfirmAppointment={handleUnconfirmAppointment}
                onEditAppointment={handleEditAppointment}
                onNewAppointment={(selectedDate) => {
                if (selectedDate) {
                  setSelectedAppointmentDate(selectedDate);
                  setSelectedAppointmentTime(undefined);
                }
                setViewMode('new-appointment');
              }}
              onNewAppointmentWithTime={handleNewAppointmentWithTime}
              initialDate={lastAppointmentDate || undefined}
              atendimentos={atendimentos}
              adicionarFilaEspera={adicionarFilaEspera}
              searchPatientsByBirthDate={searchPatientsByBirthDate}
              emptySlots={emptySlots}
            />
            </SchedulingErrorBoundary>
          </div>
        )}

        {viewMode === 'new-appointment' && (
          <div className="space-y-6">
            <NavigationHeader
              title="Novo Agendamento"
              subtitle={selectedDoctor ? `${selectedDoctor.nome} - ${selectedDoctor.especialidade}` : undefined}
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <SchedulingErrorBoundary key={`scheduling-form-${selectedDoctor?.id || 'new'}`}>
              <SimpleSchedulingForm
                key={`simple-form-${selectedDoctor?.id || 'new'}-${editingAppointment?.id || 'new'}`}
                doctors={doctors}
                atendimentos={atendimentos}
                appointments={appointments}
                blockedDates={blockedDates}
                isDateBlocked={isDateBlocked}
                onSubmit={handleSimpleAppointmentSubmit}
                onSubmitWithForce={handleSimpleAppointmentSubmitWithForce}
                onCancel={goBack}
                getAtendimentosByDoctor={getAtendimentosByDoctor}
                searchPatientsByBirthDate={searchPatientsByBirthDate}
                preSelectedDoctor={selectedDoctor?.id}
                preSelectedDate={selectedAppointmentDate || undefined}
                preSelectedTime={selectedAppointmentTime}
                adicionarFilaEspera={adicionarFilaEspera}
                onMultipleSuccess={handleMultipleAppointmentSuccess}
                onFillLastPatient={(fn: () => void) => {
                  fillLastPatientRef.current = fn;
                }}
                onCancelAppointment={cancelAppointment}
                onDeleteAppointment={deleteAppointment}
                onConfirmAppointment={confirmAppointment}
                onUnconfirmAppointment={unconfirmAppointment}
              />
            </SchedulingErrorBoundary>
          </div>
        )}


        {viewMode === 'appointments-list' && (
          <div className="space-y-6">
            <NavigationHeader
              title="Lista de Agendamentos"
              subtitle="Gerencie todos os agendamentos"
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <AppointmentsList 
              appointments={appointments}
              doctors={doctors}
              allowCanceled={true}
              onEditAppointment={handleEditAppointment}
              onNavigateToAppointment={handleNavigateToAppointment}
              onCancelAppointment={cancelAppointment}
              onDeleteAppointment={deleteAppointment}
              onConfirmAppointment={handleConfirmAppointment}
              onUnconfirmAppointment={handleUnconfirmAppointment}
            />
          </div>
        )}

        {viewMode === 'canceled-appointments' && (
          <div className="space-y-6">
            <NavigationHeader
              title="Agendamentos Cancelados"
              subtitle="Visualize todos os agendamentos cancelados"
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <AppointmentsList 
              appointments={appointments.filter(apt => 
                apt.status === 'cancelado' || 
                apt.status === 'cancelado_bloqueio' || 
                apt.status === 'excluido'
              )}
              doctors={doctors}
              onEditAppointment={handleEditAppointment}
              onNavigateToAppointment={handleNavigateToAppointment}
              onCancelAppointment={cancelAppointment}
              onDeleteAppointment={deleteAppointment}
              onConfirmAppointment={handleConfirmAppointment}
              onUnconfirmAppointment={handleUnconfirmAppointment}
              allowCanceled={true}
            />
          </div>
        )}

        {viewMode === 'edit-appointment' && editingAppointment && (
          <div className="space-y-6">
            <NavigationHeader
              title="Editar Agendamento"
              subtitle={`${editingAppointment.pacientes?.nome_completo} - ${editingAppointment.medicos?.nome}`}
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <SchedulingErrorBoundary key={`scheduling-form-edit-${editingAppointment?.id}`}>
              <SimpleSchedulingForm
                key={`edit-form-${editingAppointment?.id}`}
                doctors={doctors}
                atendimentos={atendimentos}
                appointments={appointments}
                blockedDates={blockedDates}
                isDateBlocked={isDateBlocked}
                onSubmit={handleSimpleAppointmentSubmit}
                onCancel={goBack}
                getAtendimentosByDoctor={getAtendimentosByDoctor}
                searchPatientsByBirthDate={searchPatientsByBirthDate}
                editingAppointment={editingAppointment}
                adicionarFilaEspera={adicionarFilaEspera}
                onMultipleSuccess={handleMultipleAppointmentSuccess}
                onFillLastPatient={(fn: () => void) => {
                  fillLastPatientRef.current = fn;
                }}
                onCancelAppointment={cancelAppointment}
                onDeleteAppointment={deleteAppointment}
                onConfirmAppointment={confirmAppointment}
                onUnconfirmAppointment={unconfirmAppointment}
              />
            </SchedulingErrorBoundary>
          </div>
        )}

        {viewMode === 'fila-espera' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Fila de Espera</h2>
                <p className="text-muted-foreground mt-1">
                  Gerencie a fila de espera para otimizar ocupação dos médicos
                </p>
              </div>
              <Button onClick={() => setViewMode('nova-fila')}>
                Adicionar à Fila
              </Button>
            </div>
            <FilaEsperaList 
              filaEspera={filaEspera}
              status={getFilaStatus()}
              loading={filaLoading}
              error={filaError}
              onUpdateStatus={atualizarStatusFila}
              onRemove={removerDaFila}
              onLoadData={() => fetchFilaEspera(true)}
            />
          </div>
        )}

        {viewMode === 'nova-fila' && (
          <FilaEsperaForm
            doctors={doctors}
            atendimentos={atendimentos}
            onSubmit={adicionarFilaEspera}
            onCancel={goBackToFilaEspera}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        )}

        {viewMode === 'relatorio-agenda' && (
          <RelatorioAgenda
            doctors={doctors}
            appointments={appointments}
            onBack={goBack}
          />
        )}

        {viewMode === 'bloqueio-agenda' && (
          <BloqueioAgenda onBack={goBack} onRefresh={refetch} />
        )}
      </div>

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
        onSuccess={async () => {
          // Recarregar horários vazios após geração
          if (!userClienteId) {
            console.warn('⚠️ cliente_id não disponível para recarregar horários');
            return;
          }

          console.log('🔄 Recarregando horários vazios após geração');
          
          const { data, error } = await supabase
            .from('horarios_vazios')
            .select('*')
            .eq('cliente_id', userClienteId)
            .eq('status', 'disponivel')
            .gte('data', format(new Date(), 'yyyy-MM-dd'));
          
          if (error) {
            if (error.code === '42501') {
              console.error('🚫 Erro de permissão RLS ao recarregar horários:', error.message);
            } else {
              console.error('❌ Erro ao recarregar horários:', error);
            }
            return;
          }

          if (data) {
            console.log('✅ Horários vazios recarregados:', data.length);
            setEmptySlots(data);
          }
        }}
      />
    </div>
  );
};

export default Index;
