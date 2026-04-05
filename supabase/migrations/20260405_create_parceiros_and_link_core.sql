-- =========================================================
-- PARCEIROS + VINCULO COM CLIENTES E PROFILES
-- =========================================================

-- 1) TABELA DE PARCEIROS
CREATE TABLE IF NOT EXISTS public.parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_parceiros_updated_at ON public.parceiros;
CREATE TRIGGER update_parceiros_updated_at
BEFORE UPDATE ON public.parceiros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ADICIONAR parceiro_id EM clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS parceiro_id UUID REFERENCES public.parceiros(id);

-- 3) ADICIONAR parceiro_id EM profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS parceiro_id UUID REFERENCES public.parceiros(id);

-- 4) ÍNDICES
CREATE INDEX IF NOT EXISTS idx_clientes_parceiro_id
  ON public.clientes(parceiro_id);

CREATE INDEX IF NOT EXISTS idx_profiles_parceiro_id
  ON public.profiles(parceiro_id);

-- 5) CADASTRAR PARCEIROS INICIAIS
INSERT INTO public.parceiros (nome, slug)
VALUES
  ('INOVAIA', 'inovaia'),
  ('GT INOVA', 'gt-inova')
ON CONFLICT (nome) DO NOTHING;

-- 6) POPULAR clientes.parceiro_id A PARTIR DO CAMPO legado "parceiro"
UPDATE public.clientes c
SET parceiro_id = p.id
FROM public.parceiros p
WHERE c.parceiro_id IS NULL
  AND c.parceiro = p.nome;

-- 7) POPULAR profiles.parceiro_id VIA cliente_id
UPDATE public.profiles pr
SET parceiro_id = c.parceiro_id
FROM public.clientes c
WHERE pr.cliente_id = c.id
  AND pr.parceiro_id IS NULL;  

-- 8) GARANTIR CONSISTÊNCIA FUTURA
-- Observação:
-- NÃO aplicar NOT NULL agora sem validar dados reais no banco.
-- Primeiro vamos conferir se todos os clientes e profiles ficaram vinculados.

-- Índice opcional para garantir nomes únicos por parceiro no futuro pode ser adicionado depois.  