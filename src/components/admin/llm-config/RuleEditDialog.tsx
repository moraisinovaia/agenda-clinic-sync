import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Save, Loader2, Calendar, Settings } from 'lucide-react';
import { BusinessRule } from '@/hooks/useLLMConfig';
import { ServiceConfigForm } from './ServiceConfigForm';
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

  const effectiveClienteId = clienteId || profile?.cliente_id;

  // Fetch atendimentos when dialog opens
  useEffect(() => {
    const fetchAtendimentos = async () => {
      if (!effectiveClienteId) return;
      
      const { data } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo')
        .eq('cliente_id', effectiveClienteId)
        .eq('ativo', true)
        .order('nome');
      
      setAtendimentos(data || []);
    };

    if (open) {
      fetchAtendimentos();
    }
  }, [open, effectiveClienteId]);

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
