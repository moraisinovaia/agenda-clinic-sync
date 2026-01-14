import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bot, Settings, Users, MessageSquare, Clock, Building2, Plus, Phone } from 'lucide-react';
import { useLLMConfig } from '@/hooks/useLLMConfig';
import { GeneralConfigTab } from './llm-config/GeneralConfigTab';
import { DoctorRulesTab } from './llm-config/DoctorRulesTab';
import { MessagesTab } from './llm-config/MessagesTab';
import { JoanaAgendaPanel } from './JoanaAgendaPanel';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LLMConfigPanelProps {
  clienteId?: string;
}

export function LLMConfigPanel({ clienteId }: LLMConfigPanelProps) {
  const { profile, isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const [showNewConfigDialog, setShowNewConfigDialog] = useState(false);
  const [newConfigData, setNewConfigData] = useState({
    nome_clinica: '',
    whatsapp: '',
    telefone: '',
    endereco: ''
  });
  
  // Determine effective cliente_id
  const effectiveClienteId = clienteId || (isClinicAdmin ? clinicAdminClienteId : profile?.cliente_id);
  
  const {
    allConfigs,
    selectedConfigId,
    setSelectedConfigId,
    clinicConfig,
    businessRules,
    mensagens,
    medicos,
    loading,
    saving,
    saveClinicConfig,
    saveBusinessRule,
    deleteBusinessRule,
    saveMensagem,
    deleteMensagem,
    createNewConfig
  } = useLLMConfig(effectiveClienteId || null);

  const handleCreateNewConfig = async () => {
    if (!newConfigData.nome_clinica.trim()) return;
    
    const success = await createNewConfig(newConfigData);
    if (success) {
      setShowNewConfigDialog(false);
      setNewConfigData({ nome_clinica: '', whatsapp: '', telefone: '', endereco: '' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Configuração LLM API</h2>
            <p className="text-muted-foreground">
              Configure o agente de IA para agendamentos via WhatsApp/N8N
            </p>
          </div>
        </div>
        
        {/* Config Selector */}
        {allConfigs.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedConfigId || ''} onValueChange={setSelectedConfigId}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Selecione a configuração" />
              </SelectTrigger>
              <SelectContent>
                {allConfigs.map(config => (
                  <SelectItem key={config.id} value={config.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{config.nome_clinica}</span>
                      {config.whatsapp && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {config.whatsapp}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={() => setShowNewConfigDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Selected Config Info */}
      {clinicConfig && allConfigs.length > 1 && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="bg-background">
                <Building2 className="h-3 w-3 mr-1" />
                {clinicConfig.nome_clinica}
              </Badge>
              {clinicConfig.whatsapp && (
                <span className="text-muted-foreground">
                  WhatsApp: <strong>{clinicConfig.whatsapp}</strong>
                </span>
              )}
              {clinicConfig.telefone && (
                <span className="text-muted-foreground">
                  Tel: <strong>{clinicConfig.telefone}</strong>
                </span>
              )}
              <Badge variant="secondary">
                {businessRules.length} regra{businessRules.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary">
                {mensagens.length} mensagem{mensagens.length !== 1 ? 'ns' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No configs message */}
      {allConfigs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhuma configuração LLM encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie uma configuração para começar a usar o agente de IA.
            </p>
            <Button onClick={() => setShowNewConfigDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Configuração
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs - Only show if we have a selected config */}
      {selectedConfigId && (
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Config. Geral
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Regras por Médico
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="joana" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Agenda Joana
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <GeneralConfigTab
              config={clinicConfig}
              saving={saving}
              onSave={saveClinicConfig}
            />
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <DoctorRulesTab
              businessRules={businessRules}
              medicos={medicos}
              saving={saving}
              onSave={saveBusinessRule}
              onDelete={deleteBusinessRule}
            />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <MessagesTab
              mensagens={mensagens}
              medicos={medicos}
              saving={saving}
              onSave={saveMensagem}
              onDelete={deleteMensagem}
            />
          </TabsContent>

          <TabsContent value="joana" className="mt-6">
            <JoanaAgendaPanel />
          </TabsContent>
        </Tabs>
      )}

      {/* New Config Dialog */}
      <Dialog open={showNewConfigDialog} onOpenChange={setShowNewConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Configuração LLM</DialogTitle>
            <DialogDescription>
              Crie uma nova configuração para uma clínica ou unidade
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome_clinica">Nome da Clínica *</Label>
              <Input
                id="nome_clinica"
                value={newConfigData.nome_clinica}
                onChange={e => setNewConfigData(prev => ({ ...prev, nome_clinica: e.target.value }))}
                placeholder="Ex: Clínica Orion"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={newConfigData.whatsapp}
                  onChange={e => setNewConfigData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="Ex: (87) 98150-0808"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={newConfigData.telefone}
                  onChange={e => setNewConfigData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="Ex: (87) 3024-1274"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={newConfigData.endereco}
                onChange={e => setNewConfigData(prev => ({ ...prev, endereco: e.target.value }))}
                placeholder="Ex: Rua X, 123 - Centro"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowNewConfigDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNewConfig} 
              disabled={saving || !newConfigData.nome_clinica.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
