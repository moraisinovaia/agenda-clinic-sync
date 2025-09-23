-- ============================================================================
-- MIGRAÇÃO ENDOGASTRO: Arquivar dados históricos e limpar tabelas principais
-- ============================================================================

-- 1. CRIAR TABELAS DE ARQUIVO
-- ----------------------------------------------------------------------------

-- Tabela para arquivar médicos históricos
CREATE TABLE public.endogastro_medicos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  nome character varying NOT NULL,
  especialidade character varying NOT NULL,
  convenios_aceitos text[],
  idade_minima integer DEFAULT 0,
  idade_maxima integer,
  convenios_restricoes jsonb,
  horarios jsonb,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  -- Campos de controle histórico
  migrado_em timestamp with time zone DEFAULT now(),
  motivo_migracao text DEFAULT 'Migração para nova estrutura da clínica',
  sistema_origem text DEFAULT 'endogastro_original',
  medico_id_original uuid NOT NULL, -- Referência ao ID original
  PRIMARY KEY (id)
);

-- Tabela para arquivar pacientes históricos
CREATE TABLE public.endogastro_pacientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  nome_completo character varying NOT NULL,
  data_nascimento date NOT NULL,
  convenio character varying NOT NULL,
  telefone character varying,
  celular character varying DEFAULT '',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Campos de controle histórico
  migrado_em timestamp with time zone DEFAULT now(),
  motivo_migracao text DEFAULT 'Migração para nova estrutura da clínica',
  sistema_origem text DEFAULT 'endogastro_original',
  paciente_id_original uuid NOT NULL, -- Referência ao ID original
  PRIMARY KEY (id)
);

-- Tabela para arquivar agendamentos históricos
CREATE TABLE public.endogastro_agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  paciente_id uuid NOT NULL, -- Referência para endogastro_pacientes
  medico_id uuid NOT NULL, -- Referência para endogastro_medicos
  atendimento_id uuid NOT NULL,
  data_agendamento date NOT NULL,
  hora_agendamento time without time zone NOT NULL,
  status character varying DEFAULT 'agendado',
  convenio character varying,
  observacoes text,
  criado_por text DEFAULT 'recepcionista',
  criado_por_user_id uuid,
  confirmado_por text,
  confirmado_por_user_id uuid,
  confirmado_em timestamp with time zone,
  cancelado_por text,
  cancelado_por_user_id uuid,
  cancelado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Campos de controle histórico
  migrado_em timestamp with time zone DEFAULT now(),
  motivo_migracao text DEFAULT 'Migração para nova estrutura da clínica',
  sistema_origem text DEFAULT 'endogastro_original',
  agendamento_id_original uuid NOT NULL, -- Referência ao ID original
  PRIMARY KEY (id)
);

-- Tabela para arquivar fila de espera histórica
CREATE TABLE public.endogastro_fila_espera (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  paciente_id uuid NOT NULL, -- Referência para endogastro_pacientes
  medico_id uuid NOT NULL, -- Referência para endogastro_medicos
  atendimento_id uuid NOT NULL,
  data_preferida date NOT NULL,
  periodo_preferido character varying DEFAULT 'qualquer',
  observacoes text,
  prioridade integer DEFAULT 1,
  data_limite date,
  status character varying DEFAULT 'aguardando',
  agendamento_id uuid,
  ultimo_contato timestamp with time zone,
  tentativas_contato integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Campos de controle histórico
  migrado_em timestamp with time zone DEFAULT now(),
  motivo_migracao text DEFAULT 'Migração para nova estrutura da clínica',
  sistema_origem text DEFAULT 'endogastro_original',
  fila_id_original uuid NOT NULL, -- Referência ao ID original
  PRIMARY KEY (id)
);

-- Tabela para arquivar bloqueios de agenda históricos
CREATE TABLE public.endogastro_bloqueios_agenda (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  medico_id uuid NOT NULL, -- Referência para endogastro_medicos
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL,
  status character varying DEFAULT 'ativo',
  criado_por text DEFAULT 'recepcionista',
  criado_por_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Campos de controle histórico
  migrado_em timestamp with time zone DEFAULT now(),
  motivo_migracao text DEFAULT 'Migração para nova estrutura da clínica',
  sistema_origem text DEFAULT 'endogastro_original',
  bloqueio_id_original uuid NOT NULL, -- Referência ao ID original
  PRIMARY KEY (id)
);

-- 2. HABILITAR RLS NAS TABELAS DE ARQUIVO
-- ----------------------------------------------------------------------------

ALTER TABLE public.endogastro_medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endogastro_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endogastro_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endogastro_fila_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endogastro_bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR POLÍTICAS RLS PARA TABELAS DE ARQUIVO
-- ----------------------------------------------------------------------------

-- Políticas para endogastro_medicos
CREATE POLICY "Endogastro médicos - visualizar da clínica" ON public.endogastro_medicos
  FOR SELECT USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Super admin pode ver todos os médicos históricos" ON public.endogastro_medicos
  FOR ALL USING (is_super_admin());

-- Políticas para endogastro_pacientes
CREATE POLICY "Endogastro pacientes - visualizar da clínica" ON public.endogastro_pacientes
  FOR SELECT USING ((cliente_id = get_user_cliente_id()) AND (auth.uid() IS NOT NULL));

CREATE POLICY "Super admin pode ver todos os pacientes históricos" ON public.endogastro_pacientes
  FOR SELECT USING (is_super_admin());

-- Políticas para endogastro_agendamentos
CREATE POLICY "Endogastro agendamentos - visualizar da clínica" ON public.endogastro_agendamentos
  FOR SELECT USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Super admin pode ver todos os agendamentos históricos" ON public.endogastro_agendamentos
  FOR SELECT USING (is_super_admin());

-- Políticas para endogastro_fila_espera
CREATE POLICY "Endogastro fila espera - visualizar da clínica" ON public.endogastro_fila_espera
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin pode ver toda fila espera histórica" ON public.endogastro_fila_espera
  FOR SELECT USING (is_super_admin());

-- Políticas para endogastro_bloqueios_agenda
CREATE POLICY "Endogastro bloqueios - visualizar da clínica" ON public.endogastro_bloqueios_agenda
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin pode ver todos os bloqueios históricos" ON public.endogastro_bloqueios_agenda
  FOR SELECT USING (is_super_admin());

-- 4. MIGRAR DADOS PRESERVANDO RELACIONAMENTOS
-- ----------------------------------------------------------------------------

-- Migrar médicos (primeiro)
INSERT INTO public.endogastro_medicos (
  cliente_id, nome, especialidade, convenios_aceitos, idade_minima, idade_maxima,
  convenios_restricoes, horarios, observacoes, ativo, created_at, medico_id_original
)
SELECT 
  cliente_id, nome, especialidade, convenios_aceitos, idade_minima, idade_maxima,
  convenios_restricoes, horarios, observacoes, ativo, created_at, id
FROM public.medicos;

-- Migrar pacientes (segundo)
INSERT INTO public.endogastro_pacientes (
  cliente_id, nome_completo, data_nascimento, convenio, telefone, celular,
  created_at, updated_at, paciente_id_original
)
SELECT 
  cliente_id, nome_completo, data_nascimento, convenio, telefone, celular,
  created_at, updated_at, id
FROM public.pacientes;

-- Migrar agendamentos (terceiro) - atualizando referências
INSERT INTO public.endogastro_agendamentos (
  cliente_id, paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
  status, convenio, observacoes, criado_por, criado_por_user_id, confirmado_por,
  confirmado_por_user_id, confirmado_em, cancelado_por, cancelado_por_user_id,
  cancelado_em, created_at, updated_at, agendamento_id_original
)
SELECT 
  a.cliente_id,
  ep.id as paciente_id, -- Nova referência para endogastro_pacientes
  em.id as medico_id,   -- Nova referência para endogastro_medicos
  a.atendimento_id, a.data_agendamento, a.hora_agendamento,
  a.status, a.convenio, a.observacoes, a.criado_por, a.criado_por_user_id,
  a.confirmado_por, a.confirmado_por_user_id, a.confirmado_em, a.cancelado_por,
  a.cancelado_por_user_id, a.cancelado_em, a.created_at, a.updated_at, a.id
FROM public.agendamentos a
JOIN public.endogastro_pacientes ep ON ep.paciente_id_original = a.paciente_id
JOIN public.endogastro_medicos em ON em.medico_id_original = a.medico_id;

-- Migrar fila de espera (quarto) - atualizando referências
INSERT INTO public.endogastro_fila_espera (
  cliente_id, paciente_id, medico_id, atendimento_id, data_preferida, periodo_preferido,
  observacoes, prioridade, data_limite, status, agendamento_id, ultimo_contato,
  tentativas_contato, created_at, updated_at, fila_id_original
)
SELECT 
  f.cliente_id,
  ep.id as paciente_id, -- Nova referência para endogastro_pacientes
  em.id as medico_id,   -- Nova referência para endogastro_medicos
  f.atendimento_id, f.data_preferida, f.periodo_preferido, f.observacoes,
  f.prioridade, f.data_limite, f.status, f.agendamento_id, f.ultimo_contato,
  f.tentativas_contato, f.created_at, f.updated_at, f.id
FROM public.fila_espera f
JOIN public.endogastro_pacientes ep ON ep.paciente_id_original = f.paciente_id
JOIN public.endogastro_medicos em ON em.medico_id_original = f.medico_id;

-- Migrar bloqueios de agenda (quinto) - atualizando referências
INSERT INTO public.endogastro_bloqueios_agenda (
  cliente_id, medico_id, data_inicio, data_fim, motivo, status, criado_por,
  criado_por_user_id, created_at, updated_at, bloqueio_id_original
)
SELECT 
  b.cliente_id,
  em.id as medico_id, -- Nova referência para endogastro_medicos
  b.data_inicio, b.data_fim, b.motivo, b.status, b.criado_por,
  b.criado_por_user_id, b.created_at, b.updated_at, b.id
FROM public.bloqueios_agenda b
JOIN public.endogastro_medicos em ON em.medico_id_original = b.medico_id;

-- 5. CRIAR VIEWS PARA CONSULTA HISTÓRICA
-- ----------------------------------------------------------------------------

-- View unificada para consultar histórico completo
CREATE OR REPLACE VIEW public.v_historico_endogastro AS
SELECT 
  ea.id as agendamento_id,
  ea.data_agendamento,
  ea.hora_agendamento,
  ea.status,
  ea.convenio,
  ea.observacoes,
  ep.nome_completo as paciente_nome,
  ep.data_nascimento as paciente_nascimento,
  ep.celular as paciente_celular,
  em.nome as medico_nome,
  em.especialidade as medico_especialidade,
  ea.migrado_em,
  ea.sistema_origem,
  ea.created_at as agendamento_criado_em
FROM public.endogastro_agendamentos ea
JOIN public.endogastro_pacientes ep ON ea.paciente_id = ep.id
JOIN public.endogastro_medicos em ON ea.medico_id = em.id
ORDER BY ea.data_agendamento DESC, ea.hora_agendamento DESC;

-- 6. CRIAR FUNÇÃO PARA BUSCAR DADOS HISTÓRICOS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.buscar_historico_endogastro(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_medico_nome TEXT DEFAULT NULL,
  p_paciente_nome TEXT DEFAULT NULL
)
RETURNS TABLE (
  agendamento_id UUID,
  data_agendamento DATE,
  hora_agendamento TIME,
  status TEXT,
  paciente_nome TEXT,
  medico_nome TEXT,
  especialidade TEXT,
  convenio TEXT,
  observacoes TEXT,
  migrado_em TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.agendamento_id,
    v.data_agendamento,
    v.hora_agendamento,
    v.status,
    v.paciente_nome,
    v.medico_nome,
    v.medico_especialidade,
    v.convenio,
    v.observacoes,
    v.migrado_em
  FROM public.v_historico_endogastro v
  WHERE 
    (p_data_inicio IS NULL OR v.data_agendamento >= p_data_inicio) AND
    (p_data_fim IS NULL OR v.data_agendamento <= p_data_fim) AND
    (p_medico_nome IS NULL OR v.medico_nome ILIKE '%' || p_medico_nome || '%') AND
    (p_paciente_nome IS NULL OR v.paciente_nome ILIKE '%' || p_paciente_nome || '%')
  ORDER BY v.data_agendamento DESC, v.hora_agendamento DESC;
END;
$$;

-- 7. REGISTRAR MIGRAÇÃO NO SISTEMA DE LOGS
-- ----------------------------------------------------------------------------

INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Migração Endogastro executada com sucesso - dados históricos arquivados',
  'ENDOGASTRO_MIGRATION',
  jsonb_build_object(
    'medicos_migrados', (SELECT COUNT(*) FROM public.endogastro_medicos),
    'pacientes_migrados', (SELECT COUNT(*) FROM public.endogastro_pacientes),
    'agendamentos_migrados', (SELECT COUNT(*) FROM public.endogastro_agendamentos),
    'fila_espera_migrada', (SELECT COUNT(*) FROM public.endogastro_fila_espera),
    'bloqueios_migrados', (SELECT COUNT(*) FROM public.endogastro_bloqueios_agenda),
    'data_migracao', now(),
    'status', 'concluida'
  )
);

-- 8. LIMPAR TABELAS PRINCIPAIS (PREPARAR PARA NOVOS DADOS)
-- ----------------------------------------------------------------------------

-- Limpar na ordem inversa para manter integridade referencial
DELETE FROM public.fila_notificacoes WHERE fila_id IN (SELECT id FROM public.fila_espera);
DELETE FROM public.fila_espera;
DELETE FROM public.bloqueios_agenda;
DELETE FROM public.agendamentos;
DELETE FROM public.pacientes;
UPDATE public.medicos SET ativo = false; -- Manter estrutura mas desativar

-- 9. REGISTRAR CONCLUSÃO DA LIMPEZA
-- ----------------------------------------------------------------------------

INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Limpeza das tabelas principais concluída - sistema pronto para novos dados',
  'ENDOGASTRO_CLEANUP',
  jsonb_build_object(
    'tabelas_limpas', ARRAY['fila_notificacoes', 'fila_espera', 'bloqueios_agenda', 'agendamentos', 'pacientes'],
    'medicos_desativados', (SELECT COUNT(*) FROM public.medicos WHERE ativo = false),
    'data_limpeza', now(),
    'status', 'concluida'
  )
);