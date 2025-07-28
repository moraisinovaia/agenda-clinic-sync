-- Adicionar coluna medico_nome na tabela atendimentos
ALTER TABLE public.atendimentos 
ADD COLUMN medico_nome character varying;

-- Função para sincronizar nome do médico
CREATE OR REPLACE FUNCTION public.sync_medico_nome_atendimentos()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o medico_id foi alterado, atualizar o medico_nome
  IF TG_OP = 'UPDATE' AND (OLD.medico_id IS DISTINCT FROM NEW.medico_id) THEN
    IF NEW.medico_id IS NOT NULL THEN
      SELECT nome INTO NEW.medico_nome 
      FROM public.medicos 
      WHERE id = NEW.medico_id;
    ELSE
      NEW.medico_nome = NULL;
    END IF;
  END IF;
  
  -- Se é INSERT e tem medico_id, buscar o nome
  IF TG_OP = 'INSERT' AND NEW.medico_id IS NOT NULL THEN
    SELECT nome INTO NEW.medico_nome 
    FROM public.medicos 
    WHERE id = NEW.medico_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar automaticamente
CREATE TRIGGER trigger_sync_medico_nome_atendimentos
  BEFORE INSERT OR UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_medico_nome_atendimentos();

-- Função para atualizar atendimentos quando médico é alterado
CREATE OR REPLACE FUNCTION public.sync_atendimentos_when_medico_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar todos os atendimentos deste médico
  UPDATE public.atendimentos 
  SET medico_nome = NEW.nome 
  WHERE medico_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar quando médico é alterado
CREATE TRIGGER trigger_sync_atendimentos_medico
  AFTER UPDATE ON public.medicos
  FOR EACH ROW
  WHEN (OLD.nome IS DISTINCT FROM NEW.nome)
  EXECUTE FUNCTION public.sync_atendimentos_when_medico_changes();

-- Popular dados existentes
UPDATE public.atendimentos 
SET medico_nome = m.nome
FROM public.medicos m
WHERE atendimentos.medico_id = m.id;