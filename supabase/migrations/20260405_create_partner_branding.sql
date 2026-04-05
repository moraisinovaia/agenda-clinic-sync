-- =========================================================
-- PARTNER BRANDING: MIGRAR SCHEMA ANTIGO -> NOVO MODELO
-- =========================================================

CREATE TABLE IF NOT EXISTS public.partner_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 1) ADICIONAR COLUNAS NOVAS SE NÃO EXISTIREM
ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS parceiro_id UUID REFERENCES public.parceiros(id) ON DELETE CASCADE;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS dominio TEXT;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS cor_secundaria TEXT;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS subtitulo TEXT;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS tema JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- 2) MAPEAR DADOS DO SCHEMA ANTIGO PARA O NOVO
UPDATE public.partner_branding
SET dominio = domain_pattern
WHERE dominio IS NULL
  AND domain_pattern IS NOT NULL;

UPDATE public.partner_branding
SET nome_exibicao = partner_name
WHERE nome_exibicao IS NULL
  AND partner_name IS NOT NULL;

UPDATE public.partner_branding
SET subtitulo = subtitle
WHERE subtitulo IS NULL
  AND subtitle IS NOT NULL;

UPDATE public.partner_branding
SET cor_primaria = primary_color
WHERE cor_primaria IS NULL
  AND primary_color IS NOT NULL;

-- 3) VINCULAR parceiro_id A PARTIR DO NOME LEGADO
UPDATE public.partner_branding pb
SET parceiro_id = p.id
FROM public.parceiros p
WHERE pb.parceiro_id IS NULL
  AND pb.partner_name = p.nome;

-- 4) GARANTIR COLUNAS DE TIMESTAMP
ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 5) TRIGGER DE updated_at
DROP TRIGGER IF EXISTS update_partner_branding_updated_at ON public.partner_branding;
CREATE TRIGGER update_partner_branding_updated_at
BEFORE UPDATE ON public.partner_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6) ÍNDICES
CREATE INDEX IF NOT EXISTS idx_partner_branding_parceiro_id
  ON public.partner_branding(parceiro_id);

CREATE INDEX IF NOT EXISTS idx_partner_branding_dominio
  ON public.partner_branding(dominio);

-- 7) UNIQUE EM dominio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_branding_dominio_key'
  ) THEN
    ALTER TABLE public.partner_branding
    ADD CONSTRAINT partner_branding_dominio_key UNIQUE (dominio);
  END IF;
END $$;

-- 8) REGISTROS INICIAIS / UPSERT LÓGICO
INSERT INTO public.partner_branding (
  parceiro_id,
  dominio,
  nome_exibicao,
  subtitulo,
  cor_primaria,
  cor_secundaria,
  ativo
)
SELECT
  p.id,
  'agenda-clinic-sync.lovable.app',
  'Inovaia',
  'Sistema de Agendamentos Médicos',
  '#0ea5e9',
  '#0284c7',
  true
FROM public.parceiros p
WHERE p.nome = 'INOVAIA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_branding pb
    WHERE pb.dominio = 'agenda-clinic-sync.lovable.app'
  );

INSERT INTO public.partner_branding (
  parceiro_id,
  dominio,
  nome_exibicao,
  subtitulo,
  cor_primaria,
  cor_secundaria,
  ativo
)
SELECT
  p.id,
  'gt.inovaia-automacao.com.br',
  'GT Inova',
  'Soluções em Tecnologia',
  '#16a34a',
  '#15803d',
  true
FROM public.parceiros p
WHERE p.nome = 'GT INOVA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_branding pb
    WHERE pb.dominio = 'gt.inovaia-automacao.com.br'
  );