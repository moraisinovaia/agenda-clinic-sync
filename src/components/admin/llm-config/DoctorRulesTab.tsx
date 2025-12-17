import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Save, Loader2, Clock, Users, Calendar } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';

interface DoctorRulesTabProps {
  businessRules: BusinessRule[];
  medicos: any[];
  saving: boolean;
  onSave: (medicoId: string, config: any) => Promise<boolean>;
  onDelete: (ruleId: string) => Promise<boolean>;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

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
        servicos: {}
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
              <div className="flex gap-2 mt-1">
                <Badge variant={config.tipo_agendamento === 'ordem_chegada' ? 'default' : 'secondary'}>
                  {config.tipo_agendamento === 'ordem_chegada' ? 'Ordem de Chegada' : 'Hora Marcada'}
                </Badge>
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
                  return (
                    <div key={servicoNome} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{servicoNome}</span>
                        <Badge variant={servico.permite_online ? 'default' : 'destructive'}>
                          {servico.permite_online ? 'Online' : 'Apenas ligação'}
                        </Badge>
                      </div>
                      {servico.permite_online && servico.periodos && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {Object.entries(servico.periodos).map(([periodo, cfg]: [string, any]) => (
                            <div key={periodo} className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span className="capitalize">{periodo}:</span>
                              <span>{cfg.inicio} - {cfg.fim}</span>
                              <Users className="h-3 w-3 ml-2" />
                              <span>Limite: {cfg.limite}</span>
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
                    ))}</SelectContent>
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

// Dialog for editing rules
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

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setConfig(JSON.parse(JSON.stringify(rule.config)));
    }
  }, [rule]);

  const handleSave = async () => {
    if (!rule) return;
    const success = await onSave(rule.medico_id, config);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Regras - {rule.config?.nome || rule.medico_nome}</DialogTitle>
          <DialogDescription>
            Configure as regras de agendamento para este médico
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label>Configuração JSON (avançado)</Label>
            <Textarea
              value={JSON.stringify(config, null, 2)}
              onChange={e => {
                try {
                  setConfig(JSON.parse(e.target.value));
                } catch {}
              }}
              rows={15}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Edite o JSON diretamente para configurações avançadas de serviços e períodos
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
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
