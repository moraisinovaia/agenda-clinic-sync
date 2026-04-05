-- 🔥 ADICIONAR CLIENTE_ID NAS TABELAS CORE

-- PACIENTES
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- AGENDAMENTOS
ALTER TABLE public.agendamentos
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- FILA ESPERA
ALTER TABLE public.fila_espera
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- FILA NOTIFICACOES
ALTER TABLE public.fila_notificacoes
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

-- 🔄 POPULAR CLIENTE_ID A PARTIR DOS RELACIONAMENTOS EXISTENTES

-- AGENDAMENTOS: priorizar cliente_id do médico
UPDATE public.agendamentos a
SET cliente_id = m.cliente_id
FROM public.medicos m
WHERE a.medico_id = m.id
  AND a.cliente_id IS NULL;

-- AGENDAMENTOS: fallback para cliente_id do atendimento
UPDATE public.agendamentos a
SET cliente_id = atd.cliente_id
FROM public.atendimentos atd
WHERE a.atendimento_id = atd.id
  AND a.cliente_id IS NULL;

-- FILA_ESPERA: priorizar cliente_id do médico
UPDATE public.fila_espera f
SET cliente_id = m.cliente_id
FROM public.medicos m
WHERE f.medico_id = m.id
  AND f.cliente_id IS NULL;

-- FILA_ESPERA: fallback para cliente_id do atendimento
UPDATE public.fila_espera f
SET cliente_id = atd.cliente_id
FROM public.atendimentos atd
WHERE f.atendimento_id = atd.id
  AND f.cliente_id IS NULL;

-- FILA_NOTIFICACOES: herdar cliente_id da fila_espera
UPDATE public.fila_notificacoes fn
SET cliente_id = fe.cliente_id
FROM public.fila_espera fe
WHERE fn.fila_id = fe.id
  AND fn.cliente_id IS NULL;

-- PACIENTES: preencher pelo cliente_id encontrado nos agendamentos
UPDATE public.pacientes p
SET cliente_id = sub.cliente_id
FROM (
  SELECT paciente_id, MIN(cliente_id) AS cliente_id
  FROM public.agendamentos
  WHERE cliente_id IS NOT NULL
  GROUP BY paciente_id
) sub
WHERE p.id = sub.paciente_id
  AND p.cliente_id IS NULL;