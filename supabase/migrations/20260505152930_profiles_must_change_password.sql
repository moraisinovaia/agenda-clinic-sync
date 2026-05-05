-- [Painel médico - Fase 1.2] Flag de troca obrigatória de senha no 1º login.
--
-- Quando admin cria conta de médico com senha provisória (ex: Marcelo@2026),
-- o profile fica com must_change_password=true. AuthGuard no frontend
-- redireciona pra /setup-senha até o usuário trocar.
--
-- Após trocar:
--   - flag vira false
--   - senha provisória deixa de funcionar (já tem hash novo na auth.users)
--
-- Default false: usuários existentes (já trocaram senha alguma vez ou já são
-- ativos) não são afetados. Só usuários novos criados via fluxo de convite
-- têm a flag setada como true.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'true = usuário precisa trocar senha no próximo login. Setado quando admin cria conta com senha provisória.';
