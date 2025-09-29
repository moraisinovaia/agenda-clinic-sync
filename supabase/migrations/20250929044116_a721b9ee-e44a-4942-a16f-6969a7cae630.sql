-- Remove o trigger incorreto que está causando o erro na aprovação de usuários
-- O trigger 'trigger_monitor_profiles' na tabela 'profiles' estava tentando executar 
-- a função monitor_critical_changes() que foi projetada apenas para 'system_settings'
-- e tenta acessar NEW.key, mas 'profiles' não tem coluna 'key'

DROP TRIGGER IF EXISTS trigger_monitor_profiles ON public.profiles;