
Objetivo: eliminar de vez o cenário “usuário aprovado não consegue entrar” sem quebrar o fluxo atual de aprovação e isolamento por domínio.

Diagnóstico minucioso (já validado)
- O usuário ARLINDA existe em `profiles` com `status='aprovado'` e `ativo=true`.
- O usuário correspondente existe em `auth.users` com `email_confirmed_at` preenchido.
- Nos logs de Auth houve:
  - tentativas com `invalid_credentials` (400),
  - e também login com sucesso (`/token` 200) para o mesmo `user_id` minutos depois.
- Conclusão: o bloqueio não está na aprovação nem no domínio; o problema é de credencial/senha inconsistente + UX confusa para recuperação.

Do I know what the issue is?
- Sim: o sistema permite login do usuário aprovado, mas o fluxo atual não ajuda quando a senha digitada não corresponde (e o fluxo “Esqueci minha senha” por username está frágil).

Plano de implementação (seguro e sem regressão)
1) Fortalecer recuperação de senha por username (Auth.tsx)
- Trocar a busca direta em `profiles` (que depende de RLS) por RPC `get_email_by_username`.
- Manter fallback para email direto.
- Ajustar detecção de recuperação para ler também `window.location.hash` (não só query params), garantindo abertura da tela de redefinição quando o link do Supabase voltar.

2) Melhorar diagnóstico de login (useAuth.tsx + Auth.tsx)
- Padronizar retorno de erro do `signIn` (status + message).
- Quando vier `Invalid login credentials`, exibir mensagem específica:
  - “Usuário aprovado encontrado, mas senha incorreta. Use ‘Esqueci minha senha’.”
- Evitar mensagem genérica “tente novamente” para esse caso.

3) Tornar o cadastro menos ambíguo (Auth.tsx)
- Em sucesso de signup, mostrar confirmação clara (“Conta criada e pendente de aprovação”) e limpar estado de erro antigo.
- Garantir que mensagens de erro de signup preservem o motivo real (sem fallback genérico prematuro).

4) Opcional recomendado para operação diária (UserApprovalPanel + Edge Function)
- Adicionar ação admin “Enviar redefinição de senha” para usuário aprovado.
- Isso remove dependência da memória da senha original e reduz chamados de suporte.

5) Validação de ponta a ponta (sem mexer em RLS sensível)
- Caso 1: login com senha errada de usuário aprovado -> mensagem correta + CTA de recuperação.
- Caso 2: “Esqueci minha senha” com username -> email enviado.
- Caso 3: link de recuperação abre tela de nova senha e permite login posterior.
- Caso 4: domínio genérico continua mostrando todas clínicas (como você pediu) e domínios específicos mantêm filtro por parceiro.
- Caso 5: nenhum impacto no `aprovar_usuario`, `handle_new_user`, nem nas políticas existentes.

Detalhes técnicos (arquivos)
- `src/pages/Auth.tsx`
  - `handleForgotPassword`, `checkPasswordRecovery`, mensagens de login/signup.
- `src/hooks/useAuth.tsx`
  - normalização/estrutura de erro no `signIn`.
- (Opcional) `src/components/admin/UserApprovalPanel.tsx`
  - botão “Enviar redefinição de senha”.
- (Opcional) `supabase/functions/user-management/index.ts`
  - nova action para disparo de reset.

Risco e compatibilidade
- Baixo risco: mudanças concentradas no frontend de auth + opcional em edge function.
- Sem alteração de schema crítico nem políticas RLS de dados clínicos.
- Mantém a arquitetura atual de aprovação, domínio/parceiro e papéis.
