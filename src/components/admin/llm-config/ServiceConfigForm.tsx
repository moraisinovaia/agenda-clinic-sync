import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeriodConfigForm } from './PeriodConfigForm';
import { ChevronDown, ChevronUp, Trash2, Calendar, MessageSquare, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const TIPOS_AGENDAMENTO = [
  { value: 'herdar', label: 'Herdar do Médico', description: 'Usa o tipo padrão do médico' },
  { value: 'ordem_chegada', label: 'Ordem de Chegada', description: 'Paciente chega e aguarda atendimento' },
  { value: 'hora_marcada', label: 'Hora Marcada', description: 'Horário específico agendado' },
  { value: 'estimativa_horario', label: 'Estimativa de Horário', description: 'Horário aproximado, sujeito a alteração' },
];

interface ServiceConfig {
  permite_online: boolean;
  tipo_agendamento?: 'herdar' | 'ordem_chegada' | 'hora_marcada' | 'estimativa_horario';
  intervalo_estimado?: number; // Para estimativa_horario
  intervalo_pacientes?: number; // Para hora_marcada
  mensagem_estimativa?: string; // Mensagem para estimativa
  mensagem?: string;
  dias?: number[];
  periodos?: {
    manha?: any;
    tarde?: any;
    noite?: any;
  };
}

interface ServiceConfigFormProps {
  serviceName: string;
  config: ServiceConfig;
  onChange: (config: ServiceConfig) => void;
  onDelete: () => void;
  tipoAgendamentoMedico: 'ordem_chegada' | 'hora_marcada';
}

export function ServiceConfigForm({ 
  serviceName, 
  config, 
  onChange, 
  onDelete,
  tipoAgendamentoMedico 
}: ServiceConfigFormProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Tipo efetivo: se for 'herdar' ou não definido, usa o do médico
  const tipoEfetivo = (!config.tipo_agendamento || config.tipo_agendamento === 'herdar') 
    ? tipoAgendamentoMedico 
    : config.tipo_agendamento;

  const handleChange = (field: string, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const handleDiaToggle = (dia: number) => {
    const currentDias = config.dias || [];
    const newDias = currentDias.includes(dia)
      ? currentDias.filter(d => d !== dia)
      : [...currentDias, dia].sort((a, b) => a - b);
    handleChange('dias', newDias);
  };

  const handlePeriodoChange = (periodo: 'manha' | 'tarde' | 'noite', periodConfig: any) => {
    handleChange('periodos', {
      ...config.periodos,
      [periodo]: periodConfig,
    });
  };

  const defaultPeriodos = config.periodos || {
    manha: { ativo: false, inicio: '08:00', fim: '12:00', limite: 10 },
    tarde: { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 },
    noite: { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 },
  };

  const getTipoBadge = () => {
    const tipo = config.tipo_agendamento || 'herdar';
    switch (tipo) {
      case 'ordem_chegada':
        return <Badge variant="default">Ordem de Chegada</Badge>;
      case 'hora_marcada':
        return <Badge variant="secondary">Hora Marcada</Badge>;
      case 'estimativa_horario':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Estimativa</Badge>;
      default:
        return <Badge variant="outline">Herda: {tipoAgendamentoMedico === 'ordem_chegada' ? 'Ordem' : 'Hora Marcada'}</Badge>;
    }
  };

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">{serviceName}</CardTitle>
                {getTipoBadge()}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id={`online-${serviceName}`}
                  checked={config.permite_online}
                  onCheckedChange={(checked) => handleChange('permite_online', checked)}
                />
                <Label htmlFor={`online-${serviceName}`} className="text-sm">
                  {config.permite_online ? 'Online' : 'Apenas Ligação'}
                </Label>
              </div>
              <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Tipo de Agendamento do Serviço */}
            <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tipo de Agendamento deste Serviço
                </Label>
                <Select 
                  value={config.tipo_agendamento || 'herdar'}
                  onValueChange={(v) => handleChange('tipo_agendamento', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_AGENDAMENTO.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        <div className="flex flex-col">
                          <span>{tipo.label}</span>
                          <span className="text-xs text-muted-foreground">{tipo.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campos específicos para Hora Marcada */}
              {tipoEfetivo === 'hora_marcada' && (
                <div className="space-y-2">
                  <Label className="text-sm">Intervalo entre Pacientes (minutos)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={config.intervalo_pacientes || 30}
                    onChange={(e) => handleChange('intervalo_pacientes', parseInt(e.target.value) || 30)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo entre cada agendamento (ex: 30 min)
                  </p>
                </div>
              )}

              {/* Campos específicos para Estimativa de Horário */}
              {tipoEfetivo === 'estimativa_horario' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Intervalo Estimado (minutos)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={config.intervalo_estimado || 30}
                      onChange={(e) => handleChange('intervalo_estimado', parseInt(e.target.value) || 30)}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tempo aproximado entre pacientes
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Mensagem para Paciente</Label>
                    <Textarea
                      value={config.mensagem_estimativa || 'Horário aproximado, sujeito a alteração conforme ordem de atendimento.'}
                      onChange={(e) => handleChange('mensagem_estimativa', e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mensagem personalizada */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensagem Personalizada (opcional)
              </Label>
              <Textarea
                value={config.mensagem || ''}
                onChange={(e) => handleChange('mensagem', e.target.value)}
                placeholder="Ex: Trazer exames anteriores, chegar 15 minutos antes..."
                rows={2}
              />
            </div>

            {/* Dias da semana */}
            <div className="space-y-3">
              <Label>Dias de Atendimento</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <label
                    key={dia.value}
                    className={`
                      flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer transition-all
                      ${(config.dias || []).includes(dia.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                      }
                    `}
                  >
                    <Checkbox
                      checked={(config.dias || []).includes(dia.value)}
                      onCheckedChange={() => handleDiaToggle(dia.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{dia.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Períodos */}
            <div className="space-y-3">
              <Label>Períodos de Atendimento</Label>
              <div className="space-y-3">
                <PeriodConfigForm
                  periodo="manha"
                  config={defaultPeriodos.manha || { ativo: false, inicio: '08:00', fim: '12:00', limite: 10 }}
                  onChange={(cfg) => handlePeriodoChange('manha', cfg)}
                  tipoAgendamento={tipoEfetivo}
                />
                <PeriodConfigForm
                  periodo="tarde"
                  config={defaultPeriodos.tarde || { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 }}
                  onChange={(cfg) => handlePeriodoChange('tarde', cfg)}
                  tipoAgendamento={tipoEfetivo}
                />
                <PeriodConfigForm
                  periodo="noite"
                  config={defaultPeriodos.noite || { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 }}
                  onChange={(cfg) => handlePeriodoChange('noite', cfg)}
                  tipoAgendamento={tipoEfetivo}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
