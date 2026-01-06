-- Tabela de recursos/equipamentos compartilhados
CREATE TABLE recursos_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  descricao TEXT,
  limite_diario INTEGER DEFAULT 4,
  horario_instalacao TIME,
  ficha_inicio TIME,
  ficha_fim TIME,
  ativo BOOLEAN DEFAULT true,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de distribuição por dia/médico
CREATE TABLE distribuicao_recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id UUID NOT NULL REFERENCES recursos_equipamentos(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  quantidade INTEGER DEFAULT 1,
  periodo VARCHAR DEFAULT 'manha',
  horario_inicio TIME,
  ativo BOOLEAN DEFAULT true,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recurso_id, medico_id, dia_semana, periodo)
);

-- Enable RLS
ALTER TABLE recursos_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuicao_recursos ENABLE ROW LEVEL SECURITY;

-- Policies para recursos_equipamentos
CREATE POLICY "Recursos - visualizar da clínica"
ON recursos_equipamentos FOR SELECT
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Recursos - criar na clínica"
ON recursos_equipamentos FOR INSERT
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Recursos - atualizar da clínica"
ON recursos_equipamentos FOR UPDATE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Recursos - deletar da clínica"
ON recursos_equipamentos FOR DELETE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Super admin recursos_equipamentos"
ON recursos_equipamentos FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Policies para distribuicao_recursos
CREATE POLICY "Distribuicao - visualizar da clínica"
ON distribuicao_recursos FOR SELECT
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Distribuicao - criar na clínica"
ON distribuicao_recursos FOR INSERT
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Distribuicao - atualizar da clínica"
ON distribuicao_recursos FOR UPDATE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Distribuicao - deletar da clínica"
ON distribuicao_recursos FOR DELETE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Super admin distribuicao_recursos"
ON distribuicao_recursos FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Inserir recursos para EndoGastro (cliente_id da clínica)
INSERT INTO recursos_equipamentos (nome, descricao, limite_diario, horario_instalacao, ficha_inicio, ficha_fim, cliente_id)
SELECT 
  'MAPA',
  'Monitorização Ambulatorial da Pressão Arterial',
  4,
  '08:00'::TIME,
  '07:40'::TIME,
  '08:15'::TIME,
  id
FROM clientes WHERE nome ILIKE '%endogastro%' LIMIT 1;

INSERT INTO recursos_equipamentos (nome, descricao, limite_diario, horario_instalacao, ficha_inicio, ficha_fim, cliente_id)
SELECT 
  'HOLTER',
  'Holter 24 horas',
  2,
  '08:00'::TIME,
  '07:40'::TIME,
  '08:15'::TIME,
  id
FROM clientes WHERE nome ILIKE '%endogastro%' LIMIT 1;

INSERT INTO recursos_equipamentos (nome, descricao, limite_diario, horario_instalacao, ficha_inicio, ficha_fim, cliente_id)
SELECT 
  'ECG',
  'Eletrocardiograma',
  6,
  NULL,
  NULL,
  NULL,
  id
FROM clientes WHERE nome ILIKE '%endogastro%' LIMIT 1;

-- Inserir distribuição MAPA
-- Segunda: Dr. Max (2) + Dr. Diego (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 1, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 1, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Terça: Dr. Aristófilo (4)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 2, 4, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id;

-- Quarta: Dr. Max (2) + Dr. Heverson (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 3, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 3, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

-- Quinta: Dr. Diego (4)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 4, 4, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Sexta: Dr. Heverson (2) + Dr. Diego (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 5, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 5, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'MAPA' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Inserir distribuição HOLTER
-- Segunda: Dr. Max (1) + Dr. Diego (1)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 1, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 1, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Terça: Dr. Aristófilo (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 2, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id;

-- Quarta: Dr. Max (1) + Dr. Heverson (1)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 3, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 3, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

-- Quinta: Dr. Diego (2)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 4, 2, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Sexta: Dr. Heverson (1) + Dr. Diego (1)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 5, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, cliente_id)
SELECT r.id, m.id, 5, 1, 'integral', r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'HOLTER' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Inserir distribuição ECG
-- Segunda: Dr. Heverson (manhã) + Dr. Diego (tarde)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 1, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 1, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

-- Terça: Dr. Diego (manhã) + Dr. Max (tarde)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 2, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 2, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

-- Quarta: Dr. Aristófilo (integral)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 3, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 3, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%aristofilo%' AND r.cliente_id = m.cliente_id;

-- Quinta: Dr. Max (manhã) + Dr. Heverson (tarde)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 4, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%max koki%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 4, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%heverson%' AND r.cliente_id = m.cliente_id;

-- Sexta: Dr. Diego (integral)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 5, 3, 'manha', '08:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;

INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, cliente_id)
SELECT r.id, m.id, 5, 3, 'tarde', '14:00'::TIME, r.cliente_id
FROM recursos_equipamentos r, medicos m 
WHERE r.nome = 'ECG' AND m.nome ILIKE '%diego%' AND r.cliente_id = m.cliente_id;