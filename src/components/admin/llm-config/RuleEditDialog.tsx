import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Save, Loader2, Calendar, Settings, Package, Clock, FileText, X, ShieldAlert } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';
import { ServiceConfigForm } from './ServiceConfigForm';
import { AdvancedRulesSection } from './AdvancedRulesSection';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';

interface RuleEditDialogProps {
  rule: BusinessRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (medicoId: string, config: any) => Promise<boolean>;
  saving: boolean;
  clienteId?: string | null;
}

interface PacoteEspecial {
  nome: string;
  servicos: string[];
  valor: number;
  economia: number;
  observacao: string;
}

interface RegrasChegada {
  primeiro_grupo_dia?: {
    antecedencia_minutos: number;
    descricao: string;
  };
  demais_grupos?: {
    antecedencia_minutos: number;
    descricao: string;
  };
}

interface EntregaResultado {
  prazo_dias: number;
  descricao: string;
}

export function RuleEditDialog({
  rule,
  open,
  onOpenChange,
  onSave,
  saving,
  clienteId
}: RuleEditDialogProps) {
  const { profile } = useStableAuth();
  const [config, setConfig] = useState<any>({});
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // States for new package form
  const [newPacote, setNewPacote] = useState<PacoteEspecial>({
    nome: '',
    servicos: [],
    valor: 0,
    economia: 0,
    observacao: ''
  });
  const [newPacoteServico, setNewPacoteServico] = useState('');

  // States for entrega resultados
  const [newEntregaServico, setNewEntregaServico] = useState('');
  const [newEntregaPrazo, setNewEntregaPrazo] = useState(30);

  const effectiveClienteId = clienteId || profile?.cliente_id;

  // State for convenios
  const [conveniosDisponiveis, setConveniosDisponiveis] = useState<string[]>([]);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);

  // Fetch atendimentos and convenios when dialog opens
  useEffect(() => {
    const fetchData = async () => {
      if (!effectiveClienteId) return;
      
      // Fetch atendimentos
      const { data: atendimentosData } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .eq('cliente_id', effectiveClienteId)
        .eq('ativo', true)
        .order('nome');
      
      setAtendimentos(atendimentosData || []);

      // Fetch convenios from medico if rule exists
      if (rule?.medico_id) {
        const { data: medicoData } = await supabase
          .from('medicos')
          .select('convenios_aceitos')
          .eq('id', rule.medico_id)
          .single();
        
        const conveniosArray = Array.isArray(medicoData?.convenios_aceitos) ? medicoData.convenios_aceitos : [];
        
        setConveniosDisponiveis(conveniosArray);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, effectiveClienteId, rule?.medico_id]);

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

  // Pacotes Especiais handlers
  const handleAddPacote = () => {
    if (!newPacote.nome.trim() || newPacote.servicos.length === 0) return;
    
    const pacotes = [...(config.pacotes_especiais || []), newPacote];
    setConfig((prev: any) => ({ ...prev, pacotes_especiais: pacotes }));
    setNewPacote({ nome: '', servicos: [], valor: 0, economia: 0, observacao: '' });
  };

  const handleRemovePacote = (index: number) => {
    const pacotes = [...(config.pacotes_especiais || [])];
    pacotes.splice(index, 1);
    setConfig((prev: any) => ({ ...prev, pacotes_especiais: pacotes }));
  };

  const handleAddServicoPacote = () => {
    if (!newPacoteServico.trim()) return;
    if (!newPacote.servicos.includes(newPacoteServico)) {
      setNewPacote(prev => ({
        ...prev,
        servicos: [...prev.servicos, newPacoteServico]
      }));
    }
    setNewPacoteServico('');
  };

  const handleRemoveServicoPacote = (servico: string) => {
    setNewPacote(prev => ({
      ...prev,
      servicos: prev.servicos.filter(s => s !== servico)
    }));
  };

  // Regras de Chegada handlers
  const handleRegrasChegadaChange = (tipo: 'primeiro_grupo_dia' | 'demais_grupos', minutos: number) => {
    const regras: RegrasChegada = config.regras_chegada || {};
    regras[tipo] = {
      antecedencia_minutos: minutos,
      descricao: tipo === 'primeiro_grupo_dia' 
        ? `Pacientes do primeiro horário devem chegar ${minutos} minutos antes`
        : `Demais pacientes devem chegar ${minutos} minutos antes`
    };
    setConfig((prev: any) => ({ ...prev, regras_chegada: regras }));
  };

  // Entrega de Resultados handlers
  const handleAddEntregaResultado = () => {
    if (!newEntregaServico.trim()) return;
    
    const entrega = {
      ...(config.entrega_resultados || {}),
      [newEntregaServico]: {
        prazo_dias: newEntregaPrazo,
        descricao: `Resultado de ${newEntregaServico} em até ${newEntregaPrazo} dias`
      }
    };
    setConfig((prev: any) => ({ ...prev, entrega_resultados: entrega }));
    setNewEntregaServico('');
    setNewEntregaPrazo(30);
  };

  const handleRemoveEntregaResultado = (servico: string) => {
    const entrega = { ...(config.entrega_resultados || {}) };
    delete entrega[servico];
    setConfig((prev: any) => ({ ...prev, entrega_resultados: entrega }));
  };

  // Get available services (not already added)
  const availableServices = atendimentos.filter(
    a => !Object.keys(config.servicos || {}).includes(a.nome)
  );

  // All service names for selection
  const allServiceNames = Object.keys(config.servicos || {});

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <SelectItem value="ordem_chegada">Ordem de Chegada</SelectItem>
                  <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Restrições de idade - somente leitura */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <span className="font-medium">Restrições de idade:</span>
              {config.idade_minima || config.idade_maxima ? (
                <span>{config.idade_minima || 0} - {config.idade_maxima || '∞'} anos</span>
              ) : (
                <span>Sem restrição</span>
              )}
              <span className="text-xs opacity-70">(edite no formulário principal)</span>
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
                    <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
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
                tipoAgendamentoMedico={config.tipo_agendamento || 'ordem_chegada'}
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

          {/* Pacotes Especiais */}
          <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <Label className="text-lg font-medium flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pacotes Especiais
            </Label>

            {/* Lista de pacotes existentes */}
            {(config.pacotes_especiais || []).map((pacote: PacoteEspecial, index: number) => (
              <Card key={index} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="font-medium text-lg">{pacote.nome}</div>
                    <div className="flex flex-wrap gap-1">
                      {pacote.servicos.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Valor: R$ {pacote.valor?.toFixed(2)}</span>
                      {pacote.economia > 0 && (
                        <span className="ml-2 text-green-600">(economia de R$ {pacote.economia.toFixed(2)})</span>
                      )}
                    </div>
                    {pacote.observacao && (
                      <p className="text-sm italic text-muted-foreground">{pacote.observacao}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemovePacote(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {/* Formulário para novo pacote */}
            <Card className="p-4 space-y-3 border-dashed">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Nome do Pacote</Label>
                  <Input
                    placeholder="Ex: ECG + Consulta"
                    value={newPacote.nome}
                    onChange={e => setNewPacote(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Valor (R$)</Label>
                    <Input
                      type="number"
                      value={newPacote.valor || ''}
                      onChange={e => setNewPacote(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Economia (R$)</Label>
                    <Input
                      type="number"
                      value={newPacote.economia || ''}
                      onChange={e => setNewPacote(prev => ({ ...prev, economia: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm">Serviços Incluídos</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={newPacoteServico} onValueChange={setNewPacoteServico}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar serviço" />
                    </SelectTrigger>
                    <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
                      {allServiceNames.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      {atendimentos.map(a => (
                        <SelectItem key={a.id} value={a.nome}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddServicoPacote} disabled={!newPacoteServico}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {newPacote.servicos.map((s, i) => (
                    <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded flex items-center gap-1">
                      {s}
                      <button onClick={() => handleRemoveServicoPacote(s)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm">Observação</Label>
                <Textarea
                  placeholder="Ex: Valor promocional para agendamento conjunto"
                  value={newPacote.observacao}
                  onChange={e => setNewPacote(prev => ({ ...prev, observacao: e.target.value }))}
                  rows={2}
                />
              </div>

              <Button 
                onClick={handleAddPacote} 
                disabled={!newPacote.nome.trim() || newPacote.servicos.length === 0}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Pacote
              </Button>
            </Card>
          </div>

          {/* Regras de Chegada */}
          <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <Label className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Regras de Chegada para Ficha
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Primeiro grupo do dia</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20"
                    value={config.regras_chegada?.primeiro_grupo_dia?.antecedencia_minutos || 30}
                    onChange={e => handleRegrasChegadaChange('primeiro_grupo_dia', parseInt(e.target.value) || 30)}
                  />
                  <span className="text-sm text-muted-foreground">minutos de antecedência</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Demais grupos</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20"
                    value={config.regras_chegada?.demais_grupos?.antecedencia_minutos || 15}
                    onChange={e => handleRegrasChegadaChange('demais_grupos', parseInt(e.target.value) || 15)}
                  />
                  <span className="text-sm text-muted-foreground">minutos de antecedência</span>
                </div>
              </div>
            </div>
          </div>

          {/* Entrega de Resultados */}
          <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
            <Label className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Prazos de Entrega de Resultados
            </Label>
            
            {/* Lista de prazos existentes */}
            <div className="space-y-2">
              {Object.entries(config.entrega_resultados || {}).map(([servico, dados]: [string, any]) => (
                <div key={servico} className="flex items-center gap-3 p-2 bg-background rounded">
                  <span className="flex-1 font-medium">{servico}</span>
                  <span className="text-muted-foreground">{dados.prazo_dias} dias</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveEntregaResultado(servico)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Adicionar novo prazo */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-sm">Serviço</Label>
                <Select value={newEntregaServico} onValueChange={setNewEntregaServico}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar serviço" />
                  </SelectTrigger>
                  <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
                    {allServiceNames
                      .filter(s => !Object.keys(config.entrega_resultados || {}).includes(s))
                      .map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    {atendimentos
                      .filter(a => !Object.keys(config.entrega_resultados || {}).includes(a.nome))
                      .map(a => (
                        <SelectItem key={a.id} value={a.nome}>{a.nome}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-sm">Prazo (dias)</Label>
                <Input
                  type="number"
                  value={newEntregaPrazo}
                  onChange={e => setNewEntregaPrazo(parseInt(e.target.value) || 30)}
                />
              </div>
              <Button onClick={handleAddEntregaResultado} disabled={!newEntregaServico}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Regras Avançadas */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAdvancedRules(!showAdvancedRules)}
              className="w-full justify-start gap-2"
            >
              <ShieldAlert className="h-4 w-4" />
              {showAdvancedRules ? '▼' : '►'} Regras Avançadas (Restrições, Pacotes Obrigatórios, Intervalos)
            </Button>
            {showAdvancedRules && (
              <AdvancedRulesSection
                config={config}
                atendimentos={atendimentos}
                conveniosDisponiveis={conveniosDisponiveis}
                onChange={setConfig}
              />
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
