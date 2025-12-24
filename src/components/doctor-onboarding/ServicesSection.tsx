import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  DoctorOnboardingFormData, 
  ServicoConfig, 
  DIAS_SEMANA, 
  TIPOS_SERVICO 
} from '@/types/doctor-onboarding';
import { Plus, Trash2, Briefcase, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ServicesSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  addServico: () => void;
  updateServico: (index: number, servico: ServicoConfig) => void;
  removeServico: (index: number) => void;
}

export function ServicesSection({ 
  formData, 
  errors, 
  addServico, 
  updateServico, 
  removeServico 
}: ServicesSectionProps) {
  const handleFieldChange = (index: number, field: keyof ServicoConfig, value: unknown) => {
    const servico = formData.servicos[index];
    updateServico(index, { ...servico, [field]: value });
  };

  const handleDayToggle = (index: number, day: number) => {
    const servico = formData.servicos[index];
    const dias = servico.dias_atendimento.includes(day)
      ? servico.dias_atendimento.filter(d => d !== day)
      : [...servico.dias_atendimento, day].sort();
    updateServico(index, { ...servico, dias_atendimento: dias });
  };

  const handlePeriodoChange = (
    index: number, 
    periodo: 'manha' | 'tarde' | 'noite', 
    field: string, 
    value: unknown
  ) => {
    const servico = formData.servicos[index];
    updateServico(index, {
      ...servico,
      periodos: {
        ...servico.periodos,
        [periodo]: {
          ...servico.periodos[periodo],
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Serviços/Atendimentos</h3>
        </div>
        <Button onClick={addServico} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>
      </div>

      {errors.servicos && (
        <p className="text-sm text-destructive">{errors.servicos}</p>
      )}

      {formData.servicos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Nenhum serviço cadastrado.<br />
              Adicione os serviços que este médico realiza.
            </p>
            <Button onClick={addServico} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {formData.servicos.map((servico, index) => (
            <AccordionItem key={index} value={`servico-${index}`} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <Badge variant={servico.tipo === 'exame' ? 'default' : 'secondary'}>
                    {TIPOS_SERVICO.find(t => t.value === servico.tipo)?.label || servico.tipo}
                  </Badge>
                  <span className="font-medium">
                    {servico.nome || `Serviço ${index + 1}`}
                  </span>
                  {servico.permite_online && (
                    <Badge variant="outline" className="text-success border-success">
                      Online
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Nome do Serviço <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="Ex: Endoscopia Digestiva"
                        value={servico.nome}
                        onChange={(e) => handleFieldChange(index, 'nome', e.target.value)}
                        className={errors[`servico_${index}_nome`] ? 'border-destructive' : ''}
                      />
                      {errors[`servico_${index}_nome`] && (
                        <p className="text-sm text-destructive">{errors[`servico_${index}_nome`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={servico.tipo}
                        onValueChange={(value) => handleFieldChange(index, 'tipo', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_SERVICO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={servico.permite_online}
                      onCheckedChange={(checked) => handleFieldChange(index, 'permite_online', checked)}
                    />
                    <Label>Permitir agendamento online para este serviço</Label>
                  </div>

                  {/* Days of Week */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dias de Atendimento
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {DIAS_SEMANA.map((dia) => (
                        <div
                          key={dia.value}
                          className={`px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                            servico.dias_atendimento.includes(dia.value)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleDayToggle(index, dia.value)}
                        >
                          <span className="text-sm font-medium">{dia.short}</span>
                        </div>
                      ))}
                    </div>
                    {errors[`servico_${index}_dias`] && (
                      <p className="text-sm text-destructive">{errors[`servico_${index}_dias`]}</p>
                    )}
                  </div>

                  {/* Periods */}
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Períodos de Atendimento
                    </Label>

                    {(['manha', 'tarde', 'noite'] as const).map((periodo) => (
                      <Card key={periodo} className={!servico.periodos[periodo].ativo ? 'opacity-60' : ''}>
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium capitalize">
                              {periodo === 'manha' ? '🌅 Manhã' : periodo === 'tarde' ? '☀️ Tarde' : '🌙 Noite'}
                            </CardTitle>
                            <Switch
                              checked={servico.periodos[periodo].ativo}
                              onCheckedChange={(checked) => handlePeriodoChange(index, periodo, 'ativo', checked)}
                            />
                          </div>
                        </CardHeader>
                        {servico.periodos[periodo].ativo && (
                          <CardContent className="pt-0 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={servico.periodos[periodo].horario_inicio}
                                  onChange={(e) => handlePeriodoChange(index, periodo, 'horario_inicio', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={servico.periodos[periodo].horario_fim}
                                  onChange={(e) => handlePeriodoChange(index, periodo, 'horario_fim', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Limite Pacientes</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={servico.periodos[periodo].limite_pacientes}
                                  onChange={(e) => handlePeriodoChange(index, periodo, 'limite_pacientes', parseInt(e.target.value) || 1)}
                                />
                              </div>
                            </div>

                            {formData.tipo_agendamento === 'ordem_chegada' && (
                              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                                <div className="space-y-1">
                                  <Label className="text-xs">Horário Início Médico</Label>
                                  <Input
                                    type="time"
                                    value={servico.periodos[periodo].horario_inicio_medico || ''}
                                    onChange={(e) => handlePeriodoChange(index, periodo, 'horario_inicio_medico', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Distribuição Fichas</Label>
                                  <Input
                                    type="time"
                                    value={servico.periodos[periodo].horario_distribuicao_fichas || ''}
                                    onChange={(e) => handlePeriodoChange(index, periodo, 'horario_distribuicao_fichas', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>

                  {/* Custom Message */}
                  <div className="space-y-2">
                    <Label>Mensagem Personalizada (opcional)</Label>
                    <Textarea
                      placeholder="Mensagem especial para pacientes que agendam este serviço..."
                      value={servico.mensagem_personalizada}
                      onChange={(e) => handleFieldChange(index, 'mensagem_personalizada', e.target.value)}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeServico(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Serviço
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
