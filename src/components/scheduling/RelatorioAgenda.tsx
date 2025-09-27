import { useState } from 'react';
import { Calendar, Clock, Printer, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
  const [searchDoctor, setSearchDoctor] = useState<string>('');

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
  
  // Filtrar médicos baseado na pesquisa
  const filteredDoctors = doctors.filter(doctor => 
    doctor.nome.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    doctor.especialidade.toLowerCase().includes(searchDoctor.toLowerCase())
  );

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
      <style type="text/css" media="print">{`
        @page {
          margin: 0.1in;
          size: A4;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 6px !important;
          line-height: 1.0 !important;
        }
        .print\\:text-\\[5px\\] { font-size: 5px !important; }
        .print\\:text-\\[6px\\] { font-size: 6px !important; }
        .print\\:text-\\[7px\\] { font-size: 7px !important; }
        .print\\:text-\\[8px\\] { font-size: 8px !important; }
        .print\\:p-0 { padding: 0 !important; }
        .print\\:px-0\\.5 { padding-left: 0.125rem !important; padding-right: 0.125rem !important; }
        .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
        .print\\:py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
        .print\\:mb-0\\.5 { margin-bottom: 0.125rem !important; }
        .print\\:mb-1 { margin-bottom: 0.25rem !important; }
        .print\\:shadow-none { box-shadow: none !important; }
        .print\\:border-none { border: none !important; }
        .print\\:border-gray-400 { border-color: #9ca3af !important; }
        .print\\:border-t { border-top-width: 1px !important; }
        .print\\:hidden { display: none !important; }
        .print\\:line-height-tight { line-height: 1.0 !important; }
        table { page-break-inside: avoid; border-collapse: collapse !important; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        th, td { border: 1px solid #9ca3af !important; }
      `}</style>
      
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Relatório de Agenda Médica
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Gere relatórios personalizados e profissionais da agenda dos médicos
            </p>
          </div>
          <Button onClick={onBack} variant="outline" size="lg" className="shadow-md">
            ← Voltar
          </Button>
        </div>

        <Card className="mb-6 shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              Configurar Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doctor">Médico *</Label>
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Digite o nome do médico ou selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 sticky top-0 bg-background border-b">
                      <Input
                        placeholder="Pesquisar médico..."
                        className="h-8 text-sm"
                        value={searchDoctor}
                        onChange={(e) => setSearchDoctor(e.target.value)}
                      />
                    </div>
                    {filteredDoctors.length > 0 ? (
                      filteredDoctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr. {doctor.nome} - {doctor.especialidade}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Nenhum médico encontrado
                      </div>
                    )}
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
                  step="60" // Intervalos de 1 minuto
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaFim">Horário Fim</Label>
                <Input
                  id="horaFim"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  step="60" // Intervalos de 1 minuto
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleGenerateReport} 
                className="flex items-center gap-2 px-6 py-3 font-medium shadow-md hover:shadow-lg transition-all"
                size="lg"
              >
                <FileText className="h-5 w-5" />
                Gerar Relatório
              </Button>
              {showReport && (
                <Button 
                  onClick={handlePrint} 
                  variant="outline" 
                  className="flex items-center gap-2 px-6 py-3 font-medium shadow-md hover:shadow-lg transition-all"
                  size="lg"
                >
                  <Printer className="h-5 w-5" />
                  Imprimir Relatório
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showReport && (
        <div className="print:shadow-none print:border-none">
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardHeader className="print:py-1 print:mb-2 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20 py-4">
              <div className="text-center space-y-2">
                <h1 className="text-2xl print:text-sm font-bold text-primary">Relatório de Agenda Médica</h1>
                
                <div className="flex items-center justify-center gap-4 text-sm print:text-xs">
                  <div className="font-semibold">
                    Dr. {selectedDoctor?.nome} - {selectedDoctor?.especialidade}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDate(dataInicio)} a {formatDate(dataFim)}
                  </div>
                  {(horaInicio !== '00:00' || horaFim !== '23:59') && (
                    <div className="text-muted-foreground">
                      {formatTime(horaInicio)}h - {formatTime(horaFim)}h
                    </div>
                  )}
                </div>
                
                <div className="text-xs print:text-xs text-muted-foreground">
                  Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="print:p-1 p-6">
              {filteredAppointments.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-center mb-3 print:mb-1">
                    <Badge variant="secondary" className="text-sm print:text-[8px] px-3 py-1 print:px-1 print:py-0">
                      {filteredAppointments.length} agendamento{filteredAppointments.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  <div className="border rounded-lg print:border-gray-400 print:border-t">
                    <Table>
                      <TableHeader className="print:text-[6px]">
                        <TableRow className="print:border-gray-400">
                          <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px] w-16">Hora</TableHead>
                          <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px]">Paciente / Observações</TableHead>
                          <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px] w-24">Telefone</TableHead>
                          <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px] w-32">Convênio / Procedimento</TableHead>
                          <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px] w-16">Status</TableHead>
                          {dataInicio !== dataFim && (
                            <TableHead className="print:py-0.5 print:px-0.5 print:text-[6px] w-20">Data</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="print:text-[6px] print:line-height-tight">
                        {filteredAppointments.map((appointment, index) => (
                          <TableRow key={appointment.id} className="print:border-gray-400 hover:bg-muted/50">
                            <TableCell className="print:py-0 print:px-0.5 print:text-[6px] font-medium">
                              {formatTime(appointment.hora_agendamento)}
                            </TableCell>
                            <TableCell className="print:py-0 print:px-0.5 print:text-[6px]">
                              <div className="font-medium print:text-[6px]">{appointment.pacientes?.nome_completo}</div>
                              {appointment.observacoes && (
                                <div className="text-xs print:text-[5px] text-muted-foreground mt-0.5 print:mt-0 print:line-height-tight">
                                  {appointment.observacoes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="print:py-0 print:px-0.5 print:text-[6px]">
                              {appointment.pacientes?.celular || appointment.pacientes?.telefone || '-'}
                            </TableCell>
                            <TableCell className="print:py-0 print:px-0.5 print:text-[6px]">
                              <div className="print:text-[6px]">{appointment.pacientes?.convenio}</div>
                              <div className="text-xs print:text-[5px] text-muted-foreground print:line-height-tight">
                                {appointment.atendimentos?.nome}
                              </div>
                            </TableCell>
                            <TableCell className="print:py-0 print:px-0.5 print:text-[6px]">
                              <span className="text-xs print:text-[5px]">
                                {appointment.status === 'confirmado' ? 'Conf.' : 'Agend.'}
                              </span>
                            </TableCell>
                            {dataInicio !== dataFim && (
                              <TableCell className="print:py-0 print:px-0.5 print:text-[6px]">
                                {formatDate(appointment.data_agendamento)}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 print:py-2 text-muted-foreground">
                  <FileText className="h-12 w-12 print:h-6 print:w-6 mx-auto mb-4 print:mb-1 opacity-50" />
                  <h3 className="text-lg print:text-[10px] font-medium mb-2 print:mb-1">Nenhum agendamento encontrado</h3>
                  <p className="text-sm print:text-[8px]">Verifique os filtros selecionados e tente novamente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}