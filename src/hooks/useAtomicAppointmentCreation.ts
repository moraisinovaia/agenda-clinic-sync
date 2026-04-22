import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SchedulingFormData } from '@/types/scheduling';
import { AtomicAppointmentResult } from '@/types/atomic-scheduling';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { formatPhone, isValidPhone } from '@/utils/phoneFormatter';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

// ⚡ FASE 8: Cache de profile para evitar queries repetidas
interface ProfileCache {
  nome: string;
  email: string;
  timestamp: number;
}

export function useAtomicAppointmentCreation() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // ⚡ FASE 8: Cache de profile por 5 minutos
  const profileCacheRef = useRef<ProfileCache | null>(null);
  const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // Função de delay para retry
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Validações básicas no frontend
  const validateFormData = (formData: SchedulingFormData) => {
    if (!formData.medicoId?.trim()) {
      throw new Error('Médico é obrigatório');
    }
    if (!formData.atendimentoId?.trim()) {
      throw new Error('Tipo de atendimento é obrigatório');
    }
    if (!formData.nomeCompleto?.trim()) {
      throw new Error('Nome completo é obrigatório');
    }
    if (formData.nomeCompleto.trim().length < 3) {
      throw new Error('Nome completo deve ter pelo menos 3 caracteres');
    }
    if (!formData.dataNascimento && !(formData.dataNascimentoOpcional ?? false)) {
      throw new Error('Data de nascimento é obrigatória');
    }
    if (!formData.convenio?.trim()) {
      throw new Error('Convênio é obrigatório');
    }
    if (!formData.celular?.trim()) {
      throw new Error('Celular é obrigatório');
    }
    
    // Validação de formato de celular brasileiro com normalização
    const normalizedCelular = formatPhone(formData.celular);
    if (!isValidPhone(normalizedCelular)) {
      throw new Error('Formato de celular inválido. Use o formato (XX) XXXXX-XXXX');
    }
    
    if (!formData.dataAgendamento) {
      throw new Error('Data do agendamento é obrigatória');
    }
    if (!formData.horaAgendamento) {
      throw new Error('Hora do agendamento é obrigatória');
    }
    
    // Validar se o usuário está autenticado
    if (!user?.id) {
      throw new Error('Usuário não está autenticado');
    }

    // Validações de negócio - usar timezone do Brasil
    const appointmentDateTime = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}`);
    
    // Obter horário atual no Brasil
    const nowBrazil = toZonedTime(new Date(), BRAZIL_TIMEZONE);
    const oneHourFromNowBrazil = new Date(nowBrazil.getTime() + 60 * 60 * 1000);
    
    // Converter horário do agendamento para o timezone do Brasil
    const appointmentDateTimeBrazil = toZonedTime(appointmentDateTime, BRAZIL_TIMEZONE);
    
    if (appointmentDateTimeBrazil <= oneHourFromNowBrazil) {
      const currentTimeFormatted = formatInTimeZone(nowBrazil, BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
      const requestedTimeFormatted = formatInTimeZone(appointmentDateTimeBrazil, BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
      throw new Error(`Agendamento deve ser feito com pelo menos 1 hora de antecedência. Horário atual do Brasil: ${currentTimeFormatted} - Agendamento solicitado: ${requestedTimeFormatted}`);
    }

    // Validar idade do paciente (only if birth date is provided)
    if (formData.dataNascimento) {
      const birthDate = new Date(formData.dataNascimento);
      const age = Math.floor((nowBrazil.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (age < 0 || age > 120) {
        throw new Error('Data de nascimento inválida');
      }
    }
  };

  // ✅ DEFINITIVO: Criar agendamento com função atômica com locks
  const createAppointment = useCallback(async (formData: SchedulingFormData, editingAppointmentId?: string, forceConflict = false): Promise<any> => {
    console.log('🚀🚀🚀 INÍCIO ABSOLUTO - createAppointment CHAMADO!', new Date().toISOString());
    console.log('📦 Dados recebidos:', { formData, editingAppointmentId, forceConflict, userId: user?.id });
    
    try {
      setLoading(true);
      console.log('🎯 useAtomicAppointmentCreation: Criando agendamento com função atômica definitiva');

      // Validações no frontend
      validateFormData(formData);

      // Validar autenticação
      if (!user?.id) {
        throw new Error('Usuário não está autenticado');
      }

      // ⚡ FASE 9: Usar cache ou user_metadata primeiro (evita query)
      let criadorNome = 'Recepcionista';
      const now = Date.now();
      
      // Tentar user_metadata primeiro (já disponível, zero queries)
      if (user.user_metadata?.nome) {
        criadorNome = user.user_metadata.nome;
        console.log('⚡ [JWT] Usando nome do user_metadata:', criadorNome);
      } else if (profileCacheRef.current && (now - profileCacheRef.current.timestamp) < PROFILE_CACHE_DURATION) {
        criadorNome = profileCacheRef.current.nome;
        console.log('♻️ [CACHE] Usando profile cacheado:', criadorNome);
      } else {
        // Fallback: buscar profile apenas se necessário
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('user_id', user.id)
          .single();

        if (profile?.nome) {
          profileCacheRef.current = { nome: profile.nome, email: profile.email || '', timestamp: now };
          criadorNome = profile.nome;
        }
      }

      // ⚡ FASE 9: Executar busca de médico e validação de limite EM PARALELO
      const [medicoResult, _] = await Promise.all([
        supabase.from('medicos').select('cliente_id').eq('id', formData.medicoId).single(),
        Promise.resolve() // Placeholder para futuras queries paralelas
      ]);
      
      const medicoData = medicoResult.data;

      // Validar limite de recursos (MAPA, HOLTER, ECG) - apenas se não for edição
      if (medicoData?.cliente_id && !editingAppointmentId) {
        const { data: limiteResult, error: limiteError } = await supabase.rpc('validar_limite_recurso', {
          p_atendimento_id: formData.atendimentoId,
          p_medico_id: formData.medicoId,
          p_data_agendamento: formData.dataAgendamento,
          p_cliente_id: medicoData.cliente_id
        });

        if (!limiteError && limiteResult && typeof limiteResult === 'object' && 'disponivel' in limiteResult) {
          const resultado = limiteResult as { disponivel: boolean; motivo?: string; recurso_nome?: string; vagas_usadas?: number; vagas_total?: number };
          if (!resultado.disponivel) {
            const resourceError = new Error(resultado.motivo || 'Limite de recurso atingido') as any;
            resourceError.isResourceLimit = true;
            resourceError.recursoNome = resultado.recurso_nome;
            resourceError.vagasUsadas = resultado.vagas_usadas;
            resourceError.vagasTotal = resultado.vagas_total;
            throw resourceError;
          }
        }
      }

      // Verificar limite de pacientes do tenant
      const { data: pacienteLimitResult } = await supabase.rpc('check_tenant_limit', { p_tipo: 'pacientes' } as any);
      if (pacienteLimitResult && typeof pacienteLimitResult === 'object' && 'allowed' in (pacienteLimitResult as any)) {
        const lr = pacienteLimitResult as any;
        if (!lr.allowed) {
          throw new Error(lr.message || `Limite de pacientes atingido (${lr.current}/${lr.max})`);
        }
      }

      // Chamar função SQL atômica COM LOCKS (uma única tentativa)
      const { data, error } = await supabase.rpc('criar_agendamento_atomico', {
        p_nome_completo: formData.nomeCompleto,
        p_data_nascimento: formData.dataNascimento || null,
        p_convenio: formData.convenio,
        p_telefone: formData.telefone || null,
        p_celular: formData.celular,
        p_medico_id: formData.medicoId,
        p_atendimento_id: formData.atendimentoId,
        p_data_agendamento: formData.dataAgendamento,
        p_hora_agendamento: formData.horaAgendamento,
        p_observacoes: formData.observacoes || null,
        p_criado_por: criadorNome,
        p_criado_por_user_id: user.id,
        p_agendamento_id_edicao: editingAppointmentId || null,
        p_force_conflict: forceConflict
      } as any);

      if (error) {
        console.error('❌ Erro na chamada da função:', error);
        throw error;
      }

      console.log('✅ Resultado da função:', data);

      // Verificar se a função retornou sucesso
      const result = data as unknown as AtomicAppointmentResult;
      if (!result?.success) {
        // Priorizar 'message' que agora contém o nome do paciente em conflitos
        const errorMessage = result?.message || result?.error || 'Erro desconhecido na criação do agendamento';
        console.log('❌ Função SQL retornou erro:', errorMessage);
        
        // ✅ DETECÇÃO DE CONFLITO: Verificar se é conflito específico (incluindo CONFLICT direto)
        if (result?.conflict_detected || result?.error === 'CONFLICT') {
          console.log('⚠️ Conflito detectado - criando erro especial para modal');
          const conflictError = new Error(errorMessage) as any;
          conflictError.isConflict = true;
          conflictError.conflictDetails = result?.conflict_details || result;
          throw conflictError;
        }
        
        // Para outros erros, comportamento normal (sem toast para validações)
        throw new Error(errorMessage);
      }

      // Sucesso!
      const isEditing = !!editingAppointmentId;
      
      // Verificar se há warnings
      if (result.warnings && result.warnings.length > 0) {
        // Mostrar toast com warnings
        toast({
          title: 'Agendamento criado com atenções!',
          description: `${isEditing ? 'Agendamento atualizado' : 'Agendamento criado'} para ${formData.dataAgendamento} às ${formData.horaAgendamento}. ${result.warnings.join('. ')}`,
          variant: 'default',
        });
      } else {
        // Toast normal de sucesso
        toast({
          title: 'Sucesso!',
          description: isEditing ? 
            `Agendamento atualizado para ${formData.dataAgendamento} às ${formData.horaAgendamento}` :
            `Agendamento criado para ${formData.dataAgendamento} às ${formData.horaAgendamento}`,
        });
      }

      console.log('✅ Agendamento criado com sucesso:', data);
      return data;

    } catch (error: any) {
      console.error('❌ Erro ao criar agendamento:', error);
      
      // Se o erro vem do backend e indica conflito, propagar com flag
      if (error?.message?.includes('conflito') || error?.message?.includes('ocupado') || 
          error?.conflict_detected) {
        const conflictError = new Error(error.message);
        (conflictError as any).isConflict = true;
        (conflictError as any).conflict_detected = true;
        throw conflictError;
      }
      
      // Se é erro de limite de recurso, mostrar toast específico
      if (error?.isResourceLimit) {
        toast({
          title: `Limite de ${error.recursoNome || 'recurso'} atingido`,
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      // Para warnings de idade, não tratar como erro fatal
      if (error?.warnings && Array.isArray(error.warnings)) {
        console.log('⚠️ Warnings detectados (idade):', error.warnings);
        // Ainda mostra warning mas permite continuar
      }
      
      // Para erros de validação críticos, não mostrar toast - deixar formulário preservado
      const isCriticalValidationError = error?.message?.includes('obrigatório') ||
          error?.message?.includes('inválido') ||
          error?.message?.includes('não está ativo');
      
      if (!isCriticalValidationError && !error?.isConflict && !error?.isResourceLimit) {
        toast({
          title: "Erro ao criar agendamento",
          description: error?.message || "Ocorreu um erro inesperado",
          variant: "destructive",
        });
      }
      
      throw error;
      
    } finally {
      // Garantir que o loading sempre seja resetado
      console.log('🏁 Resetando loading state...');
      setLoading(false);
    }
  }, [user?.id, toast]); // ✅ DEFINITIVO: Dependências estáveis

  return {
    loading,
    createAppointment,
  };
}