-- Fase 1: Preparar Dados - Migrar configurações globais para o cliente INOVAIA
UPDATE configuracoes_clinica 
SET cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1' 
WHERE cliente_id IS NULL;

-- Tornar cliente_id obrigatório
ALTER TABLE configuracoes_clinica 
ALTER COLUMN cliente_id SET NOT NULL;

-- Fase 2: Corrigir Políticas RLS - Remover políticas antigas perigosas
DROP POLICY IF EXISTS "configuracoes_clinica_insert_policy" ON configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_update_policy" ON configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_delete_policy" ON configuracoes_clinica;
DROP POLICY IF EXISTS "configuracoes_clinica_select_policy" ON configuracoes_clinica;

-- Criar políticas seguras baseadas em cliente_id
-- SELECT: Usuários podem ver configurações da própria clínica
CREATE POLICY "Users can view own clinic config"
  ON configuracoes_clinica FOR SELECT
  USING (
    cliente_id IN (
      SELECT cliente_id FROM profiles 
      WHERE user_id = auth.uid() AND ativo = true
    )
  );

-- INSERT: Apenas admins podem inserir
CREATE POLICY "Admins can insert clinic config"
  ON configuracoes_clinica FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR is_super_admin()
  );

-- UPDATE: Apenas admins podem atualizar
CREATE POLICY "Admins can update clinic config"
  ON configuracoes_clinica FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR is_super_admin()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR is_super_admin()
  );

-- DELETE: Apenas admins podem deletar
CREATE POLICY "Admins can delete clinic config"
  ON configuracoes_clinica FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR is_super_admin()
  );