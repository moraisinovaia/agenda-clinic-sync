import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type ConvenioMedico = Tables<'convenios_medico'>;
export type ConvenioMedicoTipo = ConvenioMedico['tipo'];

export const CONVENIO_TIPOS: { value: ConvenioMedicoTipo; label: string; descricao: string }[] = [
  { value: 'informativo',          label: 'Informativo',          descricao: 'Aceita o convênio sem restrições especiais.' },
  { value: 'apenas_consulta',      label: 'Apenas consulta',      descricao: 'Apenas consultas; exames/procedimentos pelo convênio precisam ser tratados fora.' },
  { value: 'apenas_exame',         label: 'Apenas exame',         descricao: 'Apenas exames; consultas pelo convênio precisam ser tratadas fora.' },
  { value: 'agendamento_externo',  label: 'Agendamento externo',  descricao: 'Paciente precisa marcar por outro canal (operadora ou central).' },
  { value: 'bloqueado',            label: 'Bloqueado',            descricao: 'Convênio listado para informar o paciente que NÃO é atendido.' },
];

export function useConveniosMedico(medicoId: string | null | undefined, clienteId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['convenios-medico', medicoId];

  const list = useQuery({
    queryKey,
    queryFn: async () => {
      if (!medicoId) return [] as ConvenioMedico[];
      const { data, error } = await supabase
        .from('convenios_medico')
        .select('*')
        .eq('medico_id', medicoId)
        .order('convenio_nome');
      if (error) throw error;
      return (data || []) as ConvenioMedico[];
    },
    enabled: !!medicoId,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<TablesInsert<'convenios_medico'>, 'medico_id' | 'cliente_id'>) => {
      if (!medicoId || !clienteId) throw new Error('medico_id e cliente_id obrigatórios');
      const { data, error } = await supabase
        .from('convenios_medico')
        .insert({ ...input, medico_id: medicoId, cliente_id: clienteId })
        .select()
        .single();
      if (error) throw error;
      return data as ConvenioMedico;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'convenios_medico'> }) => {
      const { error } = await supabase
        .from('convenios_medico')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('convenios_medico')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { list, create, update, remove };
}
