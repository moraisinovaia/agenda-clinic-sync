// Página /setup-senha — força mudança de senha no 1º login.
//
// Fluxo:
//   1. AuthGuard detecta profiles.must_change_password = true
//   2. Redireciona pra cá
//   3. User digita nova senha (>= 8 chars, confirma)
//   4. supabase.auth.updateUser({ password }) atualiza no Auth
//   5. UPDATE em profiles.must_change_password = false
//   6. Redireciona pra rota apropriada (/medico ou /)
//
// Observações:
//   - Mantém usuário logado (não precisa relogar)
//   - Botão "Sair" disponível pra abandonar (mas tela só mostra de novo no próximo login)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, ShieldCheck, LogOut } from 'lucide-react';

const MIN_SENHA = 8;

export default function SetupSenha() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (novaSenha.length < MIN_SENHA) return `Senha deve ter pelo menos ${MIN_SENHA} caracteres.`;
    if (novaSenha !== confirma) return 'As senhas não coincidem.';
    if (/^[0-9]+$/.test(novaSenha)) return 'Senha não pode ser apenas números.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!user?.id) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      // 1. Atualiza a senha no auth (Supabase faz hash bcrypt)
      const { error: authErr } = await supabase.auth.updateUser({ password: novaSenha });
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }

      // 2. Limpa flag must_change_password
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);

      if (profileErr) {
        // Senha já foi mudada — só log, não bloqueia
        console.error('[SetupSenha] erro ao limpar flag:', profileErr);
      }

      toast({
        title: 'Senha definida',
        description: 'Bem-vindo! Você pode usar essa senha no próximo login.',
      });

      // 3. Redireciona — AuthGuard cuidará de mandar pro /medico se for médico
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle>Defina sua nova senha</CardTitle>
            <CardDescription>
              Por segurança, você precisa criar uma senha pessoal antes de acessar o sistema.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <PasswordInput
                id="nova-senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                disabled={loading}
                autoFocus
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirma-senha">Confirme a nova senha</Label>
              <PasswordInput
                id="confirma-senha"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                disabled={loading}
                placeholder="Digite a senha novamente"
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Pelo menos {MIN_SENHA} caracteres
              </p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Não pode ser só números
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Salvando...' : 'Definir nova senha'}
            </Button>

            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair sem alterar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
