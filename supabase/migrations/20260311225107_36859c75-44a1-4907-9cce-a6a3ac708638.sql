ALTER TABLE public.user_roles
  DROP CONSTRAINT user_roles_created_by_fkey,
  ADD CONSTRAINT user_roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;