-- ============================================
-- CORREÇÃO FINAL: GRANT de privilégios para horarios_vazios
-- ============================================
-- Problema: Tabela não tem privilégios GRANT para roles authenticated/anon
-- Solução: Adicionar GRANTs necessários

-- 1. Garantir que a tabela existe e RLS está habilitado
ALTER TABLE public.horarios_vazios ENABLE ROW LEVEL SECURITY;

-- 2. GRANT de privilégios para role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.horarios_vazios TO authenticated;

-- 3. GRANT de privilégios para role anon (para queries públicas se necessário)
GRANT SELECT ON TABLE public.horarios_vazios TO anon;

-- 4. GRANT de privilégios para role service_role (admin completo)
GRANT ALL PRIVILEGES ON TABLE public.horarios_vazios TO service_role;

-- 5. Garantir que a sequence também tem permissões (se houver)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 6. Verificar privilégios foram aplicados corretamente
DO $$
DECLARE
  privilege_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO privilege_count
  FROM information_schema.table_privileges 
  WHERE table_name = 'horarios_vazios'
    AND table_schema = 'public'
    AND grantee IN ('authenticated', 'anon', 'service_role');
  
  IF privilege_count < 3 THEN
    RAISE WARNING 'Privilégios podem não ter sido aplicados corretamente';
  END IF;
END $$;