import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertCircle, CheckCircle2, User, Calendar, Clock, Stethoscope } from 'lucide-react';

import { useFormState } from '@/hooks/new/useFormState';
import { useBasicSchedulingData } from '@/hooks/new/useBasicSchedulingData';
import { useSimpleAppointmentCreation } from '@/hooks/new/useSimpleAppointmentCreation';
import { validateField } from '@/utils/new/appointmentValidation';

interface SimpleAppointmentFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function SimpleAppointmentForm({ onSuccess, className }: SimpleAppointmentFormProps) {
  const {
    formData,
    errors,
    touched,
    updateField,
    setFieldTouched,
    setFieldError,
    clearErrors,
    resetForm
  } = useFormState();

  const { doctors, atendimentos, loading: dataLoading, error: dataError } = useBasicSchedulingData();
  const { loading: submitting, lastResult, submitAppointment, clearLastResult } = useSimpleAppointmentCreation();

  // Filtrar atendimentos por médico selecionado
  const availableAtendimentos = useMemo(() => {
    if (!formData.medicoId) return atendimentos;
    return atendimentos.filter(atendimento => 
      !atendimento.medico_id || atendimento.medico_id === formData.medicoId
    );
  }, [atendimentos, formData.medicoId]);

  const handleFieldChange = useCallback((field: keyof typeof formData, value: string) => {
    updateField(field, value);
    
    // Validação em tempo real
    const error = validateField(field, value, formData);
    if (error) {
      setFieldError(field, error);
    }
  }, [formData, updateField, setFieldError]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    clearErrors();
    clearLastResult();

    console.log('📝 Submetendo formulário:', formData);

    const result = await submitAppointment(formData);
    
    if (result.success) {
      resetForm();
      onSuccess?.();
    }
    // Erro será mostrado automaticamente via lastResult
  }, [formData, submitAppointment, clearErrors, clearLastResult, resetForm, onSuccess]);

  const handleReset = useCallback(() => {
    resetForm();
    clearLastResult();
  }, [resetForm, clearLastResult]);

  if (dataLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <LoadingSpinner text="Carregando dados..." />
        </CardContent>
      </Card>
    );
  }

  if (dataError) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{dataError}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resultado da última tentativa */}
          {lastResult && !lastResult.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{lastResult.error}</AlertDescription>
            </Alert>
          )}

          {/* Dados do Paciente */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Dados do Paciente
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                <Input
                  id="nomeCompleto"
                  value={formData.nomeCompleto}
                  onChange={(e) => handleFieldChange('nomeCompleto', e.target.value)}
                  onBlur={() => setFieldTouched('nomeCompleto')}
                  placeholder="Nome completo do paciente"
                  className={errors.nomeCompleto ? 'border-destructive' : ''}
                />
                {errors.nomeCompleto && (
                  <p className="text-sm text-destructive">{errors.nomeCompleto}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => handleFieldChange('dataNascimento', e.target.value)}
                  onBlur={() => setFieldTouched('dataNascimento')}
                  className={errors.dataNascimento ? 'border-destructive' : ''}
                />
                {errors.dataNascimento && (
                  <p className="text-sm text-destructive">{errors.dataNascimento}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="convenio">Convênio *</Label>
                <Input
                  id="convenio"
                  value={formData.convenio}
                  onChange={(e) => handleFieldChange('convenio', e.target.value)}
                  onBlur={() => setFieldTouched('convenio')}
                  placeholder="Convênio do paciente"
                  className={errors.convenio ? 'border-destructive' : ''}
                />
                {errors.convenio && (
                  <p className="text-sm text-destructive">{errors.convenio}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleFieldChange('telefone', e.target.value)}
                  placeholder="(11) 1234-5678"
                  className={errors.telefone ? 'border-destructive' : ''}
                />
                {errors.telefone && (
                  <p className="text-sm text-destructive">{errors.telefone}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="celular">Celular</Label>
                <Input
                  id="celular"
                  value={formData.celular}
                  onChange={(e) => handleFieldChange('celular', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Dados do Agendamento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              Dados do Agendamento
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medicoId">Médico *</Label>
                <Select
                  value={formData.medicoId}
                  onValueChange={(value) => {
                    handleFieldChange('medicoId', value);
                    // Limpar atendimento se mudou médico
                    updateField('atendimentoId', '');
                  }}
                >
                  <SelectTrigger className={errors.medicoId ? 'border-destructive' : ''}>
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
                {errors.medicoId && (
                  <p className="text-sm text-destructive">{errors.medicoId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="atendimentoId">Tipo de Atendimento *</Label>
                <Select
                  value={formData.atendimentoId}
                  onValueChange={(value) => handleFieldChange('atendimentoId', value)}
                  disabled={!formData.medicoId}
                >
                  <SelectTrigger className={errors.atendimentoId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione o atendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAtendimentos.map((atendimento) => (
                      <SelectItem key={atendimento.id} value={atendimento.id}>
                        {atendimento.nome} - {atendimento.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.atendimentoId && (
                  <p className="text-sm text-destructive">{errors.atendimentoId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataAgendamento">Data do Agendamento *</Label>
                <Input
                  id="dataAgendamento"
                  type="date"
                  value={formData.dataAgendamento}
                  onChange={(e) => handleFieldChange('dataAgendamento', e.target.value)}
                  onBlur={() => setFieldTouched('dataAgendamento')}
                  min={new Date().toISOString().split('T')[0]}
                  className={errors.dataAgendamento ? 'border-destructive' : ''}
                />
                {errors.dataAgendamento && (
                  <p className="text-sm text-destructive">{errors.dataAgendamento}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaAgendamento">Hora do Agendamento *</Label>
                <Input
                  id="horaAgendamento"
                  type="time"
                  value={formData.horaAgendamento}
                  onChange={(e) => handleFieldChange('horaAgendamento', e.target.value)}
                  onBlur={() => setFieldTouched('horaAgendamento')}
                  className={errors.horaAgendamento ? 'border-destructive' : ''}
                />
                {errors.horaAgendamento && (
                  <p className="text-sm text-destructive">{errors.horaAgendamento}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleFieldChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Criando Agendamento...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Criar Agendamento
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={submitting}
            >
              Limpar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}