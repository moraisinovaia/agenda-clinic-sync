-- FASE 2: CRIAR TABELA DE MAPEAMENTO DE MÉDICOS E ATENDIMENTOS

-- Tabela temporária para mapeamento de médicos (histórico -> principal)
CREATE TABLE IF NOT EXISTS temp_medico_mapping (
  id SERIAL PRIMARY KEY,
  endogastro_medico_id UUID NOT NULL,
  endogastro_nome TEXT NOT NULL,
  principal_medico_id UUID,
  principal_nome TEXT,
  mapped BOOLEAN DEFAULT FALSE
);

-- Tabela temporária para mapeamento de atendimentos
CREATE TABLE IF NOT EXISTS temp_atendimento_mapping (
  id SERIAL PRIMARY KEY,
  endogastro_atendimento_id UUID NOT NULL,
  endogastro_nome TEXT NOT NULL,
  principal_atendimento_id UUID,
  principal_nome TEXT,
  mapped BOOLEAN DEFAULT FALSE
);