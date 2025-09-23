-- FASE 1: MIGRAÇÃO TABELA POR TABELA - Evitando triggers problemáticos

-- Primeiro, obter o ID da INOVAIA
DO $$
DECLARE
    inovaia_id UUID;
BEGIN
    SELECT id INTO inovaia_id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1;
    
    -- Atualizar tabelas sem validações complexas primeiro
    UPDATE public.medicos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.atendimentos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.preparos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.profiles SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.bloqueios_agenda SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.fila_espera SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    
    -- Pacientes sem validação
    UPDATE public.pacientes SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    
    -- Agendamentos por último (pode ter validações)
    -- Fazemos em lotes pequenos para evitar conflitos
    UPDATE public.agendamentos 
    SET cliente_id = inovaia_id 
    WHERE cliente_id IS NULL 
    AND id IN (
        SELECT id FROM public.agendamentos 
        WHERE cliente_id IS NULL 
        LIMIT 100
    );
    
    -- Se ainda há registros, continuar
    WHILE EXISTS (SELECT 1 FROM public.agendamentos WHERE cliente_id IS NULL) LOOP
        UPDATE public.agendamentos 
        SET cliente_id = inovaia_id 
        WHERE cliente_id IS NULL 
        AND id IN (
            SELECT id FROM public.agendamentos 
            WHERE cliente_id IS NULL 
            LIMIT 50
        );
    END LOOP;
    
END $$;

-- Definir NOT NULL após migração dos dados
ALTER TABLE public.medicos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.atendimentos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.pacientes ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.agendamentos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.bloqueios_agenda ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.fila_espera ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.preparos ALTER COLUMN cliente_id SET NOT NULL;