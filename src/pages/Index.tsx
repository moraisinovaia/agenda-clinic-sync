import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Search, Calendar, Users, Clock } from 'lucide-react';
import endogastroLogo from '@/assets/endogastro-logo.png';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { DoctorCard } from '@/components/scheduling/DoctorCard';
import { SchedulingForm } from '@/components/scheduling/SchedulingForm';
import { DoctorSchedule } from '@/components/scheduling/DoctorSchedule';
import { AppointmentsList } from '@/components/scheduling/AppointmentsList';
import { BloqueioAgenda } from '@/components/scheduling/BloqueioAgenda';
import { PreparosView } from '@/components/preparos/PreparosView';
import { FilaEsperaForm } from '@/components/fila-espera/FilaEsperaForm';
import { FilaEsperaList } from '@/components/fila-espera/FilaEsperaList';
import { InstallButton } from '@/components/InstallButton';
import { TestLogin } from '@/components/TestLogin';

import { useSupabaseScheduling } from '@/hooks/useSupabaseScheduling';
import { useFilaEspera } from '@/hooks/useFilaEspera';
import { Doctor, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';
import { FilaEsperaFormData } from '@/types/fila-espera';

type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'preparos' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda';

const Index = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastAppointmentDate, setLastAppointmentDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);

  const {
    doctors,
    atendimentos,
    appointments,
    blockedDates,
    loading,
    createAppointment,
    cancelAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate,
    isDateBlocked,
    getBlockedDatesByDoctor
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

  const filteredDoctors = doctors.filter(doctor => 
    doctor.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.especialidade.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      setLastAppointmentDate(null); // Limpar data do último agendamento
      setViewMode('schedule');
    }
  };

  const handleSubmitAppointment = async (formData: SchedulingFormData) => {
    try {
      await createAppointment(formData);
      
      // Só redirecionar para a agenda do médico se o agendamento foi bem-sucedido
      const doctor = doctors.find(d => d.id === formData.medicoId);
      if (doctor) {
        setSelectedDoctor(doctor);
        setLastAppointmentDate(formData.dataAgendamento); // Guardar a data do agendamento
        setViewMode('schedule');
      }
    } catch (error) {
      // Se há erro, não fazer nada - os dados permanecem no formulário
      // O erro já foi tratado no useSupabaseScheduling
      throw error; // Relançar o erro para que o useSchedulingForm não chame resetForm()
    }
  };

  const handleNewAppointment = () => {
    setViewMode('new-appointment');
  };

  const handleBack = () => {
    setViewMode('doctors');
    setSelectedDoctor(null);
    setLastAppointmentDate(null); // Limpar data do último agendamento
    setEditingAppointment(null); // Limpar agendamento sendo editado
  };

  const handleBackToFilaEspera = () => {
    setViewMode('fila-espera');
  };

  const handleEditAppointment = (appointment: AppointmentWithRelations) => {
    const doctor = doctors.find(d => d.id === appointment.medico_id);
    if (doctor) {
      setSelectedDoctor(doctor);
      setEditingAppointment(appointment);
      setViewMode('edit-appointment');
    }
  };

  const totalAppointments = appointments.length;
  const todayAppointments = appointments.filter(apt => 
    apt.data_agendamento === new Date().toISOString().split('T')[0]
  ).length;
  const pendingAppointments = appointments.filter(apt => 
    apt.status === 'agendado'
  ).length;

  // Verificar autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Redirecionar para login se não estiver autenticado
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados da clínica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={endogastroLogo} 
                alt="Endogastro Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Endogastro
                </h1>
                <p className="text-muted-foreground mt-1">
                  Sistema de Agendamentos Médicos
                </p>
                {profile && (
                  <p className="text-sm text-primary font-medium">
                    Recepcionista: {profile.nome}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {viewMode !== 'doctors' && (
                <Button 
                  onClick={viewMode === 'nova-fila' ? handleBackToFilaEspera : handleBack} 
                  variant="outline"
                >
                  {viewMode === 'nova-fila' ? 'Voltar à Fila de Espera' : 'Voltar aos Médicos'}
                </Button>
              )}
              
              <InstallButton />
              
              <Button 
                onClick={signOut} 
                variant="outline"
                size="sm"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {viewMode === 'doctors' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{doctors.length}</p>
                      <p className="text-sm text-muted-foreground">Médicos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{totalAppointments}</p>
                      <p className="text-sm text-muted-foreground">Total Agendamentos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{todayAppointments}</p>
                      <p className="text-sm text-muted-foreground">Hoje</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center">
                      {pendingAppointments}
                    </Badge>
                    <div>
                      <p className="text-2xl font-bold">{pendingAppointments}</p>
                      <p className="text-sm text-muted-foreground">Agendados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar médico ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setViewMode('appointments-list')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Ver Todos os Agendamentos
                </Button>
                
                <Button 
                  onClick={() => setViewMode('preparos')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  📋 Preparos de Exames
                </Button>
                
                <Button 
                  onClick={() => setViewMode('fila-espera')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Fila de Espera
                </Button>
                
                <Button 
                  onClick={() => setViewMode('bloqueio-agenda')}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  🚫 Bloquear Agenda
                </Button>
              </div>
            </div>

            {/* Doctors Grid */}
            {filteredDoctors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDoctors.map((doctor) => (
                  <div key={doctor.id} className="space-y-2">
                    <DoctorCard
                      doctor={doctor}
                      onSchedule={handleScheduleDoctor}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSchedule(doctor.id)}
                      className="w-full"
                    >
                      Ver Agenda
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchTerm ? 
                    `Nenhum médico encontrado com o termo "${searchTerm}"` : 
                    'Nenhum médico encontrado. Verifique se existem médicos ativos no sistema.'
                  }
                </p>
              </Card>
            )}
          </>
        )}

        {viewMode === 'schedule' && selectedDoctor && (
          <DoctorSchedule
            doctor={selectedDoctor}
            appointments={appointments.filter(apt => apt.medico_id === selectedDoctor.id)}
            blockedDates={blockedDates}
            isDateBlocked={isDateBlocked}
            onCancelAppointment={cancelAppointment}
            onEditAppointment={handleEditAppointment}
            onNewAppointment={() => setViewMode('new-appointment')}
            initialDate={lastAppointmentDate || undefined}
          />
        )}

        {viewMode === 'new-appointment' && (
          <SchedulingForm
            doctors={doctors}
            atendimentos={atendimentos}
            appointments={appointments}
            blockedDates={blockedDates}
            isDateBlocked={isDateBlocked}
            onSubmit={handleSubmitAppointment}
            onCancel={handleBack}
            getAtendimentosByDoctor={getAtendimentosByDoctor}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        )}

        {viewMode === 'appointments-list' && (
          <AppointmentsList 
            appointments={appointments} 
            onEditAppointment={handleEditAppointment}
            onCancelAppointment={cancelAppointment}
          />
        )}

        {viewMode === 'edit-appointment' && editingAppointment && (
          <SchedulingForm
            doctors={doctors}
            atendimentos={atendimentos}
            appointments={appointments}
            blockedDates={blockedDates}
            isDateBlocked={isDateBlocked}
            onSubmit={handleSubmitAppointment}
            onCancel={handleBack}
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
            onCancel={handleBackToFilaEspera}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
          />
        )}

        {viewMode === 'bloqueio-agenda' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Bloqueio de Agenda Médica</h2>
                <p className="text-muted-foreground mt-1">
                  Bloqueie a agenda de um médico e notifique automaticamente os pacientes
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <BloqueioAgenda />
            </div>
          </div>
        )}
        
        <TestLogin />
      </div>
    </div>
  );
};

export default Index;