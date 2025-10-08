-- Tabela para armazenar configurações de horários dos médicos
CREATE TABLE horarios_configuracao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Domingo, 6=Sábado
  periodo VARCHAR(10) NOT NULL CHECK (periodo IN ('manha', 'tarde', 'noite')),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_minutos INTEGER DEFAULT 15 CHECK (intervalo_minutos IN (10, 15, 20, 30)),
  ativo BOOLEAN DEFAULT true,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(medico_id, dia_semana, periodo, cliente_id)
);

-- Index para performance
CREATE INDEX idx_horarios_config_medico ON horarios_configuracao(medico_id, ativo);

-- RLS Policies
ALTER TABLE horarios_configuracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários visualizam horários da sua clínica"
  ON horarios_configuracao FOR SELECT
  USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Usuários gerenciam horários da sua clínica"
  ON horarios_configuracao FOR ALL
  USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Super admin pode gerenciar todas configurações"
  ON horarios_configuracao FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Trigger para updated_at
CREATE TRIGGER update_horarios_configuracao_updated_at
  BEFORE UPDATE ON horarios_configuracao
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabela para armazenar horários vazios gerados
CREATE TABLE horarios_vazios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'expirado')),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(medico_id, data, hora, cliente_id)
);

-- Index composto para consultas rápidas
CREATE INDEX idx_horarios_vazios_medico_data ON horarios_vazios(medico_id, data, status);
CREATE INDEX idx_horarios_vazios_data ON horarios_vazios(data, status);

-- RLS Policies
ALTER TABLE horarios_vazios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários visualizam horários vazios da sua clínica"
  ON horarios_vazios FOR SELECT
  USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Usuários gerenciam horários vazios da sua clínica"
  ON horarios_vazios FOR ALL
  USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL)
  WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Super admin pode gerenciar todos horários vazios"
  ON horarios_vazios FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Trigger para updated_at
CREATE TRIGGER update_horarios_vazios_updated_at
  BEFORE UPDATE ON horarios_vazios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar slots expirados automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_slots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE horarios_vazios
  SET status = 'expirado'
  WHERE data < CURRENT_DATE
    AND status = 'disponivel';
END;
$$;