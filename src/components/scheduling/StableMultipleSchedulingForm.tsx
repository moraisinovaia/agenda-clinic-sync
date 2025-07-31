import { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, ArrowLeft } from 'lucide-react';
import { Doctor, Atendimento } from '@/types/scheduling';
import { MultipleSchedulingFormData } from '@/types/multiple-scheduling';
import { PatientDataFormMultiple } from './PatientDataFormMultiple';
import { MultipleAppointmentDataForm } from './MultipleAppointmentDataForm';
import { useMultipleScheduling } from '@/hooks/useMultipleScheduling';

interface StableMultipleSchedulingFormProps {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  onSuccess: () => void;
  onCancel: () => void;
  searchPatientsByBirthDate: (birthDate: string) => Promise<any[]>;
}

const initialFormData: MultipleSchedulingFormData = {
  nomeCompleto: '',
  dataNascimento: '',
  convenio: '',
  telefone: '',
  celular: '',
  medicoId: '',
  atendimentoIds: [],
  dataAgendamento: '',
  horaAgendamento: '',
  observacoes: '',
};

export function StableMultipleSchedulingForm({
  doctors,
  atendimentos,
  onSuccess,
  onCancel,
  searchPatientsByBirthDate
}: StableMultipleSchedulingFormProps) {
  const [formData, setFormData] = useState<MultipleSchedulingFormData>(initialFormData);
  const { loading, createMultipleAppointment } = useMultipleScheduling();

  // ✅ CORREÇÃO DEFINITIVA: Estados de busca de pacientes movidos para o componente pai
  const [foundPatients, setFoundPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientsList, setShowPatientsList] = useState(false);
  
  // Cache e controle de busca
  const lastSearchDateRef = useRef<string>('');
  const cacheResultsRef = useRef<{ [key: string]: any[] }>({});

  // Calcular valores derivados de forma estável
  const selectedDoctor = useMemo(() => 
    doctors.find(doctor => doctor.id === formData.medicoId), 
    [doctors, formData.medicoId]
  );
  
  const availableConvenios = useMemo(() => 
    selectedDoctor?.convenios_aceitos || [], 
    [selectedDoctor]
  );
  
  const medicoSelected = useMemo(() => 
    !!formData.medicoId, 
    [formData.medicoId]
  );
  
  const selectedAtendimentos = useMemo(() => 
    atendimentos.filter(a => formData.atendimentoIds.includes(a.id)),
    [atendimentos, formData.atendimentoIds]
  );

  // ✅ CORREÇÃO DEFINITIVA: Função de busca de pacientes estabilizada
  const handleSearchPatients = useCallback(async (birthDate: string) => {
    // Evitar busca duplicada
    if (lastSearchDateRef.current === birthDate) {
      return;
    }
    
    if (birthDate && birthDate.length === 10) {
      // Verificar cache primeiro
      if (cacheResultsRef.current[birthDate]) {
        console.log('📦 Usando resultado do cache para:', birthDate);
        setFoundPatients(cacheResultsRef.current[birthDate]);
        setShowPatientsList(cacheResultsRef.current[birthDate].length > 0);
        lastSearchDateRef.current = birthDate;
        return;
      }
      
      setSearchingPatients(true);
      try {
        console.log('🔍 Buscando pacientes para data:', birthDate);
        const patients = await searchPatientsByBirthDate(birthDate);
        
        // Armazenar no cache
        cacheResultsRef.current[birthDate] = patients;
        
        setFoundPatients(patients);
        setShowPatientsList(patients.length > 0);
        lastSearchDateRef.current = birthDate;
        console.log('✅ Busca concluída:', patients.length, 'pacientes encontrados');
      } catch (error) {
        console.error('❌ Erro ao buscar pacientes:', error);
        setFoundPatients([]);
        setShowPatientsList(false);
      } finally {
        setSearchingPatients(false);
      }
    } else {
      console.log('🧹 Limpando resultados - data incompleta');
      setFoundPatients([]);
      setShowPatientsList(false);
      lastSearchDateRef.current = '';
    }
  }, [searchPatientsByBirthDate]);

  // ✅ CORREÇÃO DEFINITIVA: Funções para controle da lista de pacientes
  const handleSelectPatient = useCallback((patient: any) => {
    console.log('👤 Selecionando paciente:', patient);
    setFormData(prev => ({
      ...prev,
      nomeCompleto: patient.nome_completo || '',
      convenio: patient.convenio || '',
      telefone: patient.telefone || '',
      celular: patient.celular || '',
    }));
    setShowPatientsList(false);
  }, []);

  const handleCreateNewPatient = useCallback(() => {
    console.log('➕ Criando novo paciente');
    setFormData(prev => ({
      ...prev,
      nomeCompleto: '',
      convenio: '',
      telefone: '',
      celular: '',
    }));
    setShowPatientsList(false);
  }, []);

  // Handler de submit estabilizado - PRESERVA DADOS EM CASO DE ERRO
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Submit do formulário múltiplo:', formData);
    
    if (formData.atendimentoIds.length === 0) {
      console.error('❌ Nenhum atendimento selecionado no submit');
      alert('Selecione pelo menos um exame/procedimento');
      return; // NÃO limpar dados
    }

    console.log('✅ Validação básica OK, iniciando criação...');

    try {
      await createMultipleAppointment(formData);
      onSuccess(); // Só chamar em caso de sucesso
    } catch (error) {
      // Em caso de erro, PRESERVAR todos os dados do formulário
      console.error('Erro no formulário múltiplo:', error);
      // NÃO chamar onSuccess() - mantém o formulário com os dados
    }
  }, [formData, createMultipleAppointment, onSuccess]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Agendamento Múltiplo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Agende múltiplos exames para o mesmo paciente em uma única sessão
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Paciente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Paciente</CardTitle>
              </CardHeader>
              <CardContent>
                <PatientDataFormMultiple
                  formData={formData}
                  setFormData={setFormData}
                  availableConvenios={availableConvenios}
                  medicoSelected={medicoSelected}
                  selectedDoctor={selectedDoctor}
                  // ✅ CORREÇÃO DEFINITIVA: Estados e funções vindos do componente pai
                  foundPatients={foundPatients}
                  searchingPatients={searchingPatients}
                  showPatientsList={showPatientsList}
                  onSearchPatients={handleSearchPatients}
                  onSelectPatient={handleSelectPatient}
                  onCreateNewPatient={handleCreateNewPatient}
                />
              </CardContent>
            </Card>

            {/* Dados do Agendamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Agendamento</CardTitle>
              </CardHeader>
              <CardContent>
                <MultipleAppointmentDataForm
                  formData={formData}
                  setFormData={setFormData}
                  doctors={doctors}
                  atendimentos={atendimentos}
                />
              </CardContent>
            </Card>

            {/* Preview dos Agendamentos */}
            {selectedAtendimentos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Paciente:</span> {formData.nomeCompleto || 'Não informado'}
                    </div>
                    <div>
                      <span className="font-medium">Médico:</span> {selectedDoctor?.nome || 'Não selecionado'}
                    </div>
                    <div>
                      <span className="font-medium">Data:</span> {formData.dataAgendamento || 'Não informada'}
                    </div>
                    <div>
                      <span className="font-medium">Horário:</span> {formData.horaAgendamento || 'Não informado'}
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-sm">Exames/Procedimentos:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAtendimentos.map((atendimento) => (
                        <Badge key={atendimento.id} variant="secondary">
                          {atendimento.nome}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {formData.observacoes && (
                    <div>
                      <span className="font-medium text-sm">Observações:</span>
                      <p className="text-sm text-muted-foreground mt-1">{formData.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || formData.atendimentoIds.length === 0} 
                className="flex-1"
                onClick={() => console.log('🚀 BOTÃO CLICADO! FormData atual:', formData)}
              >
                {loading ? 'Agendando...' : `Confirmar Agendamento (${selectedAtendimentos.length} exames)`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}