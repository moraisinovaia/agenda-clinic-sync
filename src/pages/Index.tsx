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
import { AuthTest } from '@/components/AuthTest';
import PendingApproval from '@/components/PendingApproval';

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

  const handleMultipleAppointmentSuccess = async () => {
    await fetchFilaEspera(true);
    setMultipleSchedulingOpen(false);
    setViewMode('doctors');
  };

  // Controlar fechamento do modal múltiplo
  const handleMultipleSchedulingClose = (open: boolean) => {
    setMultipleSchedulingOpen(open);
    if (!open && viewMode === 'multiple-appointment') {
      setViewMode('doctors');
    }
  };

  // Convênios únicos disponíveis
  const uniqueConvenios = Array.from(new Set(
    doctors.flatMap(doctor => doctor.convenios_aceitos || [])
  )).filter(Boolean);
  
  
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

  // Handler NOVO para formulário simples isolado
  const handleSimpleAppointmentSubmit = async (formData: SchedulingFormData) => {
    console.log('🎯 Index.tsx: handleSimpleAppointmentSubmit chamado (NOVO)');
    
    // CRITICAL: SEM try/catch aqui - deixar o erro subir para o SimpleSchedulingForm
    await createAppointment(formData, editingAppointment?.id);
    
    console.log('✅ Index.tsx: Agendamento criado com sucesso - navegando');
    
    // Sucesso - navegar APENAS após sucesso confirmado
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
        setEditingAppointment(null);
        setViewMode('appointments-list');
      } else {
        setSelectedDoctor(doctor);
        setLastAppointmentDate(formData.dataAgendamento);
        setViewMode('schedule');
      }
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
              <UserApprovalPanel />
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
          <DoctorSchedule
            doctor={selectedDoctor}
            appointments={appointments.filter(apt => apt.medico_id === selectedDoctor.id)}
            blockedDates={blockedDates}
            isDateBlocked={isDateBlocked}
            onCancelAppointment={cancelAppointment}
            onConfirmAppointment={handleConfirmAppointment}
            onEditAppointment={handleEditAppointment}
            onNewAppointment={(selectedDate) => {
              if (selectedDate) {
                setSelectedAppointmentDate(selectedDate);
              }
              setViewMode('new-appointment');
            }}
            initialDate={lastAppointmentDate || undefined}
          />
        )}

        {viewMode === 'new-appointment' && (
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
            preSelectedDoctor={selectedDoctor?.id}
            preSelectedDate={selectedAppointmentDate || undefined}
          />
        )}


        {viewMode === 'appointments-list' && (
          <AppointmentsList 
            appointments={appointments}
            doctors={doctors}
            onEditAppointment={handleEditAppointment}
            onCancelAppointment={cancelAppointment}
            onConfirmAppointment={handleConfirmAppointment}
            onUnconfirmAppointment={handleUnconfirmAppointment}
          />
        )}

        {viewMode === 'canceled-appointments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Agendamentos Cancelados</h2>
                <p className="text-muted-foreground mt-1">
                  Visualize todos os agendamentos cancelados
                </p>
              </div>
            </div>
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
          />
        )}

        {viewMode === 'preparos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Preparos de Exames</h2>
                <p className="text-muted-foreground mt-1">
                  Instruções detalhadas para preparação de exames
                </p>
              </div>
            </div>
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
