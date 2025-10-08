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

  const generateSchedule = async (config: GenerationConfig, userClienteId: string): Promise<GenerationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ CORREÇÃO: Receber cliente_id como parâmetro (já validado no componente)
      if (!userClienteId) {
        throw new Error('Cliente ID não encontrado. Recarregue a página.');
      }

      console.log('🎯 Iniciando geração de horários:', {
        medico: config.medico_id,
        cliente_id: userClienteId,
        periodo: `${config.data_inicio} - ${config.data_fim}`,
        configs_ativas: config.configuracoes.length
      });

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
      console.log('📋 Buscando agendamentos existentes...');
      const { data: appointments, error: aptError } = await supabase
        .from('agendamentos')
        .select('data_agendamento, hora_agendamento')
        .eq('medico_id', config.medico_id)
        .gte('data_agendamento', config.data_inicio)
        .lte('data_agendamento', config.data_fim)
        .neq('status', 'cancelado');
      
      if (aptError) throw aptError;
      
      console.log(`✅ ${appointments?.length || 0} agendamentos existentes encontrados`);
      
      // 2. Gerar slots para cada configuração com cliente_id correto
      let allSlots: any[] = [];
      for (const scheduleConfig of config.configuracoes) {
        // ✅ CORREÇÃO 2: Garantir que cliente_id está presente em TODAS as configs
        const configWithClienteId = {
          ...scheduleConfig,
          cliente_id: userClienteId // Usar cliente_id do usuário logado
        };
        
        // ✅ FIX CRÍTICO: Usar toZonedTime com timezone do Brasil
        const startDateParsed = toZonedTime(parseISO(config.data_inicio + 'T12:00:00'), BRAZIL_TIMEZONE);
        const endDateParsed = toZonedTime(parseISO(config.data_fim + 'T12:00:00'), BRAZIL_TIMEZONE);
        
        console.log('🌍 Timezone Debug:', {
          data_inicio_string: config.data_inicio,
          data_inicio_parsed: startDateParsed,
          dia_semana_detectado: startDateParsed.getDay(),
          dia_semana_configurado: scheduleConfig.dia_semana,
          match: startDateParsed.getDay() === scheduleConfig.dia_semana
        });
        
        const slots = generateTimeSlotsForPeriod(
          configWithClienteId, // ✅ Usar config com cliente_id garantido
          startDateParsed,
          endDateParsed,
          appointments || []
        );
        console.log(`📅 Gerados ${slots.length} slots para ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][scheduleConfig.dia_semana]} (${scheduleConfig.periodo})`);
        allSlots = [...allSlots, ...slots];
      }
      
      console.log(`🔢 Total de slots gerados ANTES da inserção: ${allSlots.length}`);
      
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
      
      // 3. Inserir slots no banco (upsert para evitar duplicatas)
      console.log('💾 Inserindo slots no banco de dados...');
      const { data: inserted, error: insertError } = await supabase
        .from('horarios_vazios')
        .upsert(allSlots, { 
          onConflict: 'medico_id,data,hora,cliente_id',
          ignoreDuplicates: true 
        })
        .select();
      
      if (insertError) throw insertError;
      
      const insertedCount = inserted?.length || 0;
      const ignoredCount = allSlots.length - insertedCount;
      
      console.log(`✅ Inserção concluída:`, {
        inseridos: insertedCount,
        ignorados: ignoredCount,
        total: allSlots.length
      });
      
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
      console.error('❌ Erro ao gerar horários:', err);
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
    }
  };
  
  return { generateSchedule, loading, error };
}
