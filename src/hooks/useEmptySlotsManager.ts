import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmptySlot {
  id: string;
  medico_id: string;
  data: string;
  hora: string;
  status: string;
  created_at: string;
}

export function useEmptySlotsManager() {
  const [loading, setLoading] = useState(false);

  const fetchEmptySlots = async (
    medicoId: string,
    startDate?: string,
    endDate?: string
  ): Promise<EmptySlot[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('horarios_vazios')
        .select('*')
        .eq('medico_id', medicoId)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (startDate) {
        query = query.gte('data', startDate);
      }

      if (endDate) {
        query = query.lte('data', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar horários vazios:', error);
      toast.error('Erro ao buscar horários');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const deleteSlot = async (slotId: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('horarios_vazios')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      toast.success('Horário removido com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao deletar slot:', error);
      toast.error('Erro ao remover horário');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteSlotsForDate = async (
    medicoId: string,
    date: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('horarios_vazios')
        .delete()
        .eq('medico_id', medicoId)
        .eq('data', date);

      if (error) throw error;

      toast.success('Todos os horários do dia foram removidos');
      return true;
    } catch (error) {
      console.error('Erro ao deletar slots da data:', error);
      toast.error('Erro ao remover horários do dia');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteSlotsForPeriod = async (
    medicoId: string,
    startDate: string,
    endDate: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('horarios_vazios')
        .delete()
        .eq('medico_id', medicoId)
        .gte('data', startDate)
        .lte('data', endDate);

      if (error) throw error;

      toast.success('Todos os horários do período foram removidos');
      return true;
    } catch (error) {
      console.error('Erro ao deletar slots do período:', error);
      toast.error('Erro ao remover horários do período');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchEmptySlots,
    deleteSlot,
    deleteSlotsForDate,
    deleteSlotsForPeriod
  };
}
