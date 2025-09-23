import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { waitForSession, ensureValidSession } from '@/utils/authHelpers';

// Import debug para desenvolvimento
if (process.env.NODE_ENV === 'development') {
  import('@/utils/authDebug');
}

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  status: string;
  username?: string;
  cliente_id: string; // Removido o "?" pois agora sempre terá cliente_id
  created_at: string;
  updated_at: string;
}

interface EmailStatusResponse {
  exists_in_auth: boolean;
  has_profile: boolean;
  email_confirmed: boolean;
  profile_status?: string;
  user_id?: string;
  status: 'can_register' | 'orphaned_user' | 'pending_approval' | 'approved_user' | 'rejected_user' | 'unknown_status';
}

interface RecoveryResponse {
  success: boolean;
  message?: string;
  error?: string;
  user_id?: string;
  profile_created?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nome: string, username: string) => Promise<{ error: any }>;
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
  const { toast } = useToast();
  const isLoggingOut = useRef(false);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      console.log('🔍 Fetching profile for user:', userId);
      
      // Aguardar que a sessão esteja completamente carregada
      await waitForSession(2000);
      
      // Primeiro, tenta usar a função SECURITY DEFINER
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_current_user_profile');

      if (!functionError && functionData && functionData.length > 0) {
        console.log('✅ Profile fetched via function:', functionData[0]);
        return functionData[0] as Profile;
      }

      console.warn('⚠️ Function failed, trying direct query:', functionError?.message);

      // Garantir que a sessão está válida antes da consulta direta
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        console.error('❌ Sessão inválida para consulta direta');
        return null;
      }

      // Fallback para query direta se a função falhar
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ Error fetching profile:', error.message);
        return null;
      }

      if (!data) {
        console.warn('⚠️ No profile found for user:', userId);
        return null;
      }

      console.log('✅ Profile fetched via direct query:', data);
      return data;
    } catch (error) {
      console.error('❌ Unexpected error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    let initialized = false;
    
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;
        
        // Se estamos fazendo logout, ignorar completamente qualquer evento
        if (isLoggingOut.current) {
          return;
        }
        
        // Só processar eventos após a inicialização OU se for SIGNED_OUT
        if (!initialized && event !== 'SIGNED_OUT') {
          return;
        }
        
        // Se for evento de logout ou não há sessão
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Se for login/signup após inicialização
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && initialized) {
          console.log('🔐 User signed in, fetching profile...');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Buscar perfil do usuário
            setTimeout(async () => {
              if (!isSubscribed || isLoggingOut.current) return;
              
              const profileData = await fetchProfile(session.user.id);
              if (!isLoggingOut.current) {
                setProfile(profileData);
                setLoading(false);
                
                // Check if user is approved
                if (profileData && profileData.status !== 'aprovado') {
                  console.log('⚠️ User not approved yet, status:', profileData.status);
                }
              }
            }, 100);
          } else {
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    // Verificar sessão existente APENAS na inicialização
    const initializeAuth = async () => {
      if (!isSubscribed || isLoggingOut.current) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isSubscribed || isLoggingOut.current) return;
        
        if (session && !error) {
          console.log('🔐 Initial session found, fetching profile...');
          setSession(session);
          setUser(session.user);
          
          const profileData = await fetchProfile(session.user.id);
          if (!isSubscribed || isLoggingOut.current) return;
          
          setProfile(profileData);
          setLoading(false);
          
          // Check if user is approved
          if (profileData && profileData.status !== 'aprovado') {
            console.log('⚠️ User not approved yet, status:', profileData.status);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        
        // Marcar como inicializado APÓS processar a sessão inicial
        initialized = true;
        
      } catch (error) {
        if (!isSubscribed || isLoggingOut.current) return;
        
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        initialized = true;
      }
    };
    
    // Executar inicialização
    initializeAuth();

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    try {
      let email = emailOrUsername.trim();
      
      // Se não contém @, assume que é username e busca o email
      if (!emailOrUsername.trim().includes('@')) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', emailOrUsername.trim())
            .maybeSingle();
            
          if (profileError || !profile) {
            toast({
              title: 'Erro no login',
              description: 'Nome de usuário não encontrado',
              variant: 'destructive',
            });
            return { error: new Error('Nome de usuário não encontrado') };
          }
          
          email = profile.email;
        } catch (profileSearchError) {
          // Se falhar na busca por username, tratar como email mesmo
          console.warn('Erro ao buscar username, usando como email:', profileSearchError);
          email = emailOrUsername.trim();
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
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

      // APENAS mostrar sucesso se não houve erro
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao sistema de agendamentos.',
      });

      return { error: null };
    } catch (error) {
      console.error('Erro inesperado no login:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao fazer login',
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, nome: string, username: string) => {
    try {
      // Primeiro, verificar o status do email
      const { data: emailStatus } = await supabase
        .rpc('verificar_status_email', { p_email: email });

      const emailStatusData = emailStatus as unknown as EmailStatusResponse;

      if (emailStatusData?.status === 'approved_user') {
        toast({
          title: "Email já cadastrado",
          description: "Este email já possui uma conta aprovada. Tente fazer login.",
          variant: "destructive",
        });
        return { error: new Error('Email já possui conta aprovada') };
      }

      if (emailStatusData?.status === 'pending_approval') {
        toast({
          title: "Cadastro pendente",
          description: "Este email já possui um cadastro aguardando aprovação do administrador.",
          variant: "destructive",
        });
        return { error: new Error('Cadastro pendente de aprovação') };
      }

      if (emailStatusData?.status === 'orphaned_user') {
        // Tentar recuperar usuário órfão
        const { data: recovery } = await supabase
          .rpc('recuperar_usuario_orfao', {
            p_email: email,
            p_nome: nome,
            p_role: 'recepcionista'
          });

        const recoveryData = recovery as unknown as RecoveryResponse;

        if (recoveryData?.success) {
          toast({
            title: "Conta recuperada!",
            description: "Sua conta foi recuperada e aprovada. Você pode fazer login agora.",
            variant: "default",
          });
          return { error: null };
        } else {
          toast({
            title: "Erro na recuperação",
            description: recoveryData?.error || "Não foi possível recuperar a conta. Entre em contato com o administrador.",
            variant: "destructive",
          });
          return { error: new Error(recoveryData?.error || 'Erro na recuperação de conta') };
        }
      }

      // Verificar se o username já existe
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .maybeSingle();
          
        if (existingProfile) {
          toast({
            title: 'Erro no cadastro',
            description: 'Este nome de usuário já está em uso',
            variant: 'destructive',
          });
          return { error: new Error('Este nome de usuário já está em uso') };
        }
      } catch (usernameCheckError) {
        // Se falhar na verificação de username, continuar com cadastro
        console.warn('Erro ao verificar username, continuando:', usernameCheckError);
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: nome,
            username: username,
            role: 'recepcionista'
          }
        }
      });

      if (error) {
        console.error('❌ Erro no cadastro:', error);
        
        let errorMessage = 'Erro ao criar conta';
        
        if (error.message.includes('Email address') && error.message.includes('invalid')) {
          errorMessage = "Email inválido ou já existe com problema no sistema. Entre em contato com o administrador.";
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado. Você pode fazer login.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        } else {
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
        description: 'Sua conta será enviada para aprovação. Aguarde a confirmação por email.',
      });

      return { error: null };
    } catch (error) {
      console.error('Erro inesperado no cadastro:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao criar conta. Tente novamente.',
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Marcar que estamos fazendo logout
      isLoggingOut.current = true;
      
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