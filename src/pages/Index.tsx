import { useState } from 'react';
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

import { useSupabaseScheduling } from '@/hooks/useSupabaseScheduling';
import { Doctor, SchedulingFormData, AppointmentWithRelations } from '@/types/scheduling';

type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastAppointmentDate, setLastAppointmentDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);

  const {
    doctors,
    atendimentos,
    appointments,
    loading,
    createAppointment,
    cancelAppointment,
    searchPatientsByBirthDate,
    getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate
  } = useSupabaseScheduling();

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
    console.log('🟦 INICIANDO handleSubmitAppointment no Index.tsx:', formData);
    try {
      console.log('🟦 Chamando createAppointment...');
      await createAppointment(formData);
      console.log('🟦 createAppointment bem-sucedido');
      
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
      console.log('🔴 Erro no agendamento Index.tsx - relançando erro:', error);
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
              </div>
            </div>
            
            {viewMode !== 'doctors' && (
              <Button onClick={handleBack} variant="outline">
                Voltar aos Médicos
              </Button>
            )}
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
              
              <Button 
                onClick={() => setViewMode('appointments-list')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Ver Todos os Agendamentos
              </Button>
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
            onSubmit={handleSubmitAppointment}
            onCancel={handleBack}
            getAtendimentosByDoctor={getAtendimentosByDoctor}
            searchPatientsByBirthDate={searchPatientsByBirthDate}
            editingAppointment={editingAppointment}
          />
        )}
      </div>
    </div>
  );
};

export default Index;