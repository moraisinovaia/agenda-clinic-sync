import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Doctor, Atendimento } from '@/types/scheduling';
import { MultipleSchedulingFormData, ExamCompatibility } from '@/types/multiple-scheduling';
import { useMultipleScheduling } from '@/hooks/useMultipleScheduling';

interface MultipleAppointmentDataFormProps {
  formData: MultipleSchedulingFormData;
  setFormData: (data: MultipleSchedulingFormData | ((prev: MultipleSchedulingFormData) => MultipleSchedulingFormData)) => void;
  doctors: Doctor[];
  atendimentos: Atendimento[];
}

export function MultipleAppointmentDataForm({
  formData,
  setFormData,
  doctors,
  atendimentos
}: MultipleAppointmentDataFormProps) {
  const [compatibleExams, setCompatibleExams] = useState<ExamCompatibility[]>([]);
  const [availableAtendimentos, setAvailableAtendimentos] = useState<Atendimento[]>([]);
  const { getCompatibleExams } = useMultipleScheduling();

  const selectedDoctor = doctors.find(d => d.id === formData.medicoId);
  const selectedAtendimentos = atendimentos.filter(a => formData.atendimentoIds.includes(a.id));

  // Atualizar atendimentos disponíveis quando médico muda
  useEffect(() => {
    if (formData.medicoId) {
      const doctorAtendimentos = atendimentos.filter(a => 
        a.medico_id === formData.medicoId || a.medico_id === null
      );
      setAvailableAtendimentos(doctorAtendimentos);
      
      // Buscar exames compatíveis
      getCompatibleExams(formData.medicoId).then(setCompatibleExams);
      
      // Limpar seleções anteriores se médico mudou
      setFormData(prev => ({ ...prev, atendimentoIds: [] }));
    } else {
      setAvailableAtendimentos([]);
      setCompatibleExams([]);
    }
  }, [formData.medicoId, atendimentos, getCompatibleExams]);

  const handleAtendimentoToggle = (atendimentoId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      atendimentoIds: checked 
        ? [...prev.atendimentoIds, atendimentoId]
        : prev.atendimentoIds.filter(id => id !== atendimentoId)
    }));
  };

  const getCompatibilityInfo = (atendimentoId: string) => {
    if (formData.atendimentoIds.length <= 1) return null;
    
    const otherSelectedIds = formData.atendimentoIds.filter(id => id !== atendimentoId);
    const compatibilities = compatibleExams.filter(exam => 
      (exam.atendimento1_id === atendimentoId && otherSelectedIds.includes(exam.atendimento2_id)) ||
      (exam.atendimento2_id === atendimentoId && otherSelectedIds.includes(exam.atendimento1_id))
    );
    
    return compatibilities.length > 0 ? compatibilities[0] : null;
  };

  const hasIncompatibleCombination = () => {
    if (formData.atendimentoIds.length <= 1) return false;
    
    for (let i = 0; i < formData.atendimentoIds.length; i++) {
      for (let j = i + 1; j < formData.atendimentoIds.length; j++) {
        const compatible = compatibleExams.some(exam => 
          ((exam.atendimento1_id === formData.atendimentoIds[i] && exam.atendimento2_id === formData.atendimentoIds[j]) ||
           (exam.atendimento1_id === formData.atendimentoIds[j] && exam.atendimento2_id === formData.atendimentoIds[i])) &&
          exam.compativel
        );
        if (!compatible) return true;
      }
    }
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Seleção do Médico */}
      <div className="space-y-2">
        <Label htmlFor="medico">Médico *</Label>
        <Select 
          value={formData.medicoId} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, medicoId: value }))}
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

      {/* Seleção Múltipla de Atendimentos */}
      {formData.medicoId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              Selecionar Exames/Procedimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableAtendimentos.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum atendimento disponível para este médico.
              </p>
            ) : (
              <>
                <div className="grid gap-3">
                  {availableAtendimentos.map((atendimento) => {
                    const isSelected = formData.atendimentoIds.includes(atendimento.id);
                    const compatibility = getCompatibilityInfo(atendimento.id);
                    
                    return (
                      <div
                        key={atendimento.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                          isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          id={atendimento.id}
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleAtendimentoToggle(atendimento.id, checked as boolean)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={atendimento.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {atendimento.nome}
                          </label>
                          {atendimento.observacoes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {atendimento.observacoes}
                            </p>
                          )}
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {atendimento.tipo}
                            </Badge>
                            {compatibility && (
                              <Badge variant="secondary" className="text-xs">
                                Compatível
                              </Badge>
                            )}
                          </div>
                          {compatibility && (
                            <p className="text-xs text-green-600 mt-1">
                              {compatibility.motivo_compatibilidade}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Alertas de Compatibilidade */}
                {formData.atendimentoIds.length > 1 && (
                  <div className="space-y-2">
                    {hasIncompatibleCombination() ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Atenção: Alguns exames selecionados podem não ser recomendados para execução conjunta. 
                          Verifique com o médico responsável.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Excelente! Os exames selecionados são compatíveis e podem ser realizados na mesma sessão.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Resumo da Seleção */}
                {selectedAtendimentos.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Exames Selecionados:</h4>
                    <div className="space-y-1">
                      {selectedAtendimentos.map((atendimento, index) => (
                        <div key={atendimento.id} className="text-sm">
                          {index + 1}. {atendimento.nome}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data e Hora */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dataAgendamento">Data do Agendamento *</Label>
          <Input
            id="dataAgendamento"
            type="date"
            value={formData.dataAgendamento}
            onChange={(e) => setFormData(prev => ({ ...prev, dataAgendamento: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="horaAgendamento">Horário *</Label>
          <Input
            id="horaAgendamento"
            type="time"
            value={formData.horaAgendamento}
            onChange={(e) => setFormData(prev => ({ ...prev, horaAgendamento: e.target.value }))}
            step="60" // Intervalos de 1 minuto
            required
          />
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          placeholder="Observações adicionais..."
          value={formData.observacoes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
          rows={3}
        />
      </div>
    </div>
  );
}