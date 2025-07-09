import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
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

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Buscando perfil para usuário:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Usar maybeSingle para evitar erro se não encontrar

      if (error) {
        console.error('❌ Erro ao buscar perfil:', error);
        return null;
      }

      if (!data) {
        console.log('⚠️ Perfil não encontrado, pode estar sendo criado pelo trigger');
        return null;
      }

      console.log('✅ Perfil encontrado:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      return null;
    }
  };

  useEffect(() => {
    let isSubscribed = true; // Flag para evitar atualizações após desmontagem
    
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return; // Ignorar se componente foi desmontado
        
        console.log('🔄 Auth state changed:', event, session ? 'com sessão' : 'sem sessão');
        
        // Se for evento de logout, limpar tudo imediatamente
        if (event === 'SIGNED_OUT' || !session) {
          console.log('🚪 Usuário fez logout, limpando estados...');
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Se for login/signup
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔑 Usuário logado, configurando sessão...');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Buscar perfil do usuário com retry se não encontrar
            setTimeout(async () => {
              if (!isSubscribed) return;
              
              let profileData = await fetchProfile(session.user.id);
              
              // Se não encontrou o perfil, tentar novamente após um delay (trigger pode estar processando)
              if (!profileData) {
                console.log('🔄 Perfil não encontrado, tentando novamente em 2 segundos...');
                setTimeout(async () => {
                  if (!isSubscribed) return;
                  profileData = await fetchProfile(session.user.id);
                  setProfile(profileData);
                  setLoading(false);
                }, 2000);
              } else {
                setProfile(profileData);
                setLoading(false);
              }
            }, 0);
          } else {
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    // Verificar sessão existente APENAS na inicialização
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isSubscribed) return;
      
      console.log('🔍 Verificando sessão existente:', session ? 'encontrada' : 'não encontrada');
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          if (!isSubscribed) return;
          setProfile(profileData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = 'Erro ao fazer login';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
        }
        
        toast({
          title: 'Erro no login',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Login realizado',
          description: 'Bem-vindo ao sistema!',
        });
      }

      return { error };
    } catch (error) {
      console.error('Erro no login:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao fazer login',
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: nome,
            role: 'recepcionista'
          }
        }
      });

      if (error) {
        let errorMessage = 'Erro ao criar conta';
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        }
        
        toast({
          title: 'Erro no cadastro',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Conta criada',
          description: 'Verifique seu email para confirmar a conta.',
        });
      }

      return { error };
    } catch (error) {
      console.error('Erro no cadastro:', error);
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
      console.log('🚪 Iniciando processo de logout...');
      
      // Primeiro limpar estados locais para evitar re-login automático
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Fazer logout no Supabase com configuração específica
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Logout de todas as sessões
      });
      
      if (error) {
        console.error('⚠️ Erro no logout do Supabase:', error);
        // Continuar mesmo com erro - o importante é que limpamos os estados locais
      }
      
      // Limpar storage local manualmente para garantir
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      console.log('✅ Logout realizado com sucesso');
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      // Forçar redirecionamento após um pequeno delay
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
      
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      
      // Mesmo com erro, limpar tudo e redirecionar
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Limpar storage manual
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
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