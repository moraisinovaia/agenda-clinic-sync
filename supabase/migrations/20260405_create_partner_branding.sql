-- =========================================================
-- PARTNER BRANDING - MIGRACAO SEGURA DO MODELO EXISTENTE
-- =========================================================

-- 1) Garantir que a tabela exista no formato atual/minimo
CREATE TABLE IF NOT EXISTS public.partner_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT,
  domain_pattern TEXT,
  logo_url TEXT,
  subtitle TEXT,
  primary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Adicionar parceiro_id sem mexer nas colunas legadas
ALTER TABLE public.partner_branding
ADD COLUMN IF NOT EXISTS parceiro_id UUID REFERENCES public.parceiros(id) ON DELETE CASCADE;

-- 3) Popular parceiro_id com base no nome legado
UPDATE public.partner_branding pb
SET parceiro_id = p.id
FROM public.parceiros p
WHERE pb.parceiro_id IS NULL
  AND pb.partner_name = p.nome;

-- 4) Garantir índice
CREATE INDEX IF NOT EXISTS idx_partner_branding_parceiro_id
  ON public.partner_branding(parceiro_id);

CREATE INDEX IF NOT EXISTS idx_partner_branding_domain_pattern
  ON public.partner_branding(domain_pattern);

-- 5) Trigger updated_at
DROP TRIGGER IF EXISTS update_partner_branding_updated_at ON public.partner_branding;
CREATE TRIGGER update_partner_branding_updated_at
BEFORE UPDATE ON public.partner_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Seed inicial, sem depender de colunas novas
INSERT INTO public.partner_branding (
  partner_name,
  parceiro_id,
  domain_pattern,
  logo_url,
  subtitle,
  primary_color
)
SELECT
  'INOVAIA',
  p.id,
  'inovaiaagendamentos.inovaia.online',
  NULL,
  'Sistema de Agendamentos Médicos',
  '#0ea5e9'
FROM public.parceiros p
WHERE p.nome = 'INOVAIA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_branding pb
    WHERE pb.domain_pattern = 'agenda-clinic-sync.lovable.app'
  );

INSERT INTO public.partner_branding (
  partner_name,
  parceiro_id,
  domain_pattern,
  logo_url,
  subtitle,
  primary_color
)
SELECT
  'GT INOVA',
  p.id,
  'gt.inovaia-automacao.com.br',
  NULL,
  'Soluções em Tecnologia',
  '#16a34a'
FROM public.parceiros p
WHERE p.nome = 'GT INOVA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_branding pb
    WHERE pb.domain_pattern = 'gt.inovaia-automacao.com.br'
  );