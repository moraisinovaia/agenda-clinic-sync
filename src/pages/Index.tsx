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
import { PreparosView } from '@/components/preparos/PreparosView';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaList } from '@/components/fila-espera/FilaEsperaList';
import { RelatorioAgenda } from '@/components/scheduling/RelatorioAgenda';

import { StatsCards } from '@/components/dashboard/StatsCards';
import { SystemHealthDashboard } from '@/components/dashboard/SystemHealthDashboard';
import { DoctorsView } from '@/components/dashboard/DoctorsView';
import { DashboardActions } from '@/components/dashboard/DashboardActions';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AlertSystem } from '@/components/alerts/AlertSystem';
import { UserApprovalPanel } from '@/components/admin/UserApprovalPanel';
import { 
  LazyDashboard, 
  LazySchedulingForm, 
  LazyAppointmentsList, 
  LazyFilaEspera, 
  LazyPreparos,
  LazyWrapper 
} from '@/components/performance/LazyComponents';

import { SystemMonitor } from '@/components/system/SystemMonitor';
import { SchedulingErrorBoundary } from '@/components/error/SchedulingErrorBoundary';

import { useFilaEspera } from '@/hooks/useFilaEspera';
import { useViewMode } from '@/hooks/useViewMode';
import { SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Button } from '@/components/ui/button';
import { NavigationHeader } from '@/components/ui/navigation-header';
import { AuthTest } from '@/components/AuthTest';
import PendingApproval from '@/components/PendingApproval';
import { WhatsAppAgentDashboard } from '@/components/whatsapp-agent/WhatsAppAgentDashboard';
import { WhatsAppTestPanel } from '@/components/admin/WhatsAppTestPanel';

const Index = () => {
  const { user, profile, loading: authLoading, signOut } = useStableAuth();
  
  // Estados sempre inicializados na mesma ordem (antes de qualquer return)
  const [searchTerm, setSearchTerm] = useState('');
  const [multipleSchedulingOpen, setMultipleSchedulingOpen] = useState(false);
  
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

  const {
    doctors,
    atendimentos,
    appointments,
    blockedDates,
    loading,
    createAppointment,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    isDateBlocked,
    getBlockedDatesByDoctor,
    refetch
  } = useSupabaseScheduling();

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
      action: () => setViewMode('new-appointment'),
      description: 'Ctrl+N - Novo agendamento'
    },
    {
      key: 'm',
      ctrlKey: true,
      action: () => setViewMode('multiple-appointment'),
      description: 'Ctrl+M - Agendamento múltiplo'
    },
    {
      key: 'l',
      ctrlKey: true,
      action: () => setViewMode('appointments-list'),
      description: 'Ctrl+L - Lista de agendamentos'
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => setViewMode('doctors'),
      description: 'Ctrl+D - Dashboard/Médicos'
    },
    {
      key: 'a',
      ctrlKey: true,
      action: () => setViewMode('alertas'),
      description: 'Ctrl+A - Alertas'
    },
    {
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      action: () => setViewMode('fila-espera'),
      description: 'Ctrl+Shift+F - Fila de espera'
    },
    {
      key: 'Escape',
      action: () => {
        if (viewMode !== 'doctors') {
          goBack();
        }
      },
      description: 'Esc - Voltar/Fechar'
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

  // Controlar fechamento do modal múltiplo
  const handleMultipleSchedulingClose = (open: boolean) => {
    setMultipleSchedulingOpen(open);
    if (!open && viewMode === 'multiple-appointment') {
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
  
  
  // Redirecionar para login se não autenticado
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Show pending approval screen if user is not approved
  if (!authLoading && user && profile && profile.status !== 'aprovado') {
    return <PendingApproval profile={profile} />;
  }
  
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
            <p className="text-lg font-medium">Endogastro</p>
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
    console.log('🎯 Index.tsx: handleSimpleAppointmentSubmit chamado');
    
    try {
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
            <p className="text-lg font-medium">Endogastro</p>
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
        onBack={goBack}
        onBackToFilaEspera={goBackToFilaEspera}
        onSignOut={signOut}
      />

      <div className="container mx-auto px-4 py-6">
        {viewMode === 'doctors' && (
          <div className="space-y-6">
            {/* User Approval Panel for Admins */}
            {profile?.role === 'admin' && profile?.status === 'aprovado' && (
              <>
                <UserApprovalPanel />
                <WhatsAppTestPanel />
              </>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <StatsCards doctors={doctors} appointments={appointments} />
                
                <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="relative max-w-md">
                    {/* This will be moved to DoctorsView component */}
                  </div>
                  <DashboardActions onViewChange={setViewMode} />
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
            <DoctorSchedule
              doctor={selectedDoctor}
              appointments={appointments.filter(apt => apt.medico_id === selectedDoctor.id)}
              blockedDates={blockedDates}
              isDateBlocked={isDateBlocked}
              onCancelAppointment={cancelAppointment}
              onConfirmAppointment={handleConfirmAppointment}
              onUnconfirmAppointment={handleUnconfirmAppointment}
              onEditAppointment={handleEditAppointment}
              onNewAppointment={(selectedDate) => {
                if (selectedDate) {
                  setSelectedAppointmentDate(selectedDate);
                }
                setViewMode('new-appointment');
              }}
              initialDate={lastAppointmentDate || undefined}
              atendimentos={atendimentos}
              adicionarFilaEspera={adicionarFilaEspera}
              searchPatientsByBirthDate={searchPatientsByBirthDate}
            />
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
            <SchedulingErrorBoundary>
              <SimpleSchedulingForm
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
                adicionarFilaEspera={adicionarFilaEspera}
                onMultipleSuccess={handleMultipleAppointmentSuccess}
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
              onEditAppointment={handleEditAppointment}
              onCancelAppointment={cancelAppointment}
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
              appointments={appointments.filter(apt => apt.status === 'cancelado')}
              doctors={doctors}
              onEditAppointment={handleEditAppointment}
              onCancelAppointment={cancelAppointment}
              onConfirmAppointment={handleConfirmAppointment}
              onUnconfirmAppointment={handleUnconfirmAppointment}
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
            <SimpleSchedulingForm
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
            />
          </div>
        )}

        {viewMode === 'preparos' && (
          <div className="space-y-6">
            <NavigationHeader
              title="Preparos de Exames"
              subtitle="Instruções detalhadas para preparação de exames"
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <PreparosView showAll={true} />
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

        {viewMode === 'auth-test' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Teste de Autenticação</h2>
                <p className="text-muted-foreground mt-1">
                  Verifique o status completo da autenticação e sessão
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <AuthTest />
            </div>
          </div>
        )}

        {viewMode === 'alertas' && (
          <AlertSystem />
        )}

        {viewMode === 'whatsapp-agent' && (
          <div className="space-y-6">
            <NavigationHeader
              title="Agente WhatsApp"
              subtitle="Teste e monitore as funcionalidades do agente LLM para WhatsApp"
              onBack={goBack}
              onHome={() => setViewMode('doctors')}
              showBack={true}
              showHome={true}
            />
            <WhatsAppAgentDashboard />
          </div>
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
    </div>
  );
};

export default Index;
