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
import { ChevronDown, ChevronUp, Trash2, Calendar, MessageSquare, Clock, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

interface DayPeriodConfig {
  ativo: boolean;
  inicio: string;
  fim: string;
  limite: number;
  atendimento_inicio?: string;
  distribuicao_fichas?: string;
}

interface DayConfig {
  manha?: DayPeriodConfig;
  tarde?: DayPeriodConfig;
  noite?: DayPeriodConfig;
}

interface ServiceConfig {
  permite_online: boolean;
  tipo_agendamento?: 'herdar' | 'ordem_chegada' | 'hora_marcada' | 'estimativa_horario';
  intervalo_estimado?: number;
  intervalo_pacientes?: number;
  mensagem_estimativa?: string;
  mensagem?: string;
  dias?: number[];
  periodos?: {
    manha?: any;
    tarde?: any;
    noite?: any;
  };
  // Nova estrutura: horários por dia
  horarios_por_dia?: {
    [dia: number]: DayConfig;
  };
  usar_horario_por_dia?: boolean;
  // Limite compartilhado
  compartilha_limite_com?: string;
  limite_proprio?: number;
}

interface ServiceConfigFormProps {
  serviceName: string;
  config: ServiceConfig;
  onChange: (config: ServiceConfig) => void;
  onDelete: () => void;
  tipoAgendamentoMedico: 'ordem_chegada' | 'hora_marcada';
  outrosServicos?: string[];
  todasConfigServicos?: { [servico: string]: ServiceConfig }; // Para validar referência circular
}

const DEFAULT_PERIOD: DayPeriodConfig = {
  ativo: false,
  inicio: '08:00',
  fim: '12:00',
  limite: 10,
};

export function ServiceConfigForm({ 
  serviceName, 
  config, 
  onChange, 
  onDelete,
  tipoAgendamentoMedico,
  outrosServicos = [],
  todasConfigServicos = {}
}: ServiceConfigFormProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedDayTab, setSelectedDayTab] = useState<string>('1'); // Segunda por padrão

  const tipoEfetivo = (!config.tipo_agendamento || config.tipo_agendamento === 'herdar') 
    ? tipoAgendamentoMedico 
    : config.tipo_agendamento;

  // Detectar serviços que causariam referência circular
  const getServicosComReferenciaCircular = (): string[] => {
    return outrosServicos.filter(outroServico => {
      const configOutro = todasConfigServicos[outroServico];
      // Se o outro serviço aponta para este, seria circular
      return configOutro?.compartilha_limite_com === serviceName;
    });
  };

  const servicosComCircular = getServicosComReferenciaCircular();
  const servicosDisponiveis = outrosServicos.filter(s => !servicosComCircular.includes(s));

  const handleChange = (field: string, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const handleDiaToggle = (dia: number) => {
    const currentDias = config.dias || [];
    const newDias = currentDias.includes(dia)
      ? currentDias.filter(d => d !== dia)
      : [...currentDias, dia].sort((a, b) => a - b);
    
    // Se usando horário por dia, inicializa config do dia se não existir
    if (config.usar_horario_por_dia && !currentDias.includes(dia)) {
      const horarios = config.horarios_por_dia || {};
      if (!horarios[dia]) {
        handleChange('horarios_por_dia', {
          ...horarios,
          [dia]: {
            manha: { ...DEFAULT_PERIOD },
            tarde: { ...DEFAULT_PERIOD, inicio: '14:00', fim: '18:00' },
            noite: { ...DEFAULT_PERIOD, inicio: '18:00', fim: '22:00', limite: 5 },
          }
        });
      }
    }
    
    handleChange('dias', newDias);
  };

  const handlePeriodoChange = (periodo: 'manha' | 'tarde' | 'noite', periodConfig: any) => {
    handleChange('periodos', {
      ...config.periodos,
      [periodo]: periodConfig,
    });
  };

  // Handler para horários por dia
  const handleDayPeriodoChange = (dia: number, periodo: 'manha' | 'tarde' | 'noite', periodConfig: DayPeriodConfig) => {
    const horarios = config.horarios_por_dia || {};
    const diaConfig = horarios[dia] || {};
    
    handleChange('horarios_por_dia', {
      ...horarios,
      [dia]: {
        ...diaConfig,
        [periodo]: periodConfig,
      }
    });
  };

  // Copiar horários de um dia para outros
  const copyHorariosToOtherDays = (sourceDia: number) => {
    const horarios = config.horarios_por_dia || {};
    const sourceConfig = horarios[sourceDia];
    if (!sourceConfig) return;

    const diasAtivos = config.dias || [];
    const newHorarios = { ...horarios };
    
    diasAtivos.forEach(dia => {
      if (dia !== sourceDia) {
        newHorarios[dia] = JSON.parse(JSON.stringify(sourceConfig));
      }
    });
    
    handleChange('horarios_por_dia', newHorarios);
  };

  const defaultPeriodos = config.periodos || {
    manha: { ativo: false, inicio: '08:00', fim: '12:00', limite: 10 },
    tarde: { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 },
    noite: { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 },
  };

  const getDayConfig = (dia: number): DayConfig => {
    return config.horarios_por_dia?.[dia] || {
      manha: { ...DEFAULT_PERIOD },
      tarde: { ...DEFAULT_PERIOD, inicio: '14:00', fim: '18:00' },
      noite: { ...DEFAULT_PERIOD, inicio: '18:00', fim: '22:00', limite: 5 },
    };
  };

  const diasAtivos = (config.dias || []).sort((a, b) => a - b);

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
                  checked={config.permite_online !== false}
                  onCheckedChange={(checked) => handleChange('permite_online', checked)}
                />
                <Label htmlFor={`online-${serviceName}`} className="text-sm">
                  {config.permite_online !== false ? 'WhatsApp/Online' : 'Apenas telefone'}
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

            {/* Limite Compartilhado */}
            {outrosServicos.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`compartilha-limite-${serviceName}`}
                    checked={!!config.compartilha_limite_com}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        handleChange('compartilha_limite_com', undefined);
                        handleChange('limite_proprio', undefined);
                      }
                    }}
                    disabled={servicosDisponiveis.length === 0}
                  />
                  <Label htmlFor={`compartilha-limite-${serviceName}`} className="cursor-pointer">
                    <span className="font-medium">🔗 Compartilhar limite com outro serviço</span>
                    <p className="text-xs text-muted-foreground">
                      Ex: Consulta e Retorno dividem o mesmo total de vagas
                    </p>
                  </Label>
                </div>

                {/* Aviso de referência circular */}
                {servicosComCircular.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      ⚠️ <strong>{servicosComCircular.join(', ')}</strong> já compartilha limite com {serviceName}. 
                      Não é possível criar referência circular.
                    </p>
                  </div>
                )}

                {config.compartilha_limite_com !== undefined && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                    <div className="space-y-2">
                      <Label className="text-sm">Compartilhar limite com:</Label>
                      <Select 
                        value={config.compartilha_limite_com || ''}
                        onValueChange={(v) => handleChange('compartilha_limite_com', v)}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="Selecionar serviço" />
                        </SelectTrigger>
                        <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
                          {servicosDisponiveis.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O limite de vagas do período será dividido entre {serviceName} e o serviço selecionado.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id={`limite-proprio-${serviceName}`}
                        checked={config.limite_proprio !== undefined && config.limite_proprio > 0}
                        onCheckedChange={(checked) => {
                          handleChange('limite_proprio', checked ? 5 : undefined);
                        }}
                      />
                      <Label htmlFor={`limite-proprio-${serviceName}`} className="text-sm cursor-pointer">
                        Definir sublimite para este serviço
                      </Label>
                    </div>

                    {config.limite_proprio !== undefined && config.limite_proprio > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Máximo de vagas para {serviceName}:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={config.limite_proprio}
                          onChange={(e) => handleChange('limite_proprio', parseInt(e.target.value) || 5)}
                          className="w-24"
                        />
                        <p className="text-xs text-muted-foreground">
                          Dentro do limite compartilhado total, no máximo {config.limite_proprio} vagas podem ser de {serviceName}.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {/* Toggle para horário por dia */}
            {diasAtivos.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <Switch
                  id="usar-horario-por-dia"
                  checked={config.usar_horario_por_dia || false}
                  onCheckedChange={(checked) => handleChange('usar_horario_por_dia', checked)}
                />
                <Label htmlFor="usar-horario-por-dia" className="text-sm cursor-pointer">
                  <span className="font-medium">Horários diferentes por dia</span>
                  <p className="text-xs text-muted-foreground">
                    Ative para configurar horários específicos para cada dia da semana
                  </p>
                </Label>
              </div>
            )}

            {/* Períodos - Modo Unificado */}
            {!config.usar_horario_por_dia && (
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
            )}

            {/* Períodos - Modo por Dia */}
            {config.usar_horario_por_dia && diasAtivos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Períodos de Atendimento por Dia</Label>
                </div>
                
                <Tabs value={selectedDayTab} onValueChange={setSelectedDayTab} className="w-full">
                  <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
                    {diasAtivos.map((dia) => {
                      const diaInfo = DIAS_SEMANA.find(d => d.value === dia);
                      return (
                        <TabsTrigger 
                          key={dia} 
                          value={dia.toString()}
                          className="flex-1 min-w-[60px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {diaInfo?.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {diasAtivos.map((dia) => {
                    const diaInfo = DIAS_SEMANA.find(d => d.value === dia);
                    const dayConfig = getDayConfig(dia);
                    
                    return (
                      <TabsContent key={dia} value={dia.toString()} className="mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{diaInfo?.fullLabel}</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyHorariosToOtherDays(dia)}
                            className="text-xs gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar para outros dias
                          </Button>
                        </div>
                        
                        <div className="space-y-3">
                          <PeriodConfigForm
                            periodo="manha"
                            config={dayConfig.manha || { ativo: false, inicio: '08:00', fim: '12:00', limite: 10 }}
                            onChange={(cfg) => handleDayPeriodoChange(dia, 'manha', cfg)}
                            tipoAgendamento={tipoEfetivo}
                          />
                          <PeriodConfigForm
                            periodo="tarde"
                            config={dayConfig.tarde || { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 }}
                            onChange={(cfg) => handleDayPeriodoChange(dia, 'tarde', cfg)}
                            tipoAgendamento={tipoEfetivo}
                          />
                          <PeriodConfigForm
                            periodo="noite"
                            config={dayConfig.noite || { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 }}
                            onChange={(cfg) => handleDayPeriodoChange(dia, 'noite', cfg)}
                            tipoAgendamento={tipoEfetivo}
                          />
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
