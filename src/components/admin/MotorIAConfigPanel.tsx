import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStableAuth } from '@/hooks/useStableAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useMotorIAConfig, MotorIAConfig } from '@/hooks/useMotorIAConfig';

interface FormState {
  nome_clinica: string;
  telefone_publico: string;
  api_cliente_id: string;
  cliente_id_agendamento: string;
  modelo_ia: string;
  prompt_sistema: string;
  prompt_agendamentos: string;
  transbordo_humano_ativo: boolean;
  mensagem_transbordo: string;
  chatwoot_url: string;
  chatwoot_account_id: string;
}

const emptyForm: FormState = {
  nome_clinica: '',
  telefone_publico: '',
  api_cliente_id: '',
  cliente_id_agendamento: '',
  modelo_ia: '',
  prompt_sistema: '',
  prompt_agendamentos: '',
  transbordo_humano_ativo: false,
  mensagem_transbordo: '',
  chatwoot_url: '',
  chatwoot_account_id: '',
};

const fromConfig = (c: MotorIAConfig | null): FormState => ({
  nome_clinica: c?.nome_clinica ?? '',
  telefone_publico: c?.telefone_publico ?? '',
  api_cliente_id: c?.api_cliente_id ?? '',
  cliente_id_agendamento: c?.cliente_id_agendamento ?? '',
  modelo_ia: c?.modelo_ia ?? '',
  prompt_sistema: c?.prompt_sistema ?? '',
  prompt_agendamentos: c?.prompt_agendamentos ?? '',
  transbordo_humano_ativo: c?.transbordo_humano_ativo ?? false,
  mensagem_transbordo: c?.mensagem_transbordo ?? '',
  chatwoot_url: c?.chatwoot_url ?? '',
  chatwoot_account_id: c?.chatwoot_account_id ?? '',
});

export const MotorIAConfigPanel: React.FC = () => {
  const { isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const effectiveClinicId = isClinicAdmin ? clinicAdminClienteId : selectedClinicId;

  const { data: clientes } = useQuery({
    queryKey: ['clientes-motor-ia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !isClinicAdmin,
  });

  const { query, upsert } = useMotorIAConfig(effectiveClinicId);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    setForm(fromConfig(query.data ?? null));
  }, [query.data]);

  const handleSave = async () => {
    if (!effectiveClinicId) {
      toast.error('Selecione uma clínica.');
      return;
    }
    if (!form.nome_clinica.trim()) {
      toast.error('Nome da clínica é obrigatório.');
      return;
    }
    try {
      await upsert.mutateAsync({
        nome_clinica: form.nome_clinica.trim(),
        telefone_publico: form.telefone_publico.trim() || null,
        api_cliente_id: form.api_cliente_id.trim() || null,
        cliente_id_agendamento: form.cliente_id_agendamento.trim() || null,
        modelo_ia: form.modelo_ia.trim() || null,
        prompt_sistema: form.prompt_sistema || null,
        prompt_agendamentos: form.prompt_agendamentos || null,
        transbordo_humano_ativo: form.transbordo_humano_ativo,
        mensagem_transbordo: form.mensagem_transbordo || null,
        chatwoot_url: form.chatwoot_url.trim() || null,
        chatwoot_account_id: form.chatwoot_account_id.trim() || null,
      });
      toast.success('Configuração do Motor IA salva.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar configuração.');
    }
  };

  return (
    <div className="space-y-4">
      {isAdmin && !isClinicAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selecionar Clínica</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full p-2 border rounded-md"
              value={selectedClinicId || ''}
              onChange={(e) => setSelectedClinicId(e.target.value || null)}
            >
              <option value="">— escolha uma clínica —</option>
              {clientes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {!effectiveClinicId ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma clínica para configurar o Motor IA.
        </CardContent></Card>
      ) : query.isLoading ? (
        <Card><CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_clinica">Nome da clínica *</Label>
                <Input id="nome_clinica" value={form.nome_clinica}
                  onChange={(e) => setForm(prev => ({ ...prev, nome_clinica: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone_publico">Telefone público</Label>
                <Input id="telefone_publico" value={form.telefone_publico}
                  onChange={(e) => setForm(prev => ({ ...prev, telefone_publico: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_cliente_id">API Cliente ID</Label>
                <Input id="api_cliente_id" value={form.api_cliente_id}
                  onChange={(e) => setForm(prev => ({ ...prev, api_cliente_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente_id_agendamento">Cliente ID (Agendamento)</Label>
                <Input id="cliente_id_agendamento" value={form.cliente_id_agendamento}
                  onChange={(e) => setForm(prev => ({ ...prev, cliente_id_agendamento: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">IA</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modelo_ia">Modelo</Label>
                <Input id="modelo_ia" value={form.modelo_ia}
                  placeholder="ex.: openrouter/anthropic/claude-sonnet-4-6"
                  onChange={(e) => setForm(prev => ({ ...prev, modelo_ia: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt_sistema">Prompt do sistema</Label>
                <Textarea id="prompt_sistema" rows={6} value={form.prompt_sistema}
                  onChange={(e) => setForm(prev => ({ ...prev, prompt_sistema: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt_agendamentos">Prompt de agendamentos</Label>
                <Textarea id="prompt_agendamentos" rows={6} value={form.prompt_agendamentos}
                  onChange={(e) => setForm(prev => ({ ...prev, prompt_agendamentos: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Transbordo humano</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="transbordo_humano_ativo">Habilitar transbordo</Label>
                <Switch id="transbordo_humano_ativo"
                  checked={form.transbordo_humano_ativo}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, transbordo_humano_ativo: v }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensagem_transbordo">Mensagem de transbordo</Label>
                <Textarea id="mensagem_transbordo" rows={3} value={form.mensagem_transbordo}
                  onChange={(e) => setForm(prev => ({ ...prev, mensagem_transbordo: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Chatwoot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chatwoot_url">URL</Label>
                  <Input id="chatwoot_url" value={form.chatwoot_url}
                    onChange={(e) => setForm(prev => ({ ...prev, chatwoot_url: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chatwoot_account_id">Account ID</Label>
                  <Input id="chatwoot_account_id" value={form.chatwoot_account_id}
                    onChange={(e) => setForm(prev => ({ ...prev, chatwoot_account_id: e.target.value }))} />
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-muted/30 space-y-1">
                <div className="text-sm font-medium">Status do provisionamento (read-only)</div>
                <div className="text-xs text-muted-foreground">
                  Inbox ID: {query.data?.chatwoot_inbox_id ? (
                    <Badge variant="outline">{query.data.chatwoot_inbox_id}</Badge>
                  ) : <span>—</span>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {query.data?.chatwoot_provisionado_em ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Provisionado em {new Date(query.data.chatwoot_provisionado_em).toLocaleString('pt-BR')}
                    </>
                  ) : query.data?.chatwoot_provisionamento_erro ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Erro: {query.data.chatwoot_provisionamento_erro}
                    </>
                  ) : (
                    <span>Aguardando provisionamento</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configuração
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
