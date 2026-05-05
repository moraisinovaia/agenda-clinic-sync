-- [Painel médico - Fase 2] RPCs pra gerenciar acessos de médicos.
--
-- 3 funções SECURITY DEFINER chamadas pelo painel admin:
--   1. criar_acesso_medico    → cria conta + role + assignment titular
--   2. revogar_acesso_medico  → soft delete (ativo=false)
--   3. listar_acessos_clinica → lista assignments do cliente do caller
--
-- Permissões: apenas super_admin ou admin_clinica (do mesmo cliente_id).
-- Médicos podem CHAMAR listar_acessos_clinica mas RLS retorna só os SEUS
-- (linhas onde user_id = auth.uid()).

-- ═══════════════════════════════════════════════════════════════════
-- Helper: gera username a partir do nome do médico
-- "Dr. Rivadávio Espínola" → "rivadavio"
-- "Dra. Lara Eline Menezes" → "lara"
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._username_from_medico_nome(nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      -- Pega primeiro nome após "Dr.", "Dra.", etc
      split_part(
        btrim(regexp_replace(nome, '^(Dr\.|Dra\.|Dr|Dra)\s*', '', 'i')),
        ' ', 1
      ),
      -- Remove acentos
      '[áàâãä]', 'a', 'gi'
    )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- RPC 1: criar_acesso_medico
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.criar_acesso_medico(
  p_medico_id      uuid,
  p_username       text DEFAULT NULL,
  p_senha_inicial  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id           uuid := auth.uid();
  v_caller_profile_id   uuid;
  v_caller_role         boolean;
  v_medico              record;
  v_username            text;
  v_username_norm       text;
  v_senha               text;
  v_email               text;
  v_user_id             uuid := gen_random_uuid();
  v_assignment_id       uuid;
BEGIN
  -- ─── Authorization ───
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  -- aprovado_por é FK pra profiles.id (não auth.users.id)
  SELECT id INTO v_caller_profile_id FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;

  -- Carrega médico
  SELECT id, nome, cliente_id, ativo INTO v_medico
  FROM public.medicos WHERE id = p_medico_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico % não encontrado', p_medico_id USING ERRCODE = '23503';
  END IF;
  IF NOT v_medico.ativo THEN
    RAISE EXCEPTION 'Médico inativo. Ative no DoctorManagementPanel antes de criar acesso.' USING ERRCODE = '23514';
  END IF;

  -- Caller deve ser super_admin OU admin_clinica do mesmo cliente_id
  v_caller_role :=
    is_super_admin()
    OR (
      has_role(v_caller_id, 'admin_clinica'::app_role)
      AND get_user_cliente_id() = v_medico.cliente_id
    );

  IF NOT v_caller_role THEN
    RAISE EXCEPTION 'Sem permissão pra criar acesso de médico desta clínica' USING ERRCODE = '42501';
  END IF;

  -- ─── Username ───
  v_username := COALESCE(
    NULLIF(btrim(p_username), ''),
    public._username_from_medico_nome(v_medico.nome)
  );
  v_username_norm := lower(btrim(v_username));

  IF length(v_username_norm) < 3 THEN
    RAISE EXCEPTION 'Username deve ter pelo menos 3 caracteres' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(btrim(username)) = v_username_norm
  ) THEN
    RAISE EXCEPTION 'Username "%" já está em uso. Passe outro em p_username.', v_username_norm USING ERRCODE = '23505';
  END IF;

  -- ─── Senha inicial ───
  -- Default: <PrimeiroNomeCapitalizado>@<AnoAtual>  ex: Rivadavio@2026
  v_senha := COALESCE(
    NULLIF(p_senha_inicial, ''),
    initcap(public._username_from_medico_nome(v_medico.nome)) || '@' || extract(year FROM now())::text
  );

  IF length(v_senha) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 6 caracteres' USING ERRCODE = '22023';
  END IF;

  -- ─── Email sintético (médico nunca vê) ───
  v_email := v_username_norm || '@medicos.' || v_medico.cliente_id::text || '.local';

  -- ─── 1. Criar auth.users (trigger handle_new_user cria profile pendente) ───
  INSERT INTO auth.users (
    id, instance_id, email, role, aud, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    'authenticated',
    'authenticated',
    extensions.crypt(v_senha, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'nome',       v_medico.nome,
      'username',   v_username_norm,
      'cliente_id', v_medico.cliente_id::text
    )
  );

  -- ─── 2. Aprovar profile + flag must_change_password ───
  UPDATE public.profiles
  SET status = 'aprovado',
      ativo = true,
      must_change_password = true,
      data_aprovacao = now(),
      aprovado_por = v_caller_profile_id,
      cargo = 'Médico'
  WHERE user_id = v_user_id;

  -- ─── 3. Role 'medico' ───
  INSERT INTO public.user_roles (user_id, role, cliente_id, created_by)
  VALUES (v_user_id, 'medico'::app_role, v_medico.cliente_id, v_caller_id);

  -- ─── 4. Assignment titular ───
  INSERT INTO public.user_medico_access (
    user_id, medico_id, cliente_id, ativo, granted_by, motivo
  ) VALUES (
    v_user_id, v_medico.id, v_medico.cliente_id, true, v_caller_id, 'titular'
  )
  RETURNING id INTO v_assignment_id;

  -- ─── Retorno (pra admin entregar ao médico) ───
  RETURN jsonb_build_object(
    'success',          true,
    'user_id',          v_user_id,
    'username',         v_username_norm,
    'senha_inicial',    v_senha,
    'medico_nome',      v_medico.nome,
    'assignment_id',    v_assignment_id,
    'must_change_password', true,
    'instrucoes',       'Entregue ao médico: ele faz login com o username acima e a senha inicial. Será forçado a trocar a senha no 1º acesso.'
  );
END;
$$;

COMMENT ON FUNCTION public.criar_acesso_medico IS
  'Cria conta + role medico + assignment titular pra um médico. Atomic. Retorna username/senha pra admin entregar. Permissão: super_admin ou admin_clinica do mesmo cliente_id.';

GRANT EXECUTE ON FUNCTION public.criar_acesso_medico(uuid, text, text) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- RPC 2: revogar_acesso_medico
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.revogar_acesso_medico(
  p_assignment_id  uuid,
  p_motivo         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid := auth.uid();
  v_assignment   record;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT id, user_id, medico_id, cliente_id, ativo INTO v_assignment
  FROM public.user_medico_access WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment % não encontrado', p_assignment_id USING ERRCODE = '23503';
  END IF;

  IF NOT v_assignment.ativo THEN
    RAISE EXCEPTION 'Assignment já está revogado' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    is_super_admin()
    OR (has_role(v_caller_id, 'admin_clinica'::app_role)
        AND get_user_cliente_id() = v_assignment.cliente_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra revogar este assignment' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_medico_access
  SET ativo = false,
      revoked_at = now(),
      motivo = COALESCE(p_motivo, motivo, 'revogado pelo admin')
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object(
    'success',       true,
    'assignment_id', p_assignment_id,
    'revoked_at',    now()
  );
END;
$$;

COMMENT ON FUNCTION public.revogar_acesso_medico IS
  'Soft delete (ativo=false) de assignment. Auditoria automática via trigger. Permissão: super_admin ou admin_clinica do mesmo cliente_id.';

GRANT EXECUTE ON FUNCTION public.revogar_acesso_medico(uuid, text) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- RPC 3: listar_acessos_clinica
-- ═══════════════════════════════════════════════════════════════════
-- Retorna assignments do cliente do caller.
-- Admin vê todos da clínica. Médico vê só os SEUS (RLS já garante).
CREATE OR REPLACE FUNCTION public.listar_acessos_clinica()
RETURNS TABLE (
  assignment_id           uuid,
  medico_id               uuid,
  medico_nome             text,
  medico_especialidade    text,
  user_id                 uuid,
  user_username           text,
  user_nome               text,
  ativo                   boolean,
  motivo                  text,
  must_change_password    boolean,
  granted_at              timestamptz,
  granted_by_nome         text,
  revoked_at              timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    uma.id              AS assignment_id,
    m.id                AS medico_id,
    m.nome              AS medico_nome,
    m.especialidade     AS medico_especialidade,
    p.user_id           AS user_id,
    p.username          AS user_username,
    p.nome              AS user_nome,
    uma.ativo,
    uma.motivo,
    p.must_change_password,
    uma.granted_at,
    granter.nome        AS granted_by_nome,
    uma.revoked_at
  FROM public.user_medico_access uma
  JOIN public.medicos m ON m.id = uma.medico_id
  JOIN public.profiles p ON p.user_id = uma.user_id
  LEFT JOIN public.profiles granter ON granter.user_id = uma.granted_by
  WHERE
    -- Super admin vê tudo
    is_super_admin()
    -- Admin da clínica vê todos do cliente_id
    OR (has_role(auth.uid(), 'admin_clinica'::app_role)
        AND uma.cliente_id = get_user_cliente_id())
    -- Médico vê só os SEUS
    OR (uma.user_id = auth.uid())
  ORDER BY uma.ativo DESC, m.nome, uma.granted_at DESC;
$$;

COMMENT ON FUNCTION public.listar_acessos_clinica IS
  'Lista assignments visíveis ao caller. Super admin vê todos; admin_clinica vê os do cliente_id; medico vê os próprios.';

GRANT EXECUTE ON FUNCTION public.listar_acessos_clinica() TO authenticated;
