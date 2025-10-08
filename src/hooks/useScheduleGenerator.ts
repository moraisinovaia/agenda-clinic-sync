import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GenerationConfig, GenerationResult } from '@/types/schedule-generator';
import { generateTimeSlotsForPeriod, validateScheduleConfig } from '@/utils/scheduleGenerator';

export function useScheduleGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSchedule = async (config: GenerationConfig): Promise<GenerationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Validar configurações
      const validationErrors: string[] = [];
      config.configuracoes.forEach((cfg, idx) => {
        const errors = validateScheduleConfig(cfg);
        if (errors.length > 0) {
          validationErrors.push(`Config ${idx + 1}: ${errors.join(', ')}`);
        }
      });
      
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }
      
      // 1. Buscar agendamentos existentes no período (CRÍTICO para não sobrescrever)
      const { data: appointments, error: aptError } = await supabase
        .from('agendamentos')
        .select('data_agendamento, hora_agendamento')
        .eq('medico_id', config.medico_id)
        .gte('data_agendamento', config.data_inicio)
        .lte('data_agendamento', config.data_fim)
        .neq('status', 'cancelado');
      
      if (aptError) throw aptError;
      
      // 2. Gerar slots para cada configuração
      let allSlots: any[] = [];
      for (const scheduleConfig of config.configuracoes) {
        const slots = generateTimeSlotsForPeriod(
          scheduleConfig,
          new Date(config.data_inicio),
          new Date(config.data_fim),
          appointments || []
        );
        allSlots = [...allSlots, ...slots];
      }
      
      // 3. Inserir slots no banco (upsert para evitar duplicatas)
      let insertedCount = 0;
      if (allSlots.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('horarios_vazios')
          .upsert(allSlots, { 
            onConflict: 'medico_id,data,hora,cliente_id',
            ignoreDuplicates: true 
          })
          .select();
        
        if (insertError) throw insertError;
        insertedCount = inserted?.length || 0;
      }
      
      const ignoredCount = allSlots.length - insertedCount;
      
      toast.success(
        `${insertedCount} horários gerados! ${ignoredCount > 0 ? `(${ignoredCount} já existiam)` : ''}`
      );
      
      return {
        success: true,
        slots_criados: insertedCount,
        slots_ignorados: ignoredCount
      };
      
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao gerar horários';
      setError(errorMsg);
      toast.error(errorMsg);
      
      return {
        success: false,
        slots_criados: 0,
        slots_ignorados: 0,
        errors: [errorMsg]
      };
    } finally {
      setLoading(false);
    }
  };
  
  return { generateSchedule, loading, error };
}
