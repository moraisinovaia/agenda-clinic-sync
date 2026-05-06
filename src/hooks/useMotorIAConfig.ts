import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

export type MotorIAConfig = Tables<'clinica_motor_config'>;

export function useMotorIAConfig(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['motor-ia-config', clienteId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from('clinica_motor_config')
        .select('*')
        .eq('id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return (data as MotorIAConfig | null);
    },
    enabled: !!clienteId,
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<TablesInsert<'clinica_motor_config'>>) => {
      if (!clienteId) throw new Error('cliente_id obrigatório');
      const payload: TablesInsert<'clinica_motor_config'> = {
        id: clienteId,
        nome_clinica: patch.nome_clinica ?? '',
        ...patch,
      };
      const { data, error } = await supabase
        .from('clinica_motor_config')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data as MotorIAConfig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { query, upsert };
}
