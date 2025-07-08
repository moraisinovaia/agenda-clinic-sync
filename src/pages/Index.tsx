import { useState } from 'react';
import { Search, Calendar, Users, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { DoctorCard } from '@/components/scheduling/DoctorCard';
import { SchedulingForm } from '@/components/scheduling/SchedulingForm';
import { DoctorSchedule } from '@/components/scheduling/DoctorSchedule';

import { doctors } from '@/data/doctors';
import { useScheduling } from '@/hooks/useScheduling';
import { Doctor, Appointment } from '@/types/scheduling';

type ViewMode = 'doctors' | 'schedule' | 'new-appointment';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();

  const { 
    appointments, 
    addAppointment, 
    getAppointmentsForDoctor, 
    generateTimeSlots 
  } = useScheduling();

  const filteredDoctors = doctors.filter(doctor => 
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase())
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
      setViewMode('schedule');
    }
  };

  const handleSubmitAppointment = (appointment: Omit<Appointment, 'id'>) => {
    addAppointment(appointment);
    setViewMode('schedule');
    setSelectedDate(undefined);
    setSelectedTime(undefined);
  };

  const handleNewAppointment = () => {
    setViewMode('new-appointment');
    setSelectedDate(undefined);
    setSelectedTime(undefined);
  };

  const handleBack = () => {
    setViewMode('doctors');
    setSelectedDoctor(null);
    setSelectedDate(undefined);
    setSelectedTime(undefined);
  };

  const availableSlots = selectedDoctor && selectedDate 
    ? generateTimeSlots(selectedDoctor, selectedDate)
    : [];

  const totalAppointments = appointments.length;
  const todayAppointments = appointments.filter(apt => 
    apt.date === new Date().toISOString().split('T')[0]
  ).length;
  const pendingAppointments = appointments.filter(apt => 
    apt.status === 'scheduled'
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Sistema de Agendamentos Médicos
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie consultas e exames para 20 especialistas
              </p>
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
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar médico ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Doctors Grid */}
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

            {filteredDoctors.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum médico encontrado com o termo "{searchTerm}"
                </p>
              </Card>
            )}
          </>
        )}

        {viewMode === 'schedule' && selectedDoctor && (
          <DoctorSchedule
            doctor={selectedDoctor}
            appointments={getAppointmentsForDoctor(selectedDoctor.id)}
            onNewAppointment={handleNewAppointment}
          />
        )}

        {viewMode === 'new-appointment' && selectedDoctor && (
          <SchedulingForm
            doctor={selectedDoctor}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            availableSlots={availableSlots}
            selectedTime={selectedTime}
            onTimeSelect={setSelectedTime}
            onSubmit={handleSubmitAppointment}
            onCancel={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default Index;