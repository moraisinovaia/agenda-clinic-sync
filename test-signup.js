// Script de teste para criar uma conta de teste
// Execute este código no console do navegador na página /auth

async function testarCadastro() {
  console.log('🧪 Iniciando teste de cadastro...');
  
  const testData = {
    email: 'teste@exemplo.com',
    password: 'teste123',
    nome: 'Usuário Teste',
    username: 'teste_user',
    role: 'recepcionista'
  };
  
  try {
    // Primeiro verificar se já existe o username
    const { data: existingUser } = await window.supabase
      .from('profiles')
      .select('username')
      .eq('username', testData.username)
      .single();
      
    if (existingUser) {
      console.log('❌ Username já existe');
      return;
    }
    
    // Criar a conta
    const { data, error } = await window.supabase.auth.signUp({
      email: testData.email,
      password: testData.password,
      options: {
        data: {
          nome: testData.nome,
          username: testData.username,
          role: testData.role
        },
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    
    if (error) {
      console.error('❌ Erro no cadastro:', error);
      console.log('Detalhes:', error.message);
    } else {
      console.log('✅ Conta criada com sucesso!');
      console.log('ID do usuário:', data.user?.id);
      console.log('Email:', data.user?.email);
      
      // Verificar se o perfil foi criado
      setTimeout(async () => {
        const { data: profile, error: profileError } = await window.supabase
          .from('profiles')
          .select('*')
          .eq('email', testData.email)
          .single();
          
        if (profileError) {
          console.error('❌ Erro ao buscar perfil:', profileError);
        } else {
          console.log('✅ Perfil criado:', profile);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar o teste
testarCadastro();