import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Save, Loader2, Clock, Users, Calendar, Settings } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';
import { ServiceConfigForm } from './ServiceConfigForm';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

interface DoctorRulesTabProps {
  businessRules: BusinessRule[];
  medicos: any[];
  saving: boolean;
  onSave: (medicoId: string, config: any) => Promise<boolean>;
  onDelete: (ruleId: string) => Promise<boolean>;
}

export function DoctorRulesTab({ businessRules, medicos, saving, onSave, onDelete }: DoctorRulesTabProps) {
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newMedicoId, setNewMedicoId] = useState('');

  // Médicos sem regra definida
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
        permite_agendamento_online: true,
        servicos: {}
      },
      ativo: true,
      version: 1
    });
    setNewMedicoId('');
    setShowDialog(true);
  };

  const countPeriodosAtivos = (servicos: any) => {
    let count = 0;
    Object.values(servicos || {}).forEach((servico: any) => {
      if (servico.periodos) {
        if (servico.periodos.manha?.ativo) count++;
        if (servico.periodos.tarde?.ativo) count++;
        if (servico.periodos.noite?.ativo) count++;
      }
    });
    return count;
  };

  const renderRuleCard = (rule: BusinessRule) => {
    const config = rule.config;
    const servicos = Object.keys(config.servicos || {});
    const periodosAtivos = countPeriodosAtivos(config.servicos);
    
    return (
      <AccordionItem key={rule.id || rule.medico_id} value={rule.id || rule.medico_id}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-4 text-left">
            <div>
              <p className="font-medium">{config.nome || rule.medico_nome}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant={config.tipo_agendamento === 'ordem_chegada' ? 'default' : 'secondary'}>
                  {config.tipo_agendamento === 'ordem_chegada' ? 'Ordem de Chegada' : 'Hora Marcada'}
                </Badge>
                <Badge variant="outline">
                  {servicos.length} serviço{servicos.length !== 1 ? 's' : ''}
                </Badge>
                {periodosAtivos > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {periodosAtivos} período{periodosAtivos !== 1 ? 's' : ''}
                  </Badge>
                )}
                {config.idade_minima && (
                  <Badge variant="outline">Idade mín: {config.idade_minima}</Badge>
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
                  const diasAtivos = servico.dias?.length || 0;
                  return (
                    <div key={servicoNome} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{servicoNome}</span>
                        <div className="flex gap-2">
                          {diasAtivos > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {diasAtivos} dia{diasAtivos !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge variant={servico.permite_online ? 'default' : 'destructive'}>
                            {servico.permite_online ? 'Online' : 'Apenas ligação'}
                          </Badge>
                        </div>
                      </div>
                      {servico.permite_online && servico.periodos && (
                        <div className="mt-2 text-sm text-muted-foreground grid gap-1">
                          {Object.entries(servico.periodos).map(([periodo, cfg]: [string, any]) => (
                            cfg.ativo && (
                              <div key={periodo} className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span className="capitalize">{periodo}:</span>
                                <span>{cfg.inicio} - {cfg.fim}</span>
                                <Users className="h-3 w-3 ml-2" />
                                <span>Limite: {cfg.limite}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      {servico.mensagem && (
                        <p className="mt-2 text-sm text-muted-foreground italic">{servico.mensagem}</p>
                      )}
                    </div>
                  );
                })}
                {servicos.length === 0 && (
                  <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-lg">
                    Nenhum serviço configurado. Clique em "Editar" para adicionar serviços.
                  </p>
                )}
              </div>
            </div>
            
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
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Regras de Negócio por Médico
          </CardTitle>
          <CardDescription>
            Configure as regras de agendamento para cada médico (tipo de agendamento, serviços, horários, limites).
            As alterações serão aplicadas no sistema de agendamento automático (Noah) em até 1 minuto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new rule */}
          {medicosWithoutRules.length > 0 && (
            <div className="flex gap-2 items-end p-4 bg-muted/30 rounded-lg border border-dashed">
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
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma regra de negócio configurada.</p>
              <p className="text-sm">Adicione regras para os médicos acima para habilitar o agendamento online.</p>
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

// Dialog for editing rules with visual interface
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
  const { profile } = useStableAuth();
  const [config, setConfig] = useState<any>({});
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch atendimentos when dialog opens
  useEffect(() => {
    const fetchAtendimentos = async () => {
      if (!profile?.cliente_id) return;
      
      const { data } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .eq('cliente_id', profile.cliente_id)
        .eq('ativo', true)
        .order('nome');
      
      setAtendimentos(data || []);
    };

    if (open) {
      fetchAtendimentos();
    }
  }, [open, profile?.cliente_id]);

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setConfig(JSON.parse(JSON.stringify(rule.config)));
      setShowAdvanced(false);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!rule) return;
    const success = await onSave(rule.medico_id, config);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    
    const updatedServicos = {
      ...config.servicos,
      [newServiceName.trim()]: {
        permite_online: true,
        dias: [],
        periodos: {
          manha: { ativo: false, inicio: '08:00', fim: '12:00', limite: 10 },
          tarde: { ativo: false, inicio: '14:00', fim: '18:00', limite: 10 },
          noite: { ativo: false, inicio: '18:00', fim: '22:00', limite: 5 },
        }
      }
    };
    
    setConfig((prev: any) => ({ ...prev, servicos: updatedServicos }));
    setNewServiceName('');
  };

  const handleServiceChange = (serviceName: string, serviceConfig: any) => {
    setConfig((prev: any) => ({
      ...prev,
      servicos: {
        ...prev.servicos,
        [serviceName]: serviceConfig
      }
    }));
  };

  const handleDeleteService = (serviceName: string) => {
    const updatedServicos = { ...config.servicos };
    delete updatedServicos[serviceName];
    setConfig((prev: any) => ({ ...prev, servicos: updatedServicos }));
  };

  // Get available services (not already added)
  const availableServices = atendimentos.filter(
    a => !Object.keys(config.servicos || {}).includes(a.nome)
  );

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Regras - {rule.config?.nome || rule.medico_nome}
          </DialogTitle>
          <DialogDescription>
            Configure as regras de agendamento para este médico. Adicione serviços e defina horários de atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configurações Gerais */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Tipo de Agendamento</Label>
              <Select 
                value={config.tipo_agendamento || 'ordem_chegada'}
                onValueChange={v => setConfig((prev: any) => ({ ...prev, tipo_agendamento: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordem_chegada">Ordem de Chegada</SelectItem>
                  <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Idade Mínima</Label>
                <Input 
                  type="number" 
                  value={config.idade_minima || ''} 
                  onChange={e => setConfig((prev: any) => ({ ...prev, idade_minima: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Sem restrição"
                />
              </div>
              <div className="space-y-2">
                <Label>Idade Máxima</Label>
                <Input 
                  type="number" 
                  value={config.idade_maxima || ''} 
                  onChange={e => setConfig((prev: any) => ({ ...prev, idade_maxima: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Sem restrição"
                />
              </div>
            </div>
          </div>

          {/* Serviços */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-medium">Serviços</Label>
              <div className="flex gap-2">
                {availableServices.length > 0 ? (
                  <Select value={newServiceName} onValueChange={setNewServiceName}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecionar serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map(a => (
                        <SelectItem key={a.id} value={a.nome}>
                          {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Nome do serviço"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="w-[200px]"
                  />
                )}
                <Button onClick={handleAddService} disabled={!newServiceName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            {Object.entries(config.servicos || {}).map(([serviceName, serviceConfig]) => (
              <ServiceConfigForm
                key={serviceName}
                serviceName={serviceName}
                config={serviceConfig as any}
                onChange={(cfg) => handleServiceChange(serviceName, cfg)}
                onDelete={() => handleDeleteService(serviceName)}
                tipoAgendamento={config.tipo_agendamento || 'ordem_chegada'}
              />
            ))}

            {Object.keys(config.servicos || {}).length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum serviço adicionado.</p>
                <p className="text-sm">Adicione serviços usando o seletor acima.</p>
              </div>
            )}
          </div>

          {/* Editor JSON Avançado */}
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-muted-foreground"
            >
              {showAdvanced ? '▼' : '►'} Editor JSON (avançado)
            </Button>
            {showAdvanced && (
              <textarea
                value={JSON.stringify(config, null, 2)}
                onChange={e => {
                  try {
                    setConfig(JSON.parse(e.target.value));
                  } catch {}
                }}
                rows={15}
                className="w-full font-mono text-xs p-3 rounded-lg border bg-background"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
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
                Salvar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
