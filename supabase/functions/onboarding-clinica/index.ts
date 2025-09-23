import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OnboardingData {
  clinica: {
    nome: string;
    logo_url: string;
    configuracoes: any;
  };
  admin: {
    nome: string;
    email: string;
    password: string;
    username: string;
  };
  especialidades: string[];
  atendimentos_customizados: any[];
}

const ESPECIALIDADES_TEMPLATES = {
  "Cardiologia": {
    medicos_padrao: ["Dr. João Cardoso"],
    atendimentos: [
      { nome: "Consulta Cardiológica", tipo: "consulta", valor_particular: 200, codigo: "CARD001" },
      { nome: "Ecocardiograma", tipo: "exame", valor_particular: 150, codigo: "CARD002" },
      { nome: "ECG", tipo: "exame", valor_particular: 80, codigo: "CARD003" },
      { nome: "Teste Ergométrico", tipo: "exame", valor_particular: 250, codigo: "CARD004" }
    ]
  },
  "Gastroenterologia": {
    medicos_padrao: ["Dr. Maria Santos"],
    atendimentos: [
      { nome: "Consulta Gastroenterológica", tipo: "consulta", valor_particular: 220, codigo: "GAST001" },
      { nome: "Endoscopia", tipo: "procedimento", valor_particular: 400, codigo: "GAST002" },
      { nome: "Colonoscopia", tipo: "procedimento", valor_particular: 500, codigo: "GAST003" },
      { nome: "Ultrassom Abdominal", tipo: "exame", valor_particular: 120, codigo: "GAST004" }
    ]
  },
  "Dermatologia": {
    medicos_padrao: ["Dra. Ana Silva"],
    atendimentos: [
      { nome: "Consulta Dermatológica", tipo: "consulta", valor_particular: 180, codigo: "DERM001" },
      { nome: "Biópsia", tipo: "procedimento", valor_particular: 300, codigo: "DERM002" },
      { nome: "Cauterização", tipo: "procedimento", valor_particular: 150, codigo: "DERM003" },
      { nome: "Dermatoscopia", tipo: "exame", valor_particular: 100, codigo: "DERM004" }
    ]
  },
  "Ortopedia": {
    medicos_padrao: ["Dr. Carlos Mendes"],
    atendimentos: [
      { nome: "Consulta Ortopédica", tipo: "consulta", valor_particular: 200, codigo: "ORTO001" },
      { nome: "Raio-X", tipo: "exame", valor_particular: 80, codigo: "ORTO002" },
      { nome: "Infiltração", tipo: "procedimento", valor_particular: 250, codigo: "ORTO003" },
      { nome: "Fisioterapia", tipo: "tratamento", valor_particular: 60, codigo: "ORTO004" }
    ]
  },
  "Pediatria": {
    medicos_padrao: ["Dra. Lucia Oliveira"],
    atendimentos: [
      { nome: "Consulta Pediátrica", tipo: "consulta", valor_particular: 160, codigo: "PEDI001" },
      { nome: "Puericultura", tipo: "consulta", valor_particular: 140, codigo: "PEDI002" },
      { nome: "Vacinação", tipo: "procedimento", valor_particular: 50, codigo: "PEDI003" },
      { nome: "Teste do Pezinho", tipo: "exame", valor_particular: 80, codigo: "PEDI004" }
    ]
  },
  "Ginecologia": {
    medicos_padrao: ["Dra. Fernanda Lima"],
    atendimentos: [
      { nome: "Consulta Ginecológica", tipo: "consulta", valor_particular: 200, codigo: "GINE001" },
      { nome: "Preventivo", tipo: "exame", valor_particular: 100, codigo: "GINE002" },
      { nome: "Ultrassom Pélvico", tipo: "exame", valor_particular: 120, codigo: "GINE003" },
      { nome: "Colposcopia", tipo: "exame", valor_particular: 180, codigo: "GINE004" }
    ]
  },
  "Neurologia": {
    medicos_padrao: ["Dr. Roberto Alves"],
    atendimentos: [
      { nome: "Consulta Neurológica", tipo: "consulta", valor_particular: 250, codigo: "NEUR001" },
      { nome: "Eletroencefalograma", tipo: "exame", valor_particular: 200, codigo: "NEUR002" },
      { nome: "Eletromiografia", tipo: "exame", valor_particular: 300, codigo: "NEUR003" },
      { nome: "Doppler Transcraniano", tipo: "exame", valor_particular: 250, codigo: "NEUR004" }
    ]
  },
  "Oftalmologia": {
    medicos_padrao: ["Dr. Paulo Costa"],
    atendimentos: [
      { nome: "Consulta Oftalmológica", tipo: "consulta", valor_particular: 180, codigo: "OFTA001" },
      { nome: "Exame de Vista", tipo: "exame", valor_particular: 80, codigo: "OFTA002" },
      { nome: "Tonometria", tipo: "exame", valor_particular: 60, codigo: "OFTA003" },
      { nome: "Fundo de Olho", tipo: "exame", valor_particular: 100, codigo: "OFTA004" }
    ]
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { clinica, admin, especialidades, atendimentos_customizados }: OnboardingData = await req.json();

    console.log('Iniciando criação da clínica:', clinica.nome);

    // 1. Criar clínica
    const { data: novaClinica, error: clinicaError } = await supabaseClient
      .from('clientes')
      .insert({
        nome: clinica.nome,
        logo_url: clinica.logo_url || null,
        configuracoes: clinica.configuracoes,
        ativo: true
      })
      .select('id')
      .single();

    if (clinicaError) {
      console.error('Erro ao criar clínica:', clinicaError);
      throw new Error(`Erro ao criar clínica: ${clinicaError.message}`);
    }

    const clienteId = novaClinica.id;
    console.log('Clínica criada com ID:', clienteId);

    // 2. Criar usuário admin na auth
    const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true,
      user_metadata: {
        nome: admin.nome,
        role: 'admin',
        username: admin.username
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário:', authError);
      // Rollback: deletar clínica
      await supabaseClient.from('clientes').delete().eq('id', clienteId);
      throw new Error(`Erro ao criar usuário: ${authError.message}`);
    }

    console.log('Usuário criado com ID:', authUser.user?.id);

    // 3. Criar profile do admin
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        user_id: authUser.user!.id,
        nome: admin.nome,
        email: admin.email,
        username: admin.username,
        role: 'admin',
        status: 'aprovado',
        cliente_id: clienteId,
        ativo: true
      });

    if (profileError) {
      console.error('Erro ao criar profile:', profileError);
      // Rollback: deletar usuário e clínica
      await supabaseClient.auth.admin.deleteUser(authUser.user!.id);
      await supabaseClient.from('clientes').delete().eq('id', clienteId);
      throw new Error(`Erro ao criar profile: ${profileError.message}`);
    }

    console.log('Profile criado para o usuário');

    // 4. Criar médicos e atendimentos para cada especialidade
    const medicosIds: string[] = [];
    const atendimentosIds: string[] = [];

    for (const especialidade of especialidades) {
      const template = ESPECIALIDADES_TEMPLATES[especialidade];
      if (!template) continue;

      // Criar médico
      const { data: medico, error: medicoError } = await supabaseClient
        .from('medicos')
        .insert({
          nome: template.medicos_padrao[0],
          especialidade,
          cliente_id: clienteId,
          ativo: true,
          convenios_aceitos: ['Particular', 'Unimed', 'Bradesco', 'SulAmérica'],
          horarios: {
            segunda: { inicio: "08:00", fim: "17:00", intervalos: [{ inicio: "12:00", fim: "13:00" }] },
            terca: { inicio: "08:00", fim: "17:00", intervalos: [{ inicio: "12:00", fim: "13:00" }] },
            quarta: { inicio: "08:00", fim: "17:00", intervalos: [{ inicio: "12:00", fim: "13:00" }] },
            quinta: { inicio: "08:00", fim: "17:00", intervalos: [{ inicio: "12:00", fim: "13:00" }] },
            sexta: { inicio: "08:00", fim: "17:00", intervalos: [{ inicio: "12:00", fim: "13:00" }] }
          }
        })
        .select('id')
        .single();

      if (medicoError) {
        console.error('Erro ao criar médico:', medicoError);
        continue;
      }

      medicosIds.push(medico.id);
      console.log(`Médico criado: ${template.medicos_padrao[0]} (${especialidade})`);

      // Criar atendimentos
      for (const atendimento of template.atendimentos) {
        const { data: novoAtendimento, error: atendimentoError } = await supabaseClient
          .from('atendimentos')
          .insert({
            nome: atendimento.nome,
            tipo: atendimento.tipo,
            codigo: atendimento.codigo,
            valor_particular: atendimento.valor_particular,
            medico_id: medico.id,
            medico_nome: template.medicos_padrao[0],
            cliente_id: clienteId,
            ativo: true,
            forma_pagamento: 'particular_convenio',
            coparticipacao_unimed_20: Math.round(atendimento.valor_particular * 0.2),
            coparticipacao_unimed_40: Math.round(atendimento.valor_particular * 0.4)
          })
          .select('id')
          .single();

        if (atendimentoError) {
          console.error('Erro ao criar atendimento:', atendimentoError);
          continue;
        }

        atendimentosIds.push(novoAtendimento.id);
      }
    }

    // 5. Criar configurações do sistema
    const configuracoes = [
      {
        key: 'horario_funcionamento_inicio',
        value: '08:00',
        description: 'Horário de início do funcionamento',
        category: 'horarios'
      },
      {
        key: 'horario_funcionamento_fim', 
        value: '18:00',
        description: 'Horário de fim do funcionamento',
        category: 'horarios'
      },
      {
        key: 'whatsapp_ativo',
        value: 'false',
        description: 'Ativar notificações WhatsApp',
        category: 'notificacoes'
      },
      {
        key: 'confirmacao_automatica',
        value: 'false',
        description: 'Confirmação automática de agendamentos',
        category: 'agendamentos'
      }
    ];

    for (const config of configuracoes) {
      await supabaseClient
        .from('system_settings')
        .insert(config)
        .select('id')
        .single();
    }

    // Log de sucesso
    await supabaseClient.from('system_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Nova clínica criada via onboarding: ${clinica.nome}`,
      context: 'ONBOARDING_SUCCESS',
      data: {
        cliente_id: clienteId,
        admin_email: admin.email,
        especialidades: especialidades,
        medicos_criados: medicosIds.length,
        atendimentos_criados: atendimentosIds.length
      }
    });

    console.log('Onboarding concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Clínica criada com sucesso!',
        data: {
          cliente_id: clienteId,
          admin_id: authUser.user?.id,
          medicos_criados: medicosIds.length,
          atendimentos_criados: atendimentosIds.length,
          especialidades: especialidades
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Erro no onboarding:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});