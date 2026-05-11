import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SecretField = 'chatwoot_api_token' | 'evolution_api_key' | 'openai_api_key';

export interface MaskedSecrets {
  cliente_id: string;
  chatwoot_api_token: string | null;
  evolution_api_key:  string | null;
  openai_api_key:     string | null;
  updated_at: string | null;
}

export function useClinicSecrets(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['clinic-secrets', clienteId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase.functions.invoke<MaskedSecrets>(
        `manage-clinic-secrets?cliente_id=${encodeURIComponent(clienteId)}`,
        { method: 'GET' }
      );
      if (error) throw error;
      return (data as MaskedSecrets) ?? null;
    },
    enabled: !!clienteId,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Record<SecretField, string>>) => {
      if (!clienteId) throw new Error('cliente_id obrigatório');
      const { error } = await supabase.functions.invoke('manage-clinic-secrets', {
        method: 'POST',
        body: { cliente_id: clienteId, ...patch },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const clear = useMutation({
    mutationFn: async (field: SecretField) => {
      if (!clienteId) throw new Error('cliente_id obrigatório');
      const { error } = await supabase.functions.invoke(
        `manage-clinic-secrets?cliente_id=${encodeURIComponent(clienteId)}&field=${field}`,
        { method: 'DELETE' }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { query, save, clear };
}
