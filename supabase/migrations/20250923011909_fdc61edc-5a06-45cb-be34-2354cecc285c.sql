-- FASE 1: PREPARAÇÃO MULTI-CLÍNICA (CORRIGIDO)

-- Etapa 1: Criar tabela clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  logo_url TEXT,
  configuracoes JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para tabela clientes (apenas super-admins)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins podem gerenciar clientes" ON public.clientes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin' 
    AND status = 'aprovado'
  )
);

-- Inserir INOVAIA como primeiro cliente
INSERT INTO public.clientes (nome, configuracoes) 
VALUES ('INOVAIA', '{"tipo": "clinica_gastroenterologia", "sistema_origem": true}');

-- Etapa 2: Adicionar cliente_id nas tabelas principais (sem default)
ALTER TABLE public.medicos ADD COLUMN cliente_id UUID;
ALTER TABLE public.atendimentos ADD COLUMN cliente_id UUID;
ALTER TABLE public.pacientes ADD COLUMN cliente_id UUID;
ALTER TABLE public.agendamentos ADD COLUMN cliente_id UUID;
ALTER TABLE public.profiles ADD COLUMN cliente_id UUID;
ALTER TABLE public.bloqueios_agenda ADD COLUMN cliente_id UUID;
ALTER TABLE public.fila_espera ADD COLUMN cliente_id UUID;
ALTER TABLE public.preparos ADD COLUMN cliente_id UUID;