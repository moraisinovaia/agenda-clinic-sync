import { useState } from 'react';
import { Calendar, Clock, Printer, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioAgendaProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
  onBack: () => void;
}

export function RelatorioAgenda({ doctors, appointments, onBack }: RelatorioAgendaProps) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [horaInicio, setHoraInicio] = useState<string>('00:00');
  const [horaFim, setHoraFim] = useState<string>('23:59');
  const [showReport, setShowReport] = useState(false);

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  const filteredAppointments = appointments.filter(appointment => {
    if (!selectedDoctorId || appointment.medico_id !== selectedDoctorId) return false;
    if (!dataInicio || !dataFim) return false;
    
    const appointmentDate = appointment.data_agendamento;
    const appointmentTime = appointment.hora_agendamento;
    
    // Filtrar por data
    if (appointmentDate < dataInicio || appointmentDate > dataFim) return false;
    
    // Filtrar por horário
    if (appointmentTime < horaInicio || appointmentTime > horaFim) return false;
    
    // Mostrar apenas agendados e confirmados (não cancelados)
    return appointment.status === 'agendado' || appointment.status === 'confirmado';
  }).sort((a, b) => {
    // Ordenar por data e depois por horário
    const dateCompare = a.data_agendamento.localeCompare(b.data_agendamento);
    if (dateCompare !== 0) return dateCompare;
    return a.hora_agendamento.localeCompare(b.hora_agendamento);
  });

  const handleGenerateReport = () => {
    if (!selectedDoctorId || !dataInicio || !dataFim) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    setShowReport(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800';
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // Remove segundos se houver
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Relatório de Agenda Médica</h2>
            <p className="text-muted-foreground mt-1">
              Gere relatórios personalizados da agenda dos médicos
            </p>
          </div>
          <Button onClick={onBack} variant="outline">
            Voltar
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Filtros do Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doctor">Médico *</Label>
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.nome} - {doctor.especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início *</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim *</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaInicio">Horário Início</Label>
                <Input
                  id="horaInicio"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaFim">Horário Fim</Label>
                <Input
                  id="horaFim"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerateReport} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Gerar Relatório
              </Button>
              {showReport && (
                <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showReport && (
        <div className="print:shadow-none print:border-none">
          <Card>
            <CardHeader className="print:pb-4">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Relatório de Agenda Médica</h1>
                <div className="text-lg font-medium">
                  Dr. {selectedDoctor?.nome} - {selectedDoctor?.especialidade}
                </div>
                <div className="text-sm text-muted-foreground">
                  Período: {formatDate(dataInicio)} a {formatDate(dataFim)}
                  {(horaInicio !== '00:00' || horaFim !== '23:59') && (
                    <span> | Horário: {formatTime(horaInicio)} às {formatTime(horaFim)}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Relatório gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium mb-4">
                    Total de agendamentos: {filteredAppointments.length}
                  </div>
                  
                  <div className="space-y-3">
                    {filteredAppointments.map((appointment, index) => (
                      <div key={appointment.id} className="border rounded-lg p-4 print:border-gray-300">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">#{index + 1}</span>
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-medium">{formatDate(appointment.data_agendamento)}</span>
                            <Clock className="h-4 w-4 text-primary ml-2" />
                            <span className="font-medium">{formatTime(appointment.hora_agendamento)}</span>
                          </div>
                          <Badge className={getStatusColor(appointment.status)}>
                            {appointment.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <strong>Paciente:</strong> {appointment.pacientes?.nome_completo}
                          </div>
                          <div>
                            <strong>Convênio:</strong> {appointment.pacientes?.convenio}
                          </div>
                          <div>
                            <strong>Contato:</strong> {appointment.pacientes?.celular || appointment.pacientes?.telefone || '-'}
                          </div>
                          <div>
                            <strong>Procedimento:</strong> {appointment.atendimentos?.nome}
                          </div>
                        </div>
                        
                        {appointment.observacoes && (
                          <div className="mt-2 text-sm">
                            <strong>Observações:</strong> {appointment.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum agendamento encontrado para os filtros selecionados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}