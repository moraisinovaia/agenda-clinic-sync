-- Tabela para auditoria de confirmações automáticas
CREATE TABLE IF NOT EXISTS public.confirmacoes_automaticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  tipo_notificacao TEXT NOT NULL CHECK (tipo_notificacao IN ('D-5', 'D-3', 'D-0', 'LEMBRETE')),
  data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mensagem_enviada TEXT,
  resposta_paciente TEXT,
  resposta_recebida_em TIMESTAMP WITH TIME ZONE,
  acao_tomada TEXT CHECK (acao_tomada IN ('confirmado', 'cancelado', 'sem_resposta', 'aguardando')),
  processado_em TIMESTAMP WITH TIME ZONE,
  tentativas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_confirmacoes_agendamento ON public.confirmacoes_automaticas(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_cliente ON public.confirmacoes_automaticas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tipo ON public.confirmacoes_automaticas(tipo_notificacao);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_acao ON public.confirmacoes_automaticas(acao_tomada);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data_envio ON public.confirmacoes_automaticas(data_envio);

-- RLS Policies
ALTER TABLE public.confirmacoes_automaticas ENABLE ROW LEVEL SECURITY;

-- Política para inserção (service role e autenticados)
CREATE POLICY "Permitir inserção de confirmações" ON public.confirmacoes_automaticas
  FOR INSERT WITH CHECK (true);

-- Política para leitura (apenas do próprio cliente)
CREATE POLICY "Usuários podem ver confirmações do próprio cliente" ON public.confirmacoes_automaticas
  FOR SELECT USING (
    cliente_id IN (
      SELECT cliente_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Política para atualização (service role e autenticados do cliente)
CREATE POLICY "Permitir atualização de confirmações" ON public.confirmacoes_automaticas
  FOR UPDATE USING (
    cliente_id IN (
      SELECT cliente_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_confirmacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_confirmacoes_updated_at
  BEFORE UPDATE ON public.confirmacoes_automaticas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_confirmacoes_updated_at();