import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Clock, Users, Calendar, Settings, Package, FileText, Ban, Timer } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';
import { Label } from '@/components/ui/label';
import { RuleEditDialog } from './RuleEditDialog';

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
                {config.pacotes_especiais?.length > 0 && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <Package className="h-3 w-3 mr-1" />
                    {config.pacotes_especiais.length} pacote{config.pacotes_especiais.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {config.regras_chegada && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Regras de chegada
                  </Badge>
                )}
                {Object.keys(config.entrega_resultados || {}).length > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                    <FileText className="h-3 w-3 mr-1" />
                    {Object.keys(config.entrega_resultados).length} prazo{Object.keys(config.entrega_resultados).length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {/* Advanced Rules Badges */}
                {config.restricoes_convenio && Object.keys(config.restricoes_convenio).length > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                    <Ban className="h-3 w-3 mr-1" />
                    {Object.keys(config.restricoes_convenio).length} restrição(ões)
                  </Badge>
                )}
                {config.pacote_obrigatorio && Object.keys(config.pacote_obrigatorio).length > 0 && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                    <Package className="h-3 w-3 mr-1" />
                    {Object.keys(config.pacote_obrigatorio).length} pacote(s) obrigatório(s)
                  </Badge>
                )}
                {config.restricoes_intervalo && Object.keys(config.restricoes_intervalo).length > 0 && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30">
                    <Timer className="h-3 w-3 mr-1" />
                    {Object.keys(config.restricoes_intervalo).length} intervalo(s)
                  </Badge>
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
                  const tipoServico = servico.tipo_agendamento || 'herdar';
                  const tipoEfetivo = tipoServico === 'herdar' ? config.tipo_agendamento : tipoServico;
                  
                  const getTipoLabel = () => {
                    switch (tipoEfetivo) {
                      case 'ordem_chegada': return 'Ordem';
                      case 'hora_marcada': return 'Hora Marcada';
                      case 'estimativa_horario': return 'Estimativa';
                      default: return 'Ordem';
                    }
                  };
                  
                  return (
                    <div key={servicoNome} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{servicoNome}</span>
                        <div className="flex gap-2">
                          <Badge 
                            variant={tipoEfetivo === 'estimativa_horario' ? 'outline' : 'secondary'}
                            className={tipoEfetivo === 'estimativa_horario' ? 'bg-amber-500/20 text-amber-700 border-amber-500/30' : ''}
                          >
                            {getTipoLabel()}
                            {tipoServico === 'herdar' && ' (herdado)'}
                          </Badge>
                          {diasAtivos > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {diasAtivos} dia{diasAtivos !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge variant={servico.permite_online !== false ? 'default' : 'destructive'}>
                            {servico.permite_online !== false ? 'WhatsApp/Online' : 'Apenas telefone'}
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
                                {tipoEfetivo === 'estimativa_horario' && servico.intervalo_estimado && (
                                  <span className="text-amber-600">(~{servico.intervalo_estimado}min)</span>
                                )}
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
