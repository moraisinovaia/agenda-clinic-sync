import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, Lock, Mail, AtSign, AlertCircle, KeyRound, Wrench } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useRememberMe } from '@/hooks/useRememberMe';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import inovaiaLogo from '@/assets/inovaia-logo.jpeg';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const { rememberMe, savedUsername, saveCredentials } = useRememberMe();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isFixingEmails, setIsFixingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMeChecked, setRememberMeChecked] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [loginData, setLoginData] = useState({
    emailOrUsername: savedUsername || '',
    password: ''
  });
  
  const [signupData, setSignupData] = useState({
    nome: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Set initial remember me state and load saved username
  useEffect(() => {
    setRememberMeChecked(rememberMe);
    if (savedUsername) {
      setLoginData(prev => ({ ...prev, emailOrUsername: savedUsername }));
    }
  }, [rememberMe, savedUsername]);

  // Check for password recovery session FIRST (before any redirect logic)
  const hasRecoveryParams = searchParams.get('type') === 'recovery' || 
    searchParams.get('access_token') || 
    searchParams.get('refresh_token');

  useEffect(() => {
    const checkPasswordRecovery = async () => {
      // Only show password reset if we have recovery parameters
      if (hasRecoveryParams) {
        console.log('🔑 Recovery parameters detected, checking session...');
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            console.log('❌ Invalid recovery session:', error);
            setError('Link de recuperação inválido ou expirado');
            setShowPasswordReset(false);
          } else {
            console.log('✅ Valid recovery session confirmed, showing password reset form');
            setShowPasswordReset(true);
          }
        } catch (error) {
          console.log('❌ Error verifying recovery session:', error);
          setError('Erro ao verificar sessão de recuperação');
          setShowPasswordReset(false);
        }
      }
    };
    
    checkPasswordRecovery();
  }, [searchParams, hasRecoveryParams]);

  // Only redirect if user is logged in AND not in recovery mode AND not showing password reset
  if (user && !loading && !showPasswordReset && !hasRecoveryParams) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.emailOrUsername || !loginData.password) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const { error } = await signIn(loginData.emailOrUsername, loginData.password);
      
      if (error) {
        // Se houve erro no login
        const errorMessage = error.message === 'Invalid credentials' 
          ? 'Email/usuário ou senha incorretos'
          : 'Erro ao fazer login. Tente novamente.';
        
        setError(errorMessage);
        // Não exibir toast aqui pois o useAuth já exibe
      } else {
        // Apenas se login foi bem-sucedido
        saveCredentials(loginData.emailOrUsername, rememberMeChecked);
        // Não exibir toast aqui pois o useAuth já exibe
      }
    } catch (error: any) {
      // Erro inesperado (não deveria chegar aqui normalmente)
      const errorMessage = 'Erro inesperado ao fazer login. Tente novamente.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupData.nome || !signupData.username || !signupData.email || !signupData.password) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    if (signupData.password !== signupData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (signupData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const { error } = await signUp(signupData.email, signupData.password, signupData.nome, signupData.username);
      
      if (error) {
        // Se houve erro no cadastro
        const errorMessage = error.message.includes('already registered')
          ? 'Este email já está cadastrado'
          : 'Erro ao criar conta. Tente novamente.';
        
        setError(errorMessage);
        // Não exibir toast aqui pois o useAuth já exibe
      } else {
        // Sucesso - não exibir toast aqui pois o useAuth já exibe
        // Limpar formulário após sucesso
        setSignupData({
          nome: '',
          username: '',
          email: '',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (error: any) {
      // Erro inesperado (não deveria chegar aqui normalmente)
      const errorMessage = 'Erro inesperado ao criar conta. Tente novamente.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginData.emailOrUsername) {
      setError('Digite seu email para recuperar a senha');
      return;
    }
    
    let email = loginData.emailOrUsername;
    
    // Se não contém @, buscar email pelo username
    if (!loginData.emailOrUsername.includes('@')) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', loginData.emailOrUsername)
          .maybeSingle();
          
        if (profileError || !profile) {
          setError('Nome de usuário não encontrado');
          return;
        }
        
        email = profile.email;
      } catch (error) {
        setError('Erro ao buscar email. Tente usar seu email diretamente.');
        return;
      }
    }
    
    setIsResettingPassword(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });
      
      if (error) {
        setError('Erro ao enviar email de recuperação');
      } else {
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir sua senha.',
        });
      }
    } catch (error) {
      setError('Erro inesperado ao enviar email de recuperação');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmNewPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setIsUpdatingPassword(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        setError('Erro ao atualizar senha: ' + error.message);
      } else {
        toast({
          title: 'Senha atualizada!',
          description: 'Sua senha foi alterada com sucesso. Você será redirecionado.',
        });
        
        // Clear the form and redirect after success
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordReset(false);
        
        // Redirect to main page after password update
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error) {
      setError('Erro inesperado ao atualizar senha');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleFixApprovedUsersEmails = async () => {
    setIsFixingEmails(true);
    setError(null);
    
    try {
      console.log('🔧 Executando correção de emails confirmados...');
      
      const { data, error } = await supabase.functions.invoke('fix-approved-users-emails', {
        body: { adminUserId: user?.id }
      });
      
      if (error) {
        console.error('❌ Erro na função:', error);
        setError('Erro ao corrigir emails: ' + error.message);
        toast({
          title: 'Erro',
          description: 'Falha ao corrigir emails de usuários aprovados',
          variant: 'destructive'
        });
      } else {
        console.log('✅ Resultado da correção:', data);
        toast({
          title: 'Correção executada!',
          description: `${data.fixed} emails corrigidos de ${data.fixed + data.errors} usuários processados`,
        });
      }
    } catch (error: any) {
      console.error('❌ Erro crítico:', error);
      setError('Erro inesperado ao corrigir emails');
      toast({
        title: 'Erro crítico',
        description: 'Falha na comunicação com o servidor',
        variant: 'destructive'
      });
    } finally {
      setIsFixingEmails(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show password reset form if in recovery mode
  if (showPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center auth-background p-4">
        <Card className="w-full max-w-md auth-card animate-card-entrance">
          <CardHeader className="text-center space-y-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <KeyRound className="h-6 w-6" />
                Redefinir Senha
              </CardTitle>
              <p className="text-muted-foreground">Digite sua nova senha</p>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    id="new-password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    id="confirm-new-password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="text-sm text-red-500">As senhas não coincidem</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isUpdatingPassword || newPassword !== confirmNewPassword || !newPassword}
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar Senha'
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  setShowPasswordReset(false);
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center auth-background p-4">
      <Card className="w-full max-w-md auth-card animate-card-entrance">
        <CardHeader className="text-center space-y-6 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="auth-logo animate-logo-breathe">
              <img 
                src={inovaiaLogo} 
                alt="INOVAIA" 
                className="h-16 w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Sistema de Agendamentos
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">Acesso para Recepcionistas</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-background/50 backdrop-blur-sm">
              <TabsTrigger value="login" className="auth-tab">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="auth-tab">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Botão de emergência para corrigir emails */}
              {error && error.includes('Email não confirmado') && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800">
                      Correção de Emergência
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 mb-3">
                    Se você foi aprovado mas ainda não consegue entrar, clique no botão abaixo para corrigir automaticamente todos os emails não confirmados.
                  </p>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleFixApprovedUsersEmails}
                    disabled={isFixingEmails}
                    className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    {isFixingEmails ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Corrigindo emails...
                      </>
                    ) : (
                      <>
                        <Wrench className="mr-2 h-4 w-4" />
                        Corrigir Emails Não Confirmados
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-emailOrUsername" className="text-sm font-medium">Email ou Nome de Usuário</Label>
                  <div className="relative group">
                    <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="login-emailOrUsername"
                      type="text"
                      placeholder="email@exemplo.com ou usuario"
                      className="pl-10 auth-input"
                      value={loginData.emailOrUsername}
                      onChange={(e) => setLoginData(prev => ({ ...prev, emailOrUsername: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium">Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <PasswordInput
                      id="login-password"
                      placeholder="••••••••"
                      className="pl-10 auth-input"
                      value={loginData.password}
                      onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMeChecked}
                    onCheckedChange={(checked) => setRememberMeChecked(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="text-sm">
                    Lembrar de mim
                  </Label>
                </div>
                
                <Button type="submit" className="w-full auth-button hover:shadow-lg transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                     'Entrar'
                   )}
                 </Button>
                 
                 {/* Forgot Password Button */}
                 <Button 
                   type="button" 
                   variant="ghost" 
                   className="w-full text-sm hover:bg-background/50 transition-all duration-200" 
                   onClick={handleForgotPassword}
                   disabled={isResettingPassword}
                 >
                   {isResettingPassword ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Enviando email...
                     </>
                   ) : (
                     'Esqueci minha senha'
                   )}
                 </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nome" className="text-sm font-medium">Nome Completo</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome completo"
                      className="pl-10 auth-input"
                      value={signupData.nome}
                      onChange={(e) => setSignupData(prev => ({ ...prev, nome: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-sm font-medium">Nome de Usuário</Label>
                  <div className="relative group">
                    <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="usuario123"
                      className="pl-10 auth-input"
                      value={signupData.username}
                      onChange={(e) => setSignupData(prev => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este será seu nome para login no sistema
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 auth-input"
                      value={signupData.email}
                      onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sua conta será enviada para aprovação
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <PasswordInput
                      id="signup-password"
                      placeholder="••••••••"
                      className="pl-10 auth-input"
                      value={signupData.password}
                      onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-sm font-medium">Confirmar Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <PasswordInput
                      id="signup-confirm"
                      placeholder="••••••••"
                      className="pl-10 auth-input"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                {signupData.password && signupData.confirmPassword && 
                 signupData.password !== signupData.confirmPassword && (
                  <p className="text-sm text-red-500">As senhas não coincidem</p>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full auth-button hover:shadow-lg transition-all duration-300" 
                  disabled={isLoading || signupData.password !== signupData.confirmPassword}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}