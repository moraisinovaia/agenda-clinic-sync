-- Verificar o papel atual e permissões
SELECT current_user, current_role;

-- Verificar se a tabela realmente existe e quem é o dono
SELECT schemaname, tablename, tableowner FROM pg_tables WHERE tablename = 'bloqueios_agenda';

-- Tentar fazer uma operação simples na tabela
SELECT COUNT(*) FROM public.bloqueios_agenda;

-- Se a tabela não existe ou há problemas, recriar ela
DROP TABLE IF EXISTS public.bloqueios_agenda CASCADE;

CREATE TABLE public.bloqueios_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT NOT NULL,
  criado_por TEXT NOT NULL DEFAULT 'recepcionista',
  criado_por_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status VARCHAR(50) NOT NULL DEFAULT 'ativo'
);

-- Conceder todas as permissões novamente
GRANT ALL ON public.bloqueios_agenda TO postgres, anon, authenticated, service_role;