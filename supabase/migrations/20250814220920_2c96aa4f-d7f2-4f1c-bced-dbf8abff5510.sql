-- Criar tabela para logs de notificações WhatsApp
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  recipient VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  is_for_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
CREATE POLICY "Usuarios autenticados podem gerenciar notification_logs" 
ON public.notification_logs 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Função para enviar confirmação automática via WhatsApp
CREATE OR REPLACE FUNCTION public.enviar_confirmacao_whatsapp()
RETURNS TRIGGER AS $$
DECLARE
    v_paciente_record RECORD;
    v_medico_record RECORD;
    v_atendimento_record RECORD;
    v_celular TEXT;
    v_request_id UUID;
BEGIN
    -- Só processa se é um INSERT de agendamento com status 'agendado'
    IF TG_OP = 'INSERT' AND NEW.status = 'agendado' THEN
        
        -- Buscar dados do paciente
        SELECT nome_completo, celular INTO v_paciente_record
        FROM public.pacientes 
        WHERE id = NEW.paciente_id;
        
        -- Buscar dados do médico
        SELECT nome, especialidade INTO v_medico_record
        FROM public.medicos 
        WHERE id = NEW.medico_id;
        
        -- Buscar dados do atendimento
        SELECT nome, tipo INTO v_atendimento_record
        FROM public.atendimentos 
        WHERE id = NEW.atendimento_id;
        
        -- Validar se tem celular
        v_celular := TRIM(v_paciente_record.celular);
        
        IF v_celular IS NOT NULL AND v_celular != '' AND LENGTH(v_celular) >= 10 THEN
            -- Fazer chamada HTTP para edge function
            SELECT net.http_post(
                url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU"}'::jsonb,
                body := json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente_nome', v_paciente_record.nome_completo,
                    'paciente_celular', v_celular,
                    'medico_nome', v_medico_record.nome,
                    'atendimento_nome', v_atendimento_record.nome,
                    'data_agendamento', NEW.data_agendamento,
                    'hora_agendamento', NEW.hora_agendamento,
                    'observacoes', NEW.observacoes
                )::jsonb
            ) INTO v_request_id;
            
            -- Log da tentativa
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'info', 
                'Solicitação de confirmação WhatsApp enviada', 
                'AUTO_CONFIRMATION',
                json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente', v_paciente_record.nome_completo,
                    'celular', v_celular,
                    'request_id', v_request_id
                )::jsonb
            );
            
        ELSE
            -- Log de celular inválido
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'warning', 
                'Agendamento criado mas celular inválido para WhatsApp', 
                'AUTO_CONFIRMATION',
                json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente', v_paciente_record.nome_completo,
                    'celular', v_celular
                )::jsonb
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;