-- Verificar se RLS está habilitado corretamente
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Acesso completo fila_espera" ON public.fila_espera;

-- Criar política permissiva única
CREATE POLICY "full_access_fila_espera" ON public.fila_espera
  FOR ALL USING (true) WITH CHECK (true);

-- Mesma coisa para preparos
ALTER TABLE public.preparos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso completo preparos" ON public.preparos;

CREATE POLICY "full_access_preparos" ON public.preparos
  FOR ALL USING (true) WITH CHECK (true);