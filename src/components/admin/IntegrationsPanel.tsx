import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useStableAuth } from '@/hooks/useStableAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useClinicSecrets, SecretField } from '@/hooks/useClinicSecrets';

const FIELDS: { key: SecretField; label: string; placeholder: string }[] = [
  { key: 'chatwoot_api_token', label: 'Chatwoot API token',  placeholder: 'API token do agente Chatwoot' },
  { key: 'evolution_api_key',  label: 'Evolution API key',   placeholder: 'API key da Evolution API' },
  { key: 'openai_api_key',     label: 'OpenAI API key',      placeholder: 'sk-...' },
];

export const IntegrationsPanel: React.FC = () => {
  const { isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const effectiveClinicId = isClinicAdmin ? clinicAdminClienteId : selectedClinicId;

  const { data: clientes } = useQuery({
    queryKey: ['clientes-integ'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !isClinicAdmin,
  });

  const { query, save, clear } = useClinicSecrets(effectiveClinicId);
  const [drafts, setDrafts] = useState<Partial<Record<SecretField, string>>>({});
  const [show, setShow] = useState<Partial<Record<SecretField, boolean>>>({});

  const handleSave = async (field: SecretField) => {
    const v = (drafts[field] ?? '').trim();
    if (!v) {
      toast.error('Informe um valor antes de salvar.');
      return;
    }
    try {
      await save.mutateAsync({ [field]: v });
      setDrafts(prev => ({ ...prev, [field]: '' }));
      toast.success('Token salvo.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar token.');
    }
  };

  const handleClear = async (field: SecretField) => {
    if (!confirm('Remover este token? A integração correspondente vai parar de funcionar.')) return;
    try {
      await clear.mutateAsync(field);
      toast.success('Token removido.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover token.');
    }
  };

  return (
    <div className="space-y-4">
      {isAdmin && !isClinicAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">Selecionar Clínica</CardTitle></CardHeader>
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
          Selecione uma clínica para gerenciar integrações.
        </CardContent></Card>
      ) : query.isLoading ? (
        <Card><CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tokens de integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Os tokens são armazenados criptografados via Edge Function (service role). Após salvar,
              só o sufixo é exibido.
            </p>
            {FIELDS.map(({ key, label, placeholder }) => {
              const masked = query.data?.[key];
              const draftValue = drafts[key] ?? '';
              const isShown = !!show[key];
              return (
                <div key={key} className="space-y-2 border-b last:border-b-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`secret-${key}`}>{label}</Label>
                    {masked
                      ? <Badge variant="outline" className="text-[10px]">configurado: {masked}</Badge>
                      : <Badge variant="secondary" className="text-[10px]">não configurado</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`secret-${key}`}
                        type={isShown ? 'text' : 'password'}
                        autoComplete="off"
                        placeholder={placeholder}
                        value={draftValue}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShow(prev => ({ ...prev, [key]: !prev[key] }))}
                        title={isShown ? 'Ocultar' : 'Mostrar'}
                      >
                        {isShown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleSave(key)}
                      disabled={save.isPending || !draftValue.trim()}
                    >
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                    {masked && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleClear(key)}
                        disabled={clear.isPending}
                        title="Remover token"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
