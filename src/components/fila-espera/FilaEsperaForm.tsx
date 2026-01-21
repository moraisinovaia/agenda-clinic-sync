import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateOfBirthInput } from '@/components/ui/date-of-birth-input';
import { CalendarIcon, Clock, User, UserCheck, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FilaEsperaFormData } from '@/types/fila-espera';
import { Doctor, Atendimento } from '@/types/scheduling';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedPatientSearch } from '@/hooks/useUnifiedPatientSearch';
import { formatPhone, isValidPhone } from '@/utils/phoneFormatter';

interface FilaEsperaFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSubmit: (data: FilaEsperaFormData) => Promise<boolean>;
  onCancel: () => void;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
}

export function FilaEsperaForm({
  doctors,
  atendimentos,
  onSubmit,
  onCancel,
  searchPatientsByBirthDate
}: FilaEsperaFormProps) {
  const [formData, setFormData] = useState<FilaEsperaFormData>({
    pacienteId: '',
    medicoId: '',
    atendimentoId: '',
    dataPreferida: '',
    periodoPreferido: 'qualquer',
    observacoes: '',
    prioridade: 1,
    dataLimite: '',
  });

  const [pacienteData, setPacienteData] = useState({
    nomeCompleto: '',
    dataNascimento: '',
    celular: '',
    convenio: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedLimitDate, setSelectedLimitDate] = useState<Date>();
  const [showCreateNew, setShowCreateNew] = useState(false);
  const { toast } = useToast();

  // Hook unificado para busca de pacientes
  const {
    loading: searchingPatients,
    foundPatients,
    showResults,
    selectPatient: selectSearchedPatient,
    searchByBirthDate,
    searchByName,
    hideResults
  } = useUnifiedPatientSearch();

  const selectedDoctor = doctors.find(d => d.id === formData.medicoId);
  const doctorAtendimentos = atendimentos.filter(a => a.medico_id === formData.medicoId);

  // Buscar automaticamente quando dados mudarem
  useEffect(() => {
    if (pacienteData.dataNascimento) {
      searchByBirthDate(pacienteData.dataNascimento);
    }
  }, [pacienteData.dataNascimento, searchByBirthDate]);

  useEffect(() => {
    const hasValidBirthDate = pacienteData.dataNascimento && pacienteData.dataNascimento.length === 10;
    if (!hasValidBirthDate && pacienteData.nomeCompleto) {
      searchByName(pacienteData.nomeCompleto);
    }
  }, [pacienteData.nomeCompleto, pacienteData.dataNascimento, searchByName]);

  const selectPatient = (patient: any) => {
    setPacienteData({
      nomeCompleto: patient.nome_completo || '',
      dataNascimento: patient.data_nascimento || '',
      celular: patient.celular || '',
      convenio: patient.convenio || '',
    });
    setFormData(prev => ({ ...prev, pacienteId: patient.id }));
    selectSearchedPatient(patient);
    setShowCreateNew(false);
  };

  const handleCreateNewPatient = async () => {
    if (!pacienteData.nomeCompleto || !pacienteData.dataNascimento || !pacienteData.convenio) {
      toast({
        title: 'Dados incompletos',
        description: 'Nome, data de nascimento e convênio são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pacientes')
        .insert({
          nome_completo: pacienteData.nomeCompleto.toUpperCase().trim(),
          data_nascimento: pacienteData.dataNascimento,
          convenio: pacienteData.convenio.toUpperCase().trim(),
          celular: pacienteData.celular,
          cliente_id: '00000000-0000-0000-0000-000000000000', // Usar ID padrão temporário
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setFormData(prev => ({ ...prev, pacienteId: data.id }));
        setShowCreateNew(false);
        toast({
          title: 'Paciente criado',
          description: 'Novo paciente cadastrado com sucesso.',
        });
      }
    } catch (error) {
      console.error('Erro ao criar paciente:', error);
      toast({
        title: 'Erro ao criar paciente',
        description: 'Erro ao cadastrar novo paciente. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pacienteId || !formData.medicoId || !formData.atendimentoId || !formData.dataPreferida) {
      return;
    }

    setSubmitting(true);
    try {
      const success = await onSubmit(formData);
      if (success) {
        onCancel();
      }
    } catch (error) {
      console.error('Erro ao adicionar à fila:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Adicionar à Fila de Espera
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Paciente */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Paciente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="relative">
                    <DateOfBirthInput
                      value={pacienteData.dataNascimento}
                      onChange={(value) => setPacienteData(prev => ({ ...prev, dataNascimento: value }))}
                      label="Data de Nascimento"
                    />
                    {searchingPatients && (
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {searchingPatients ? 'Buscando pacientes...' : 'Ao inserir a data ou nome, buscaremos pacientes automaticamente'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomeCompleto">Nome Completo</Label>
                  <Input
                    id="nomeCompleto"
                    value={pacienteData.nomeCompleto}
                    onChange={(e) => setPacienteData(prev => ({ ...prev, nomeCompleto: e.target.value }))}
                    placeholder="Digite o nome para buscar ou criar novo paciente"
                  />
                </div>

                {/* Lista de pacientes encontrados */}
                {showResults && (
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      <Label className="text-green-700 font-medium">
                        {foundPatients.length === 1 
                          ? 'Paciente encontrado!' 
                          : `${foundPatients.length} pacientes encontrados`
                        }
                      </Label>
                    </div>
                    <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
                      {foundPatients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => selectPatient(patient)}
                          className="w-full text-left p-2 hover:bg-muted rounded text-sm border border-transparent hover:border-primary/20"
                        >
                          <div className="font-medium">{patient.nome_completo?.toUpperCase()}</div>
                           <div className="text-muted-foreground">
                             {patient.data_nascimento} • {patient.ultimo_convenio || 'Convênio não informado'}
                             {patient.celular && ` • ${patient.celular}`}
                           </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        hideResults();
                        setShowCreateNew(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Criar novo paciente com estes dados
                    </Button>
                  </div>
                )}

                {/* Botão para criar novo paciente */}
                {showCreateNew && pacienteData.nomeCompleto && (
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      onClick={handleCreateNewPatient}
                      variant="outline"
                      className="w-full"
                    >
                      Criar novo paciente: {pacienteData.nomeCompleto}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="celular">Celular *</Label>
                  <Input
                    id="celular"
                    value={pacienteData.celular}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setPacienteData(prev => ({ ...prev, celular: formatted }));
                    }}
                    placeholder="(XX) XXXXX-XXXX"
                    maxLength={15}
                    className={pacienteData.celular && !isValidPhone(pacienteData.celular) ? 'border-red-500' : ''}
                  />
                  {pacienteData.celular && !isValidPhone(pacienteData.celular) && (
                    <p className="text-xs text-red-500">Formato de celular inválido. Use o formato (XX) XXXXX-XXXX</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="convenio">Convênio</Label>
                  <Input
                    id="convenio"
                    value={pacienteData.convenio}
                    onChange={(e) => setPacienteData(prev => ({ ...prev, convenio: e.target.value }))}
                    placeholder="Nome do convênio"
                  />
                </div>
              </div>
            </div>

            {/* Preferências de Agendamento */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Preferências de Agendamento</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medico">Médico</Label>
                  <Select onValueChange={(value) => setFormData(prev => ({ ...prev, medicoId: value, atendimentoId: '' }))}>
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
                  <Label htmlFor="atendimento">Tipo de Atendimento</Label>
                  <Select 
                    disabled={!formData.medicoId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, atendimentoId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o atendimento" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctorAtendimentos.map((atendimento) => (
                        <SelectItem key={atendimento.id} value={atendimento.id}>
                          {atendimento.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Preferida</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          if (date) {
                            setFormData(prev => ({ ...prev, dataPreferida: format(date, 'yyyy-MM-dd') }));
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        locale={ptBR}
                        className="rounded-md border shadow-sm bg-background p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodo">Período Preferido</Label>
                  <Select 
                    value={formData.periodoPreferido}
                    onValueChange={(value: 'manha' | 'tarde' | 'qualquer') => 
                      setFormData(prev => ({ ...prev, periodoPreferido: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manha">Manhã</SelectItem>
                      <SelectItem value="tarde">Tarde</SelectItem>
                      <SelectItem value="qualquer">Qualquer horário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prioridade">Prioridade (1-5)</Label>
                  <Select 
                    value={formData.prioridade.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, prioridade: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Baixa</SelectItem>
                      <SelectItem value="2">2 - Normal</SelectItem>
                      <SelectItem value="3">3 - Média</SelectItem>
                      <SelectItem value="4">4 - Alta</SelectItem>
                      <SelectItem value="5">5 - Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Limite (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedLimitDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedLimitDate ? (
                          format(selectedLimitDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        ) : (
                          <span>Até quando aceita?</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedLimitDate}
                        onSelect={(date) => {
                          setSelectedLimitDate(date);
                          setFormData(prev => ({ 
                            ...prev, 
                            dataLimite: date ? format(date, 'yyyy-MM-dd') : '' 
                          }));
                        }}
                        disabled={(date) => date < new Date()}
                        locale={ptBR}
                        className="rounded-md border shadow-sm bg-background p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações adicionais sobre a preferência do paciente..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={submitting || !formData.pacienteId || !formData.medicoId || !formData.dataPreferida}
                className="flex-1"
              >
                {submitting ? 'Adicionando...' : 'Adicionar à Fila'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}