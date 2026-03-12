import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cleanupGoogleOAuthElements } from '@/utils/domCleanup';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
  status: string;
  username?: string;
  cliente_id?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: any }>;
  signUp: (password: string, nome: string, username: string, email: string, clienteId?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggingOut = useRef(false);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // Usar a função SECURITY DEFINER que agora funciona corretamente
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_current_user_profile');

      if (!functionError && functionData && functionData.length > 0) {
        return functionData[0] as Profile;
      }

      // Fallback para query direta se a função falhar
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    
    console.log('🔐 Auth: Inicializando sistema de autenticação...');
    
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isSubscribed || isLoggingOut.current) return;
        
        console.log('🔐 Auth: Estado mudou -', event, session ? 'com sessão' : 'sem sessão');
        if (session?.user) {
          console.log('🔐 Auth: User ID:', session.user.id);
          console.log('🔐 Auth: Email:', session.user.email);
        }
        
        // Atualizar estados imediatamente
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('🔐 Auth: Usuário desconectado, limpando dados');
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Se há usuário, buscar perfil
        if (session?.user) {
          console.log('🔐 Auth: Buscando perfil após mudança de estado...');
          fetchProfile(session.user.id).then(profileData => {
            if (isSubscribed && !isLoggingOut.current) {
              console.log('🔐 Auth: Perfil carregado:', profileData ? 'sucesso' : 'falhou');
              setProfile(profileData);
              setLoading(false);
            }
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Verificar sessão existente na inicialização
    console.log('🔐 Auth: Verificando sessão existente...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isSubscribed || isLoggingOut.current) return;
      
      if (error) {
        console.error('🔐 Auth: Erro ao buscar sessão:', error);
        setLoading(false);
        return;
      }

      console.log('🔐 Auth: Sessão inicial:', session ? 'encontrada' : 'não encontrada');
      if (session?.user) {
        console.log('🔐 Auth: User ID inicial:', session.user.id);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('🔐 Auth: Buscando perfil inicial...');
        fetchProfile(session.user.id).then(profileData => {
          if (isSubscribed && !isLoggingOut.current) {
            console.log('🔐 Auth: Perfil inicial carregado:', profileData ? 'sucesso' : 'falhou');
            setProfile(profileData);
            setLoading(false);
          }
        });
      } else {
        console.log('🔐 Auth: Sem sessão inicial, finalizando loading');
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('🔐 Auth: Limpando listeners de autenticação');
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    console.log('🔐 Auth: Tentativa de login com:', emailOrUsername.includes('@') ? 'email' : 'username');
    
    try {
      let email = emailOrUsername;
      
      // Se não contém @, assume que é username e busca o email
      if (!emailOrUsername.includes('@')) {
        console.log('🔐 Auth: Buscando email por username...');
        try {
          const { data: emailResult, error: emailError } = await supabase
            .rpc('get_email_by_username', { 
              p_username: emailOrUsername.trim() 
            });
            
          if (emailError || !emailResult) {
            console.error('🔐 Auth: Username não encontrado:', emailError);
            toast({
              title: 'Erro no login',
              description: 'Nome de usuário não encontrado',
              variant: 'destructive',
            });
            return { error: new Error('Nome de usuário não encontrado') };
          }
          
          console.log('🔐 Auth: Email encontrado para username');
          email = emailResult;
        } catch (profileSearchError) {
          console.warn('🔐 Auth: Erro na busca por username, tentando como email:', profileSearchError);
          // Se falhar na busca por username, tentar usar como email mesmo
          email = emailOrUsername;
        }
      }

      console.log('🔐 Auth: Fazendo login com email...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('🔐 Auth: Erro no login:', error.message, 'Status:', (error as any).status);
        console.error('🔐 Auth: Erro completo:', JSON.stringify(error));
        let errorMessage = 'Erro ao fazer login';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email/usuário ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
        }
        
        toast({
          title: 'Erro no login',
          description: errorMessage,
          variant: 'destructive',
        });
        
        return { error };
      }

      console.log('🔐 Auth: Login realizado com sucesso!');
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao sistema de agendamentos.',
      });

      return { error: null };
    } catch (error) {
      console.error('🔐 Auth: Erro inesperado no login:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao fazer login',
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signUp = async (password: string, nome: string, username: string, email: string, clienteId?: string) => {
    try {
      // Verificar se o username já existe via RPC (funciona para anon)
      try {
        const { data: isAvailable, error: checkError } = await supabase
          .rpc('check_username_available', { p_username: username });
          
        if (!checkError && isAvailable === false) {
          toast({
            title: 'Erro no cadastro',
            description: 'Este nome de usuário já está em uso. Escolha outro.',
            variant: 'destructive',
          });
          return { error: new Error('Este nome de usuário já está em uso') };
        }
      } catch (usernameCheckError) {
        console.warn('Erro ao verificar username, continuando:', usernameCheckError);
      }

      // Verificar se o email já existe
      try {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email)
          .maybeSingle();
          
        if (existingUser) {
          toast({
            title: 'Erro no cadastro',
            description: 'Este email já está cadastrado',
            variant: 'destructive',
          });
          return { error: new Error('Este email já está cadastrado') };
        }
      } catch (emailCheckError) {
        // Se falhar na verificação de email, continuar com cadastro
        console.warn('Erro ao verificar email, continuando:', emailCheckError);
      }

      console.log('Criando usuário com email fornecido:', email, 'cliente_id:', clienteId);
      
      const signUpResult = await supabase.auth.signUp({
        email: email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: nome,
            username: username,
            role: 'recepcionista',
            cliente_id: clienteId || null
          }
        }
      });
      
      const { error } = signUpResult;

      if (error) {
        console.error('Erro no cadastro:', error);
        let errorMessage = 'Erro ao criar conta';
        
        if (error.message?.includes('Database error saving new user') || error.message?.includes('unique_violation')) {
          errorMessage = 'Nome de usuário já está em uso. Escolha outro nome de usuário.';
        } else if (error.message?.includes('email_address_invalid')) {
          errorMessage = 'Erro interno de validação. Tente novamente ou contate o administrador.';
        } else if (error.message?.includes('User already registered')) {
          errorMessage = 'Este usuário já está cadastrado. Você pode fazer login.';
        } else if (error.message?.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: 'Erro no cadastro',
          description: errorMessage,
          variant: 'destructive',
        });
        
        return { error };
      }

      // Sucesso no cadastro
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Sua conta será enviada para aprovação.',
      });

      return { error: null };
    } catch (error) {
      console.error('Erro inesperado no cadastro:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao criar conta',
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Marcar que estamos fazendo logout
      isLoggingOut.current = true;
      
      // Limpar elementos DOM do Google OAuth antes do logout
      console.log('🧹 Auth: Limpando elementos Google OAuth...');
      const removedElements = cleanupGoogleOAuthElements();
      if (removedElements > 0) {
        console.log(`🧹 Auth: Removidos ${removedElements} elementos órfãos do Google`);
      }
      
      // Limpar estados locais primeiro
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Limpar todo o localStorage do Supabase de forma mais efetiva
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('supabase') || key.includes('auth') || key.includes('session'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Limpar também o sessionStorage
      sessionStorage.clear();
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global'
      });
      
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      // Redirecionar para a página de auth
      window.location.href = '/auth';
      
      // Resetar a flag após um delay
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 1000);
      
    } catch (error) {
      // Mesmo com erro, limpar tudo
      isLoggingOut.current = true;
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Limpar storage com a mesma lógica
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('supabase') || key.includes('auth') || key.includes('session'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      sessionStorage.clear();
      
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      window.location.href = '/auth';
      
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 1000);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};