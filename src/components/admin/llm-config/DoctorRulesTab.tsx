import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, Save, Loader2, Clock, Users, Calendar, DollarSign, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';

interface DoctorRulesTabProps {
  businessRules: BusinessRule[];
  medicos: any[];
  saving: boolean;
  onSave: (medicoId: string, config: any) => Promise<boolean>;
  onDelete: (ruleId: string) => Promise<boolean>;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const CONVENIOS_PADRAO = [
  'UNIMED',
  'UNIMED REGIONAL',
  'UNIMED NACIONAL',
  'UNIMED INTERCÂMBIO',
  'PARTICULAR',
  'BRADESCO SAÚDE',
  'SULAMERICA',
  'AMIL',
  'HAPVIDA',
  'NOTREDAME',
  'CASSI',
  'GEAP',
  'IPASGO',
  'IPSEMG'
];

interface ServiceConfig {
  permite_online: boolean;
  tipo: 'ordem_chegada' | 'hora_marcada';
  valor?: number;
  retorno_dias?: number;
  dias_semana: number[];
  periodos: Record<string, PeriodConfig>;
  mensagem?: string;
}

interface PeriodConfig {
  inicio: string;
  fim: string;
  limite: number;
  intervalo_minutos?: number;
  distribuicao_fichas?: string;
  dias_especificos?: number[];
}

export function DoctorRulesTab({ businessRules, medicos, saving, onSave, onDelete }: DoctorRulesTabProps) {
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newMedicoId, setNewMedicoId] = useState('');

  const medicosWithoutRules = medicos.filter(m => !businessRules.find(r => r.medico_id === m.id));

  const handleEditRule = (rule: BusinessRule) => {
    setEditingRule(rule);
    setShowDialog(true);
  };

  const handleNewRule = () => {
    if (!newMedicoId) return;
    
    const medico = medicos.find(m => m.id === newMedicoId);
    if (!medico) return;

    setEditingRule({
      id: '',
      cliente_id: '',
      medico_id: newMedicoId,
      medico_nome: medico.nome,
      config: {
        nome: medico.nome.toUpperCase(),
        tipo_agendamento: 'ordem_chegada',
        servicos: {},
        convenios_aceitos: ['PARTICULAR']
      },
      ativo: true,
      version: 1
    });
    setNewMedicoId('');
    setShowDialog(true);
  };

  const renderRuleCard = (rule: BusinessRule) => {
    const config = rule.config;
    const servicos = Object.keys(config.servicos || {});
    
    return (
      <AccordionItem key={rule.id || rule.medico_id} value={rule.id || rule.medico_id}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-4 text-left">
            <div>
              <p className="font-medium">{config.nome || rule.medico_nome}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Badge variant={config.tipo_agendamento === 'ordem_chegada' ? 'default' : 'secondary'}>
                  {config.tipo_agendamento === 'ordem_chegada' ? 'Ordem de Chegada' : 'Hora Marcada'}
                </Badge>
                {config.idade_minima && (
                  <Badge variant="outline">Idade mín: {config.idade_minima}</Badge>
                )}
                {servicos.length > 0 && (
                  <Badge variant="outline">{servicos.length} serviço(s)</Badge>
                )}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            {/* Serviços */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Serviços ({servicos.length})
              </h4>
              <div className="grid gap-2">
                {servicos.map(servicoNome => {
                  const servico = config.servicos[servicoNome];
                  return (
                    <div key={servicoNome} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{servicoNome}</span>
                        <div className="flex gap-2">
                          {servico.valor && (
                            <Badge variant="outline">R$ {servico.valor}</Badge>
                          )}
                          <Badge variant={servico.permite_online ? 'default' : 'destructive'}>
                            {servico.permite_online ? 'Online' : 'Apenas ligação'}
                          </Badge>
                        </div>
                      </div>
                      {servico.permite_online && servico.periodos && (
                        <div className="mt-2 text-sm text-muted-foreground space-y-1">
                          {Object.entries(servico.periodos).map(([periodo, cfg]: [string, any]) => (
                            <div key={periodo} className="flex items-center gap-2 flex-wrap">
                              <Clock className="h-3 w-3" />
                              <span className="capitalize font-medium">{periodo}:</span>
                              <span>{cfg.inicio} - {cfg.fim}</span>
                              <Users className="h-3 w-3 ml-2" />
                              <span>Limite: {cfg.limite}</span>
                              {cfg.distribuicao_fichas && (
                                <span className="text-primary">• Fichas: {cfg.distribuicao_fichas}</span>
                              )}
                              {cfg.dias_especificos && cfg.dias_especificos.length > 0 && (
                                <span className="text-muted-foreground">
                                  ({cfg.dias_especificos.map((d: number) => DIAS_SEMANA[d]?.label).join(', ')})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {servico.mensagem && (
                        <p className="mt-2 text-sm text-muted-foreground italic">{servico.mensagem}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Convênios */}
            {config.convenios_aceitos && config.convenios_aceitos.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Convênios Aceitos</h4>
                <div className="flex gap-1 flex-wrap">
                  {config.convenios_aceitos.map((conv: string) => (
                    <Badge key={conv} variant="outline">{conv}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => rule.id && onDelete(rule.id)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Regras de Negócio por Médico</CardTitle>
          <CardDescription>
            Configure as regras de agendamento para cada médico (tipo de agendamento, serviços, horários, limites)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new rule */}
          {medicosWithoutRules.length > 0 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Adicionar regra para médico</Label>
                <Select value={newMedicoId} onValueChange={setNewMedicoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicosWithoutRules.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} - {m.especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleNewRule} disabled={!newMedicoId}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          )}

          {/* Existing rules */}
          {businessRules.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {businessRules.map(renderRuleCard)}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma regra de negócio configurada. Adicione regras para os médicos acima.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <RuleEditDialog
        rule={editingRule}
        open={showDialog}
        onOpenChange={setShowDialog}
        onSave={onSave}
        saving={saving}
      />
    </>
  );
}

// Visual Editor Dialog
function RuleEditDialog({
  rule,
  open,
  onOpenChange,
  onSave,
  saving
}: {
  rule: BusinessRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (medicoId: string, config: any) => Promise<boolean>;
  saving: boolean;
}) {
  const [config, setConfig] = useState<any>({});
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newConvenio, setNewConvenio] = useState('');

  // Reset form when rule changes
  useEffect(() => {
    if (rule && open) {
      setConfig(JSON.parse(JSON.stringify(rule.config)));
      setExpandedService(null);
    }
  }, [rule, open]);

  const handleSave = async () => {
    if (!rule) return;
    const success = await onSave(rule.medico_id, config);
    if (success) {
      onOpenChange(false);
    }
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    setConfig((prev: any) => ({ ...prev, ...updates }));
  };

  const addService = () => {
    if (!newServiceName.trim()) return;
    const serviceName = newServiceName.trim();
    
    setConfig((prev: any) => ({
      ...prev,
      servicos: {
        ...prev.servicos,
        [serviceName]: {
          permite_online: true,
          tipo: prev.tipo_agendamento || 'ordem_chegada',
          dias_semana: [1, 2, 3, 4, 5],
          periodos: {
            manha: {
              inicio: '08:00',
              fim: '12:00',
              limite: 6,
              distribuicao_fichas: '08:00 às 12:00'
            }
          }
        }
      }
    }));
    setNewServiceName('');
    setExpandedService(serviceName);
  };

  const removeService = (serviceName: string) => {
    setConfig((prev: any) => {
      const newServicos = { ...prev.servicos };
      delete newServicos[serviceName];
      return { ...prev, servicos: newServicos };
    });
    if (expandedService === serviceName) {
      setExpandedService(null);
    }
  };

  const updateService = (serviceName: string, updates: Partial<ServiceConfig>) => {
    setConfig((prev: any) => ({
      ...prev,
      servicos: {
        ...prev.servicos,
        [serviceName]: {
          ...prev.servicos[serviceName],
          ...updates
        }
      }
    }));
  };

  const addPeriod = (serviceName: string, periodName: string) => {
    const service = config.servicos?.[serviceName];
    if (!service) return;

    const defaultTimes: Record<string, { inicio: string; fim: string }> = {
      manha: { inicio: '08:00', fim: '12:00' },
      tarde: { inicio: '13:00', fim: '17:00' },
      integral: { inicio: '08:00', fim: '17:00' }
    };

    updateService(serviceName, {
      periodos: {
        ...service.periodos,
        [periodName]: {
          ...defaultTimes[periodName],
          limite: 6,
          distribuicao_fichas: config.tipo_agendamento === 'ordem_chegada' 
            ? `${defaultTimes[periodName].inicio} às ${defaultTimes[periodName].fim}`
            : undefined
        }
      }
    });
  };

  const removePeriod = (serviceName: string, periodName: string) => {
    const service = config.servicos?.[serviceName];
    if (!service) return;

    const newPeriodos = { ...service.periodos };
    delete newPeriodos[periodName];

    updateService(serviceName, { periodos: newPeriodos });
  };

  const updatePeriod = (serviceName: string, periodName: string, updates: Partial<PeriodConfig>) => {
    const service = config.servicos?.[serviceName];
    if (!service) return;

    updateService(serviceName, {
      periodos: {
        ...service.periodos,
        [periodName]: {
          ...service.periodos[periodName],
          ...updates
        }
      }
    });
  };

  const toggleConvenio = (convenio: string) => {
    const current = config.convenios_aceitos || [];
    const updated = current.includes(convenio)
      ? current.filter((c: string) => c !== convenio)
      : [...current, convenio];
    updateConfig({ convenios_aceitos: updated });
  };

  const addCustomConvenio = () => {
    if (!newConvenio.trim()) return;
    const convenio = newConvenio.trim().toUpperCase();
    const current = config.convenios_aceitos || [];
    if (!current.includes(convenio)) {
      updateConfig({ convenios_aceitos: [...current, convenio] });
    }
    setNewConvenio('');
  };

  if (!rule) return null;

  const servicos = Object.keys(config.servicos || {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Regras - {rule.config?.nome || rule.medico_nome}</DialogTitle>
          <DialogDescription>
            Configure todas as regras de agendamento para este médico
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ===== INFORMAÇÕES BÁSICAS ===== */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Agendamento</Label>
                <Select 
                  value={config.tipo_agendamento || 'ordem_chegada'}
                  onValueChange={v => updateConfig({ tipo_agendamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordem_chegada">Ordem de Chegada</SelectItem>
                    <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {config.tipo_agendamento === 'ordem_chegada' 
                    ? 'Pacientes comparecem por ordem de chegada' 
                    : 'Pacientes recebem horário específico'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Idade Mínima</Label>
                <Input 
                  type="number" 
                  value={config.idade_minima || ''} 
                  onChange={e => updateConfig({ idade_minima: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Sem restrição"
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label>Idade Máxima</Label>
                <Input 
                  type="number" 
                  value={config.idade_maxima || ''} 
                  onChange={e => updateConfig({ idade_maxima: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Sem restrição"
                  min={0}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ===== CONVÊNIOS ACEITOS ===== */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Convênios Aceitos</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CONVENIOS_PADRAO.map(convenio => (
                <div key={convenio} className="flex items-center space-x-2">
                  <Checkbox
                    id={`conv-${convenio}`}
                    checked={(config.convenios_aceitos || []).includes(convenio)}
                    onCheckedChange={() => toggleConvenio(convenio)}
                  />
                  <label 
                    htmlFor={`conv-${convenio}`}
                    className="text-sm cursor-pointer"
                  >
                    {convenio}
                  </label>
                </div>
              ))}
            </div>

            {/* Custom convenios */}
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar convênio personalizado"
                value={newConvenio}
                onChange={e => setNewConvenio(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomConvenio()}
                className="max-w-xs"
              />
              <Button variant="outline" size="sm" onClick={addCustomConvenio}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Show custom convenios */}
            {(config.convenios_aceitos || []).filter((c: string) => !CONVENIOS_PADRAO.includes(c)).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Personalizados:</span>
                {(config.convenios_aceitos || [])
                  .filter((c: string) => !CONVENIOS_PADRAO.includes(c))
                  .map((conv: string) => (
                    <Badge key={conv} variant="secondary" className="gap-1">
                      {conv}
                      <button onClick={() => toggleConvenio(conv)} className="hover:text-destructive">
                        ×
                      </button>
                    </Badge>
                  ))}
              </div>
            )}
          </section>

          <Separator />

          {/* ===== SERVIÇOS ===== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">Serviços</h3>
              <Badge variant="outline">{servicos.length} serviço(s)</Badge>
            </div>

            {/* Add new service */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome do serviço (ex: Consulta, Exame...)"
                value={newServiceName}
                onChange={e => setNewServiceName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addService()}
                className="flex-1"
              />
              <Button onClick={addService} disabled={!newServiceName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Serviço
              </Button>
            </div>

            {/* Services list */}
            {servicos.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum serviço configurado</p>
                <p className="text-sm">Adicione pelo menos um serviço para este médico</p>
              </div>
            ) : (
              <div className="space-y-3">
                {servicos.map(serviceName => {
                  const service = config.servicos[serviceName];
                  const isExpanded = expandedService === serviceName;
                  const periodos = Object.keys(service.periodos || {});

                  return (
                    <div key={serviceName} className="border rounded-lg overflow-hidden">
                      {/* Service Header */}
                      <div 
                        className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => setExpandedService(isExpanded ? null : serviceName)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span className="font-medium">{serviceName}</span>
                          <Badge variant={service.permite_online ? 'default' : 'secondary'} className="text-xs">
                            {service.permite_online ? 'Online' : 'Apenas ligação'}
                          </Badge>
                          {service.valor && (
                            <Badge variant="outline" className="text-xs">
                              R$ {service.valor}
                            </Badge>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeService(serviceName);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Service Details */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 border-t">
                          {/* Service basic config */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`online-${serviceName}`}
                                checked={service.permite_online}
                                onCheckedChange={v => updateService(serviceName, { permite_online: v })}
                              />
                              <Label htmlFor={`online-${serviceName}`}>Permite Online</Label>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Tipo</Label>
                              <Select
                                value={service.tipo || config.tipo_agendamento}
                                onValueChange={v => updateService(serviceName, { tipo: v as any })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ordem_chegada">Ordem Chegada</SelectItem>
                                  <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Valor (R$)</Label>
                              <Input
                                type="number"
                                value={service.valor || ''}
                                onChange={e => updateService(serviceName, { 
                                  valor: e.target.value ? parseFloat(e.target.value) : undefined 
                                })}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Retorno (dias)</Label>
                              <Input
                                type="number"
                                value={service.retorno_dias || ''}
                                onChange={e => updateService(serviceName, { 
                                  retorno_dias: e.target.value ? parseInt(e.target.value) : undefined 
                                })}
                                placeholder="20"
                                className="h-8"
                              />
                            </div>
                          </div>

                          {/* Days of week */}
                          <div className="space-y-2">
                            <Label className="text-sm">Dias de Atendimento</Label>
                            <div className="flex gap-2 flex-wrap">
                              {DIAS_SEMANA.map(dia => (
                                <Button
                                  key={dia.value}
                                  variant={(service.dias_semana || []).includes(dia.value) ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    const current = service.dias_semana || [];
                                    const updated = current.includes(dia.value)
                                      ? current.filter((d: number) => d !== dia.value)
                                      : [...current, dia.value].sort((a, b) => a - b);
                                    updateService(serviceName, { dias_semana: updated });
                                  }}
                                  className="w-12"
                                >
                                  {dia.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Periods */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Períodos de Atendimento</Label>
                              <div className="flex gap-1">
                                {['manha', 'tarde', 'integral'].filter(p => !periodos.includes(p)).map(periodo => (
                                  <Button 
                                    key={periodo}
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => addPeriod(serviceName, periodo)}
                                    className="text-xs"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {periodo.charAt(0).toUpperCase() + periodo.slice(1)}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {periodos.length === 0 ? (
                              <div className="text-sm text-muted-foreground p-3 border border-dashed rounded">
                                Adicione pelo menos um período de atendimento
                              </div>
                            ) : (
                              <div className="grid gap-3">
                                {periodos.map(periodName => {
                                  const period = service.periodos[periodName];
                                  const isOrdemChegada = (service.tipo || config.tipo_agendamento) === 'ordem_chegada';

                                  return (
                                    <div key={periodName} className="p-3 bg-muted/30 rounded-lg space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium capitalize">{periodName}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removePeriod(serviceName, periodName)}
                                          className="h-6 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>

                                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Início</Label>
                                          <Input
                                            type="time"
                                            value={period.inicio || ''}
                                            onChange={e => updatePeriod(serviceName, periodName, { inicio: e.target.value })}
                                            className="h-8"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-xs">Fim</Label>
                                          <Input
                                            type="time"
                                            value={period.fim || ''}
                                            onChange={e => updatePeriod(serviceName, periodName, { fim: e.target.value })}
                                            className="h-8"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-xs">Limite Pacientes</Label>
                                          <Input
                                            type="number"
                                            value={period.limite || ''}
                                            onChange={e => updatePeriod(serviceName, periodName, { 
                                              limite: parseInt(e.target.value) || 0 
                                            })}
                                            min={1}
                                            className="h-8"
                                          />
                                        </div>

                                        {isOrdemChegada ? (
                                          <div className="space-y-1 col-span-2">
                                            <Label className="text-xs">Distribuição de Fichas</Label>
                                            <Input
                                              value={period.distribuicao_fichas || ''}
                                              onChange={e => updatePeriod(serviceName, periodName, { 
                                                distribuicao_fichas: e.target.value 
                                              })}
                                              placeholder="ex: 08:00 às 12:00"
                                              className="h-8"
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1 col-span-2">
                                            <Label className="text-xs">Intervalo (min)</Label>
                                            <Input
                                              type="number"
                                              value={period.intervalo_minutos || ''}
                                              onChange={e => updatePeriod(serviceName, periodName, { 
                                                intervalo_minutos: parseInt(e.target.value) || undefined 
                                              })}
                                              placeholder="30"
                                              min={5}
                                              className="h-8"
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {/* Specific days for this period */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">
                                          Dias específicos do período (deixe vazio para todos os dias do serviço)
                                        </Label>
                                        <div className="flex gap-1 flex-wrap">
                                          {DIAS_SEMANA.filter(d => (service.dias_semana || []).includes(d.value)).map(dia => (
                                            <Button
                                              key={dia.value}
                                              variant={(period.dias_especificos || []).includes(dia.value) ? 'default' : 'outline'}
                                              size="sm"
                                              onClick={() => {
                                                const current = period.dias_especificos || [];
                                                const updated = current.includes(dia.value)
                                                  ? current.filter((d: number) => d !== dia.value)
                                                  : [...current, dia.value].sort((a, b) => a - b);
                                                updatePeriod(serviceName, periodName, { 
                                                  dias_especificos: updated.length > 0 ? updated : undefined 
                                                });
                                              }}
                                              className="h-6 text-xs px-2"
                                            >
                                              {dia.label}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Service message */}
                          <div className="space-y-1">
                            <Label className="text-xs">Mensagem personalizada (opcional)</Label>
                            <Input
                              value={service.mensagem || ''}
                              onChange={e => updateService(serviceName, { mensagem: e.target.value || undefined })}
                              placeholder="Mensagem exibida ao paciente para este serviço"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Regras
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
