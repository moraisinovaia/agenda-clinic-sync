
-- Tabela de branding por parceiro (INOVAIA / GT INOVA)
CREATE TABLE public.partner_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL UNIQUE,
  domain_pattern text NOT NULL UNIQUE,
  logo_url text,
  subtitle text DEFAULT 'Sistema de Agendamentos Médicos',
  primary_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: leitura pública (dados não sensíveis, necessário para tela de login)
ALTER TABLE public.partner_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read partner branding"
  ON public.partner_branding FOR SELECT
  USING (true);

-- Apenas super admins podem gerenciar
CREATE POLICY "Super admin can manage partner branding"
  ON public.partner_branding FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Dados iniciais
INSERT INTO public.partner_branding (partner_name, domain_pattern, logo_url, subtitle) VALUES
  ('INOVAIA', 'inovaia', NULL, 'Sistema de Agendamentos Médicos'),
  ('GT INOVA', 'gtinova', NULL, 'Sistema de Agendamentos Médicos');

-- Adicionar coluna parceiro na tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS parceiro text DEFAULT 'INOVAIA';

-- Mapear clientes existentes ao parceiro correto
UPDATE public.clientes SET parceiro = 'INOVAIA' WHERE id IN (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1'
);
UPDATE public.clientes SET parceiro = 'GT INOVA' WHERE id IN (
  'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a',
  'e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f'
);
