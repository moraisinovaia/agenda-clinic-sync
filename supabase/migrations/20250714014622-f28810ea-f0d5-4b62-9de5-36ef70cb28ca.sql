-- Add RLS policy for valores_procedimentos table
ALTER TABLE public.valores_procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "valores_procedimentos_read_all" 
ON public.valores_procedimentos 
FOR SELECT 
USING (true);

CREATE POLICY "valores_procedimentos_modify_authenticated" 
ON public.valores_procedimentos 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora 
ON public.agendamentos (data_agendamento, hora_agendamento);

CREATE INDEX IF NOT EXISTS idx_agendamentos_medico_data 
ON public.agendamentos (medico_id, data_agendamento);

CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
ON public.agendamentos (status);

CREATE INDEX IF NOT EXISTS idx_pacientes_convenio 
ON public.pacientes (convenio);

CREATE INDEX IF NOT EXISTS idx_fila_espera_status_prioridade 
ON public.fila_espera (status, prioridade DESC, created_at ASC);