import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { GenerationConfig, GenerationResult } from '@/types/schedule-generator';
import { generateTimeSlotsForPeriod, validateScheduleConfig } from '@/utils/scheduleGenerator';

export function useScheduleGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  const generateSchedule = async (config: GenerationConfig, userClienteId: string): Promise<GenerationResult> => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: config.configuracoes.length, message: 'Iniciando...' });
    
    try {
      // ✅ CORREÇÃO: Receber cliente_id como parâmetro (já validado no componente)
      if (!userClienteId) {
        throw new Error('Cliente ID não encontrado. Recarregue a página.');
      }

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
      setProgress(prev => ({ ...prev, message: 'Buscando agendamentos existentes...' }));
      const { data: appointments, error: aptError } = await supabase
        .from('agendamentos')
        .select('data_agendamento, hora_agendamento')
        .eq('medico_id', config.medico_id)
        .gte('data_agendamento', config.data_inicio)
        .lte('data_agendamento', config.data_fim)
        .neq('status', 'cancelado');
      
      if (aptError) throw aptError;
      
      // 2. Gerar slots para cada configuração com cliente_id correto
      let allSlots: any[] = [];
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      for (let i = 0; i < config.configuracoes.length; i++) {
        const scheduleConfig = config.configuracoes[i];
        setProgress({
          current: i + 1,
          total: config.configuracoes.length,
          message: `Gerando slots para ${dayNames[scheduleConfig.dia_semana]}...`
        });
        // ✅ CORREÇÃO 2: Garantir que cliente_id está presente em TODAS as configs
        const configWithClienteId = {
          ...scheduleConfig,
          cliente_id: userClienteId // Usar cliente_id do usuário logado
        };
        
        const startDateParsed = toZonedTime(parseISO(config.data_inicio + 'T12:00:00'), BRAZIL_TIMEZONE);
        const endDateParsed = toZonedTime(parseISO(config.data_fim + 'T12:00:00'), BRAZIL_TIMEZONE);
        
        const slots = generateTimeSlotsForPeriod(
          configWithClienteId, // ✅ Usar config com cliente_id garantido
          startDateParsed,
          endDateParsed,
          appointments || []
        );
        allSlots = [...allSlots, ...slots];
      }
      
      setProgress(prev => ({ ...prev, message: 'Salvando no banco de dados...' }));
      
      if (allSlots.length === 0) {
        toast.warning(
          '⚠️ Nenhum horário foi gerado!\n\nPossíveis motivos:\n• Não há dias da semana configurados no período selecionado\n• Todos os horários já estão ocupados',
          { duration: 5000 }
        );
        
        return {
          success: true,
          slots_criados: 0,
          slots_ignorados: 0,
          errors: ['Nenhum slot gerado - verifique a configuração']
        };
      }
      
      // 3. Inserir slots no banco em lotes para evitar timeout
      const BATCH_SIZE = 500;
      let insertedCount = 0;
      
      for (let i = 0; i < allSlots.length; i += BATCH_SIZE) {
        const batch = allSlots.slice(i, i + BATCH_SIZE);
        setProgress(prev => ({ ...prev, message: `Salvando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allSlots.length / BATCH_SIZE)}...` }));
        
        const { data: inserted, error: insertError } = await supabase
          .from('horarios_vazios')
          .upsert(batch, { 
            onConflict: 'medico_id,data,hora,cliente_id',
            ignoreDuplicates: true 
          })
          .select();
        
        if (insertError) throw insertError;
        insertedCount += inserted?.length || 0;
      }
      
      const ignoredCount = allSlots.length - insertedCount;
      
      if (insertedCount === 0 && ignoredCount > 0) {
        toast.info(
          `ℹ️ Todos os ${ignoredCount} horários já existiam na agenda!`,
          { duration: 4000 }
        );
      } else {
        toast.success(
          `✅ ${insertedCount} horários gerados com sucesso! ${ignoredCount > 0 ? `(${ignoredCount} já existiam)` : ''}`,
          { duration: 4000 }
        );
      }
      
      return {
        success: true,
        slots_criados: insertedCount,
        slots_ignorados: ignoredCount
      };
      
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao gerar horários';
      setError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
      
      return {
        success: false,
        slots_criados: 0,
        slots_ignorados: 0,
        errors: [errorMsg]
      };
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };
  
  return { generateSchedule, loading, error, progress };
}
