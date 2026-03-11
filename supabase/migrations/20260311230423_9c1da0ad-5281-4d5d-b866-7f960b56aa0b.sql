-- Fix profiles self-referencing FK that blocks user deletion
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_aprovado_por_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_aprovado_por_fkey 
  FOREIGN KEY (aprovado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix audit_logs FK to prevent future deletion failures
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;