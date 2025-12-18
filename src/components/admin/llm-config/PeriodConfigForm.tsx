import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Users } from 'lucide-react';

interface PeriodConfig {
  ativo: boolean;
  inicio: string;
  fim: string;
  limite: number;
  atendimento_inicio?: string;
  distribuicao_fichas?: string;
}

interface PeriodConfigFormProps {
  periodo: 'manha' | 'tarde' | 'noite';
  config: PeriodConfig;
  onChange: (config: PeriodConfig) => void;
  tipoAgendamento: 'ordem_chegada' | 'hora_marcada';
}

const PERIODO_LABELS = {
  manha: { label: 'Manhã', icon: '🌅', defaultStart: '08:00', defaultEnd: '12:00' },
  tarde: { label: 'Tarde', icon: '☀️', defaultStart: '14:00', defaultEnd: '18:00' },
  noite: { label: 'Noite', icon: '🌙', defaultStart: '18:00', defaultEnd: '22:00' },
};

export function PeriodConfigForm({ periodo, config, onChange, tipoAgendamento }: PeriodConfigFormProps) {
  const periodoInfo = PERIODO_LABELS[periodo];
  
  const handleChange = (field: keyof PeriodConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className={`p-4 rounded-lg border ${config.ativo ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}>
      <div className="flex items-center gap-3 mb-4">
        <Checkbox
          id={`periodo-${periodo}`}
          checked={config.ativo}
          onCheckedChange={(checked) => handleChange('ativo', checked)}
        />
        <Label htmlFor={`periodo-${periodo}`} className="flex items-center gap-2 text-base font-medium cursor-pointer">
          <span>{periodoInfo.icon}</span>
          {periodoInfo.label}
        </Label>
      </div>
      
      {config.ativo && (
        <div className="space-y-4 ml-7">
          {/* Horários de contagem (interno) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horário Início
              </Label>
              <Input
                type="time"
                value={config.inicio || periodoInfo.defaultStart}
                onChange={(e) => handleChange('inicio', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horário Fim
              </Label>
              <Input
                type="time"
                value={config.fim || periodoInfo.defaultEnd}
                onChange={(e) => handleChange('fim', e.target.value)}
              />
            </div>
          </div>
          
          {/* Limite de pacientes */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3" />
              Limite de Pacientes
            </Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={config.limite || 10}
              onChange={(e) => handleChange('limite', parseInt(e.target.value) || 1)}
              className="w-32"
            />
          </div>

          {/* Campos extras para ordem de chegada */}
          {tipoAgendamento === 'ordem_chegada' && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Atendimento Inicia
                </Label>
                <Input
                  type="time"
                  value={config.atendimento_inicio || ''}
                  onChange={(e) => handleChange('atendimento_inicio', e.target.value)}
                  placeholder="Ex: 08:00"
                />
                <p className="text-xs text-muted-foreground">
                  Hora que o médico começa a atender
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Distribuição de Fichas
                </Label>
                <Input
                  type="text"
                  value={config.distribuicao_fichas || ''}
                  onChange={(e) => handleChange('distribuicao_fichas', e.target.value)}
                  placeholder="Ex: 07:00 - 10:00"
                />
                <p className="text-xs text-muted-foreground">
                  Horário que paciente deve chegar
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
