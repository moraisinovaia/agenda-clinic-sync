import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, Phone } from 'lucide-react';
import { Doctor, Atendimento, SchedulingFormData } from '@/types/scheduling';

interface SchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSubmit: (data: SchedulingFormData) => Promise<void>;
  onCancel: () => void;
  getAtendimentosByDoctor: (doctorId: string) => Atendimento[];
}

export function SchedulingForm({ 
  doctors, 
  atendimentos, 
  onSubmit, 
  onCancel,
  getAtendimentosByDoctor 
}: SchedulingFormProps) {
  const [formData, setFormData] = useState<SchedulingFormData>({
    nomeCompleto: '',
    dataNascimento: '',
    convenio: '',
    telefone: '',
    medicoId: '',
    atendimentoId: '',
    dataAgendamento: '',
    horaAgendamento: '',
    observacoes: '',
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        nomeCompleto: '',
        dataNascimento: '',
        convenio: '',
        telefone: '',
        medicoId: '',
        atendimentoId: '',
        dataAgendamento: '',
        horaAgendamento: '',
        observacoes: '',
      });
    } catch (error) {
      console.error('Erro ao agendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableAtendimentos = formData.medicoId ? getAtendimentosByDoctor(formData.medicoId) : [];
  const selectedDoctor = doctors.find(doctor => doctor.id === formData.medicoId);
  const availableConvenios = selectedDoctor?.convenios_aceitos || [];
  
  console.log('Selected doctor:', selectedDoctor);
  console.log('Available convenios:', availableConvenios);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados do Paciente */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Paciente
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                <Input
                  id="nomeCompleto"
                  value={formData.nomeCompleto}
                  onChange={(e) => setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }))}
                  placeholder="Nome completo do paciente"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
                  required
                />
              </div>
              
               <div>
                 <Label htmlFor="convenio">Convênio *</Label>
                 <Select 
                   value={formData.convenio} 
                   onValueChange={(value) => setFormData(prev => ({ ...prev, convenio: value }))}
                   disabled={!formData.medicoId}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o convênio" />
                   </SelectTrigger>
                   <SelectContent>
                     {availableConvenios.map((convenio) => (
                       <SelectItem key={convenio} value={convenio}>
                         {convenio}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
              
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(xx) xxxxx-xxxx"
                  required
                />
              </div>
            </div>
          </div>

          {/* Dados do Agendamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Dados do Agendamento
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="medico">Médico *</Label>
                <Select 
                  value={formData.medicoId} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    medicoId: value,
                    atendimentoId: '', // Reset atendimento when doctor changes
                    convenio: '' // Reset convenio when doctor changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o médico" />
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

              <div>
                <Label htmlFor="atendimento">Tipo de Atendimento *</Label>
                <Select 
                  value={formData.atendimentoId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, atendimentoId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="retorno">Retorno</SelectItem>
                    <SelectItem value="exame">Exame</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="dataAgendamento">Data *</Label>
                <Input
                  id="dataAgendamento"
                  type="date"
                  value={formData.dataAgendamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataAgendamento: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="horaAgendamento">Horário *</Label>
                <Input
                  id="horaAgendamento"
                  type="time"
                  value={formData.horaAgendamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, horaAgendamento: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Informações adicionais sobre o agendamento"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Agendando...' : 'Confirmar Agendamento'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}