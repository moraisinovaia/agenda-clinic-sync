import { useState, useEffect, createContext, useContext, useRef } from 'react';
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
  const navigate = useNavigate();
  const isLoggingOut = useRef(false);

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
    let isSubscribed = true;
    
    // Configurar listener de mudanças de autenticação PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;
        
        console.log('🔄 Auth state changed:', event, session ? 'com sessão' : 'sem sessão');
        
        // Se estamos fazendo logout, ignorar qualquer nova sessão
        if (isLoggingOut.current) {
          console.log('🚫 Logout em andamento, ignorando auth state change');
          return;
        }
        
        // Se for evento de logout ou não há sessão
        if (event === 'SIGNED_OUT' || !session) {
          console.log('🚪 Usuário fez logout, limpando estados...');
          if (!isLoggingOut.current) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        
        // Se for login/signup e não estamos fazendo logout
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !isLoggingOut.current) {
          console.log('🔑 Usuário logado, configurando sessão...');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Buscar perfil do usuário
            setTimeout(async () => {
              if (!isSubscribed || isLoggingOut.current) return;
              
              let profileData = await fetchProfile(session.user.id);
              
              if (!profileData && !isLoggingOut.current) {
                console.log('🔄 Perfil não encontrado, tentando novamente em 2 segundos...');
                setTimeout(async () => {
                  if (!isSubscribed || isLoggingOut.current) return;
                  profileData = await fetchProfile(session.user.id);
                  if (!isLoggingOut.current) {
                    setProfile(profileData);
                    setLoading(false);
                  }
                }, 2000);
              } else if (!isLoggingOut.current) {
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

    // Verificar sessão existente APENAS se não estamos fazendo logout
    if (!isLoggingOut.current) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isSubscribed || isLoggingOut.current) return;
        
        console.log('🔍 Verificando sessão existente:', session ? 'encontrada' : 'não encontrada');
        
        if (session) {
          setSession(session);
          setUser(session.user);
          
          fetchProfile(session.user.id).then((profileData) => {
            if (!isSubscribed || isLoggingOut.current) return;
            setProfile(profileData);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
    }

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
      
      // Marcar que estamos fazendo logout
      isLoggingOut.current = true;
      
      // Limpar estados locais primeiro
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Limpar todo o localStorage do Supabase
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('supabase.auth.')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Limpar também o sessionStorage
      sessionStorage.clear();
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global'
      });
      
      if (error) {
        console.error('⚠️ Erro no logout do Supabase:', error);
      }
      
      console.log('✅ Logout realizado com sucesso');
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      // Usar navigate em vez de window.location.href
      navigate('/auth', { replace: true });
      
      // Resetar a flag após um delay
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      
      // Mesmo com erro, limpar tudo
      isLoggingOut.current = true;
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      
      // Limpar storage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('supabase.auth.')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();
      
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      
      navigate('/auth', { replace: true });
      
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