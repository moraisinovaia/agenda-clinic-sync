-- Tabela para log de notificações enviadas
CREATE TABLE IF NOT EXISTS public.notificacoes_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('bloqueio_agenda', 'confirmacao', 'lembrete', 'reagendamento')),
  mensagem TEXT NOT NULL,
  celular VARCHAR(20),
  status VARCHAR(20) DEFAULT 'enviado' CHECK (status IN ('enviado', 'erro', 'pendente')),
  erro TEXT,
  tentativas INTEGER DEFAULT 0,
  enviado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cliente_id UUID REFERENCES public.clientes(id)
);

-- Índices para performance
CREATE INDEX idx_notificacoes_agendamento ON public.notificacoes_enviadas(agendamento_id);
CREATE INDEX idx_notificacoes_tipo ON public.notificacoes_enviadas(tipo);
CREATE INDEX idx_notificacoes_status ON public.notificacoes_enviadas(status);
CREATE INDEX idx_notificacoes_enviado_em ON public.notificacoes_enviadas(enviado_em DESC);

-- RLS Policies
ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver notificações de seus clientes"
  ON public.notificacoes_enviadas FOR SELECT
  USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Sistema pode inserir notificações"
  ON public.notificacoes_enviadas FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.notificacoes_enviadas IS 'Registro de todas as notificações enviadas via WhatsApp';
COMMENT ON COLUMN public.notificacoes_enviadas.tipo IS 'Tipo de notificação: bloqueio_agenda, confirmacao, lembrete, reagendamento';
COMMENT ON COLUMN public.notificacoes_enviadas.status IS 'Status do envio: enviado, erro, pendente';