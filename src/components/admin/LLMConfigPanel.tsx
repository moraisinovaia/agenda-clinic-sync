import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Settings, Users, MessageSquare, Clock } from 'lucide-react';
import { useLLMConfig } from '@/hooks/useLLMConfig';
import { GeneralConfigTab } from './llm-config/GeneralConfigTab';
import { DoctorRulesTab } from './llm-config/DoctorRulesTab';
import { MessagesTab } from './llm-config/MessagesTab';
import { JoanaAgendaPanel } from './JoanaAgendaPanel';
import { useStableAuth } from '@/hooks/useStableAuth';

interface LLMConfigPanelProps {
  clienteId?: string;
}

export function LLMConfigPanel({ clienteId }: LLMConfigPanelProps) {
  const { profile, isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  
  // Determine effective cliente_id
  const effectiveClienteId = clienteId || (isClinicAdmin ? clinicAdminClienteId : profile?.cliente_id);
  
  const {
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
    deleteMensagem
  } = useLLMConfig(effectiveClienteId || null);

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

      {/* Tabs */}
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
    </div>
  );
}
