import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, Lock, Mail, AtSign, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useRememberMe } from '@/hooks/useRememberMe';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const { rememberMe, savedUsername, saveCredentials } = useRememberMe();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMeChecked, setRememberMeChecked] = useState(false);
  
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

  // Redirecionar se já estiver autenticado
  if (user && !loading) {
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
      await signIn(loginData.emailOrUsername, loginData.password);
      
      // Save credentials if remember me is checked
      saveCredentials(loginData.emailOrUsername, rememberMeChecked);
      
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao sistema de agendamentos.',
      });
    } catch (error: any) {
      const errorMessage = error.message === 'Invalid credentials' 
        ? 'Email/usuário ou senha incorretos'
        : 'Erro ao fazer login. Tente novamente.';
      
      setError(errorMessage);
      toast({
        title: 'Erro no login',
        description: errorMessage,
        variant: 'destructive',
      });
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
      await signUp(signupData.email, signupData.password, signupData.nome, signupData.username);
      
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você pode fazer login agora.',
      });
    } catch (error: any) {
      const errorMessage = error.message.includes('already registered')
        ? 'Este email já está cadastrado'
        : 'Erro ao criar conta. Tente novamente.';
      
      setError(errorMessage);
      toast({
        title: 'Erro ao criar conta',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sistema de Agendamentos</CardTitle>
          <p className="text-muted-foreground">Acesso para Recepcionistas</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-emailOrUsername">Email ou Nome de Usuário</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-emailOrUsername"
                      type="text"
                      placeholder="email@exemplo.com ou usuario"
                      className="pl-10"
                      value={loginData.emailOrUsername}
                      onChange={(e) => setLoginData(prev => ({ ...prev, emailOrUsername: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
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
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
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
                  <Label htmlFor="signup-nome">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome completo"
                      className="pl-10"
                      value={signupData.nome}
                      onChange={(e) => setSignupData(prev => ({ ...prev, nome: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Nome de Usuário</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="usuario123"
                      className="pl-10"
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
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10"
                      value={signupData.email}
                      onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para validação e recuperação da conta
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={signupData.password}
                      onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
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
                  className="w-full" 
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