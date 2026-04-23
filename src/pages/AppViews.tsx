import React from 'react';
import { ViewMode } from '@/hooks/useViewMode.tsx';
import { Doctor, AppointmentWithRelations, Atendimento, SchedulingFormData } from '@/types/scheduling';
import { FilaEsperaWithRelations, FilaStatus } from '@/types/fila-espera';

import { SimpleSchedulingForm } from '@/components/scheduling/SimpleSchedulingForm';
import { DoctorSchedule } from '@/components/scheduling/DoctorSchedule';
import { AppointmentsList } from '@/components/scheduling/AppointmentsList';
import { BloqueioAgenda } from '@/components/scheduling/BloqueioAgenda';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaList } from '@/components/fila-espera/FilaEsperaList';
import { RelatorioAgenda } from '@/components/scheduling/RelatorioAgenda';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { DoctorsView } from '@/components/dashboard/DoctorsView';
import { DashboardActions } from '@/components/dashboard/DashboardActions';
import { SystemMonitor } from '@/components/system/SystemMonitor';
import { SchedulingErrorBoundary } from '@/components/error/SchedulingErrorBoundary';
import { NavigationHeader } from '@/components/ui/navigation-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { UserApprovalPanel } from '@/components/admin/UserApprovalPanel';
import { ClinicManagementPanel } from '@/components/admin/ClinicManagementPanel';
import { DoctorManagementPanel } from '@/components/admin/DoctorManagementPanel';
import { ServiceManagementPanel } from '@/components/admin/ServiceManagementPanel';
import DoctorScheduleConfigPanel from '@/components/admin/DoctorScheduleConfigPanel';
import { MultiClinicDashboard } from '@/components/admin/MultiClinicDashboard';
import { LLMConfigPanel } from '@/components/admin/LLMConfigPanel';
import { PreparosManagementPanel } from '@/components/admin/PreparosManagementPanel';
import { SubscriptionPlansPanel } from '@/components/admin/SubscriptionPlansPanel';

export interface AppViewsProps {
  // Navigation
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  goBack: () => void;
  goBackToFilaEspera: () => void;

  // Auth
  isAdmin: boolean;
  isClinicAdmin: boolean;

  // Scheduling data
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
  atendimentos: Atendimento[];
  blockedDates: any[];
  emptySlots: any[];

  // View state
  selectedDoctor: Doctor | undefined;
  lastAppointmentDate: string | null;
  selectedAppointmentDate: string | null;
  selectedAppointmentTime: string | undefined;
  editingAppointment: AppointmentWithRelations | null;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  fillLastPatientRef: React.MutableRefObject<(() => void) | null>;

  // Fila de espera
  filaEspera: FilaEsperaWithRelations[];
  filaLoading: boolean;
  filaError: string | null;
  getFilaStatus: () => FilaStatus;

  // Hook utilities
  isDateBlocked: (medicoId: string, date: Date) => boolean;
  getAtendimentosByDoctor: (medicoId: string) => Atendimento[];
  searchPatientsByBirthDate: (date: string) => Promise<any>;
  cancelAppointment: (...args: any[]) => Promise<any>;
  deleteAppointment: (id: string) => Promise<any>;
  confirmAppointment: (id: string) => Promise<any>;
  unconfirmAppointment: (id: string) => Promise<any>;
  adicionarFilaEspera: (...args: any[]) => Promise<boolean>;
  atualizarStatusFila: (id: string, status: string) => Promise<boolean>;
  removerDaFila: (id: string) => Promise<boolean>;
  fetchFilaEspera: (force?: boolean) => Promise<void>;
  refetch: () => void;
  reloadEmptySlots: () => Promise<void>;

  // Event handlers (defined in Index.tsx, close over state)
  handleSimpleAppointmentSubmit: (data: SchedulingFormData) => Promise<void>;
  handleSimpleAppointmentSubmitWithForce: (data: SchedulingFormData) => Promise<void>;
  handleScheduleDoctor: (doctorId: string) => void;
  handleViewSchedule: (doctorId: string) => void;
  handleEditAppointment: (apt: AppointmentWithRelations) => void;
  handleConfirmAppointment: (id: string) => Promise<void>;
  handleUnconfirmAppointment: (id: string) => Promise<void>;
  handleNavigateToAppointment: (apt: AppointmentWithRelations) => void;
  handleNewAppointmentWithTime: (date: string, time: string) => void;
  handleMultipleAppointmentSuccess: (data: { medicoId: string; dataAgendamento: string }) => Promise<void>;
  handleDoctorChange: (doctorId: string) => void;
  handleNewAppointmentFromCalendar: (selectedDate?: string) => void;
  handleConfigureSchedule: () => void;
}

export function AppViews({
  viewMode, setViewMode, goBack, goBackToFilaEspera,
  isAdmin, isClinicAdmin,
  doctors, appointments, atendimentos, blockedDates, emptySlots,
  selectedDoctor, lastAppointmentDate, selectedAppointmentDate, selectedAppointmentTime,
  editingAppointment, searchTerm, setSearchTerm, fillLastPatientRef,
  filaEspera, filaLoading, filaError, getFilaStatus,
  isDateBlocked, getAtendimentosByDoctor, searchPatientsByBirthDate,
  cancelAppointment, deleteAppointment, confirmAppointment, unconfirmAppointment,
  adicionarFilaEspera, atualizarStatusFila, removerDaFila, fetchFilaEspera,
  refetch, reloadEmptySlots,
  handleSimpleAppointmentSubmit, handleSimpleAppointmentSubmitWithForce,
  handleScheduleDoctor, handleViewSchedule, handleEditAppointment,
  handleConfirmAppointment, handleUnconfirmAppointment,
  handleNavigateToAppointment, handleNewAppointmentWithTime,
  handleMultipleAppointmentSuccess, handleDoctorChange,
  handleNewAppointmentFromCalendar, handleConfigureSchedule,
}: AppViewsProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      {viewMode === 'doctors' && (
        <div className="space-y-6">
          {(isAdmin || isClinicAdmin) ? (
            <Tabs defaultValue="usuarios" className="w-full">
              <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-9' : 'grid-cols-6'} max-w-6xl mb-6`}>
                {isAdmin && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
                <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                {isAdmin && <TabsTrigger value="clinicas">Clínicas</TabsTrigger>}
                <TabsTrigger value="medicos">Médicos</TabsTrigger>
                <TabsTrigger value="servicos">Serviços</TabsTrigger>
                <TabsTrigger value="preparos">Preparos</TabsTrigger>
                <TabsTrigger value="horarios">Horários</TabsTrigger>
                <TabsTrigger value="llm-config">LLM API</TabsTrigger>
                {isAdmin && <TabsTrigger value="planos">Planos</TabsTrigger>}
              </TabsList>
              {isAdmin && (
                <TabsContent value="dashboard">
                  <MultiClinicDashboard />
                </TabsContent>
              )}
              <TabsContent value="usuarios">
                <UserApprovalPanel />
              </TabsContent>
              {isAdmin && (
                <TabsContent value="clinicas">
                  <ClinicManagementPanel />
                </TabsContent>
              )}
              <TabsContent value="medicos">
                <DoctorManagementPanel />
              </TabsContent>
              <TabsContent value="servicos">
                <ServiceManagementPanel />
              </TabsContent>
              <TabsContent value="preparos">
                <PreparosManagementPanel />
              </TabsContent>
              <TabsContent value="horarios">
                <DoctorScheduleConfigPanel />
              </TabsContent>
              <TabsContent value="llm-config">
                <LLMConfigPanel />
              </TabsContent>
              {isAdmin && (
                <TabsContent value="planos">
                  <SubscriptionPlansPanel />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <StatsCards doctors={doctors} appointments={appointments} />
                  <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative max-w-md" />
                    <DashboardActions
                      onViewChange={setViewMode}
                      onConfigureSchedule={handleConfigureSchedule}
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
              doctors={doctors}
              onDoctorChange={handleDoctorChange}
              appointments={appointments.filter(apt => apt.medico_id === selectedDoctor.id)}
              blockedDates={blockedDates}
              isDateBlocked={isDateBlocked}
              onCancelAppointment={cancelAppointment}
              onDeleteAppointment={deleteAppointment}
              onConfirmAppointment={handleConfirmAppointment}
              onUnconfirmAppointment={handleUnconfirmAppointment}
              onEditAppointment={handleEditAppointment}
              onNewAppointment={handleNewAppointmentFromCalendar}
              onNewAppointmentWithTime={handleNewAppointmentWithTime}
              initialDate={lastAppointmentDate || undefined}
              atendimentos={atendimentos}
              adicionarFilaEspera={adicionarFilaEspera}
              searchPatientsByBirthDate={searchPatientsByBirthDate}
              emptySlots={emptySlots}
              onSlotsChanged={reloadEmptySlots}
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
              onFillLastPatient={(fn: () => void) => { fillLastPatientRef.current = fn; }}
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
              onFillLastPatient={(fn: () => void) => { fillLastPatientRef.current = fn; }}
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
  );
}
