import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PeriodConfigForm } from './PeriodConfigForm';
import { ChevronDown, ChevronUp, Trash2, Calendar, MessageSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

interface ServiceConfig {
  permite_online: boolean;
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
  tipoAgendamento: 'ordem_chegada' | 'hora_marcada';
}

export function ServiceConfigForm({ 
  serviceName, 
  config, 
  onChange, 
  onDelete,
  tipoAgendamento 
}: ServiceConfigFormProps) {
  const [isOpen, setIsOpen] = useState(true);

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

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">{serviceName}</CardTitle>
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
                  tipoAgendamento={tipoAgendamento}
                />
                <PeriodConfigForm
                  periodo="tarde"
                  config={defaultPeriodos.tarde || { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 }}
                  onChange={(cfg) => handlePeriodoChange('tarde', cfg)}
                  tipoAgendamento={tipoAgendamento}
                />
                <PeriodConfigForm
                  periodo="noite"
                  config={defaultPeriodos.noite || { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 }}
                  onChange={(cfg) => handlePeriodoChange('noite', cfg)}
                  tipoAgendamento={tipoAgendamento}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
