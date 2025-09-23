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
  "Anestesiologia": {
    medicos_padrao: ["Dr. Eduardo Anestesista"],
    atendimentos: [
      { nome: "Consulta Pré-Anestésica", tipo: "consulta", valor_particular: 180, codigo: "ANES001" },
      { nome: "Bloqueio Anestésico", tipo: "procedimento", valor_particular: 300, codigo: "ANES002" },
      { nome: "Anestesia para Procedimentos", tipo: "procedimento", valor_particular: 400, codigo: "ANES003" },
      { nome: "Controle da Dor", tipo: "tratamento", valor_particular: 200, codigo: "ANES004" }
    ]
  },
  "Cardiologia": {
    medicos_padrao: ["Dr. João Cardoso"],
    atendimentos: [
      { nome: "Consulta Cardiológica", tipo: "consulta", valor_particular: 200, codigo: "CARD001" },
      { nome: "Ecocardiograma", tipo: "exame", valor_particular: 150, codigo: "CARD002" },
      { nome: "ECG", tipo: "exame", valor_particular: 80, codigo: "CARD003" },
      { nome: "Teste Ergométrico", tipo: "exame", valor_particular: 250, codigo: "CARD004" }
    ]
  },
  "Cirurgia Geral": {
    medicos_padrao: ["Dr. Ricardo Cirurgião"],
    atendimentos: [
      { nome: "Consulta Cirúrgica", tipo: "consulta", valor_particular: 200, codigo: "CIRG001" },
      { nome: "Pequena Cirurgia", tipo: "procedimento", valor_particular: 500, codigo: "CIRG002" },
      { nome: "Remoção de Lesão", tipo: "procedimento", valor_particular: 300, codigo: "CIRG003" },
      { nome: "Sutura", tipo: "procedimento", valor_particular: 150, codigo: "CIRG004" }
    ]
  },
  "Cirurgia Plástica": {
    medicos_padrao: ["Dra. Isabela Plastic"],
    atendimentos: [
      { nome: "Consulta Cirurgia Plástica", tipo: "consulta", valor_particular: 250, codigo: "PLAT001" },
      { nome: "Avaliação Estética", tipo: "consulta", valor_particular: 200, codigo: "PLAT002" },
      { nome: "Preenchimento", tipo: "procedimento", valor_particular: 600, codigo: "PLAT003" },
      { nome: "Botox", tipo: "procedimento", valor_particular: 800, codigo: "PLAT004" }
    ]
  },
  "Clínica Médica": {
    medicos_padrao: ["Dr. José Clínico"],
    atendimentos: [
      { nome: "Consulta Clínica Geral", tipo: "consulta", valor_particular: 150, codigo: "CLIN001" },
      { nome: "Check-up Geral", tipo: "consulta", valor_particular: 200, codigo: "CLIN002" },
      { nome: "Avaliação Médica", tipo: "consulta", valor_particular: 160, codigo: "CLIN003" },
      { nome: "Medicina Preventiva", tipo: "consulta", valor_particular: 180, codigo: "CLIN004" }
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
  "Endocrinologia": {
    medicos_padrao: ["Dra. Helena Endocrina"],
    atendimentos: [
      { nome: "Consulta Endocrinológica", tipo: "consulta", valor_particular: 220, codigo: "ENDO001" },
      { nome: "Avaliação Hormonal", tipo: "consulta", valor_particular: 200, codigo: "ENDO002" },
      { nome: "Tratamento Diabetes", tipo: "tratamento", valor_particular: 180, codigo: "ENDO003" },
      { nome: "Avaliação Tireoide", tipo: "exame", valor_particular: 150, codigo: "ENDO004" }
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
  "Geriatria": {
    medicos_padrao: ["Dr. Antônio Geriatra"],
    atendimentos: [
      { nome: "Consulta Geriátrica", tipo: "consulta", valor_particular: 200, codigo: "GERI001" },
      { nome: "Avaliação Cognitiva", tipo: "exame", valor_particular: 180, codigo: "GERI002" },
      { nome: "Cuidados Paliativos", tipo: "tratamento", valor_particular: 220, codigo: "GERI003" },
      { nome: "Medicina do Idoso", tipo: "consulta", valor_particular: 190, codigo: "GERI004" }
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
  "Hematologia": {
    medicos_padrao: ["Dr. Marcos Hematologista"],
    atendimentos: [
      { nome: "Consulta Hematológica", tipo: "consulta", valor_particular: 240, codigo: "HEMA001" },
      { nome: "Mielograma", tipo: "exame", valor_particular: 400, codigo: "HEMA002" },
      { nome: "Biópsia Medula", tipo: "procedimento", valor_particular: 600, codigo: "HEMA003" },
      { nome: "Transfusão", tipo: "procedimento", valor_particular: 500, codigo: "HEMA004" }
    ]
  },
  "Infectologia": {
    medicos_padrao: ["Dra. Carla Infectologista"],
    atendimentos: [
      { nome: "Consulta Infectológica", tipo: "consulta", valor_particular: 220, codigo: "INFEC001" },
      { nome: "Avaliação IST", tipo: "consulta", valor_particular: 200, codigo: "INFEC002" },
      { nome: "Medicina Tropical", tipo: "consulta", valor_particular: 240, codigo: "INFEC003" },
      { nome: "Controle de Infecção", tipo: "tratamento", valor_particular: 180, codigo: "INFEC004" }
    ]
  },
  "Mastologia": {
    medicos_padrao: ["Dra. Sandra Mastologista"],
    atendimentos: [
      { nome: "Consulta Mastológica", tipo: "consulta", valor_particular: 200, codigo: "MAST001" },
      { nome: "Ultrassom Mama", tipo: "exame", valor_particular: 150, codigo: "MAST002" },
      { nome: "Biópsia Mama", tipo: "procedimento", valor_particular: 400, codigo: "MAST003" },
      { nome: "Core Biopsy", tipo: "procedimento", valor_particular: 500, codigo: "MAST004" }
    ]
  },
  "Medicina do Trabalho": {
    medicos_padrao: ["Dr. Bruno Trabalho"],
    atendimentos: [
      { nome: "Exame Ocupacional", tipo: "exame", valor_particular: 80, codigo: "TRAB001" },
      { nome: "ASO", tipo: "exame", valor_particular: 100, codigo: "TRAB002" },
      { nome: "Perícia Trabalhista", tipo: "consulta", valor_particular: 200, codigo: "TRAB003" },
      { nome: "Medicina Preventiva", tipo: "consulta", valor_particular: 150, codigo: "TRAB004" }
    ]
  },
  "Nefrologia": {
    medicos_padrao: ["Dr. Felipe Nefrologista"],
    atendimentos: [
      { nome: "Consulta Nefrológica", tipo: "consulta", valor_particular: 240, codigo: "NEFR001" },
      { nome: "Biópsia Renal", tipo: "procedimento", valor_particular: 800, codigo: "NEFR002" },
      { nome: "Hemodiálise", tipo: "tratamento", valor_particular: 300, codigo: "NEFR003" },
      { nome: "Transplante Renal", tipo: "procedimento", valor_particular: 1200, codigo: "NEFR004" }
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
  },
  "Oncologia": {
    medicos_padrao: ["Dra. Lívia Oncologista"],
    atendimentos: [
      { nome: "Consulta Oncológica", tipo: "consulta", valor_particular: 300, codigo: "ONCO001" },
      { nome: "Quimioterapia", tipo: "tratamento", valor_particular: 800, codigo: "ONCO002" },
      { nome: "Radioterapia", tipo: "tratamento", valor_particular: 600, codigo: "ONCO003" },
      { nome: "Biópsia Oncológica", tipo: "procedimento", valor_particular: 500, codigo: "ONCO004" }
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
  "Otorrinolaringologia": {
    medicos_padrao: ["Dr. Gabriel Otorrino"],
    atendimentos: [
      { nome: "Consulta Otorrinolaringológica", tipo: "consulta", valor_particular: 200, codigo: "OTOR001" },
      { nome: "Audiometria", tipo: "exame", valor_particular: 100, codigo: "OTOR002" },
      { nome: "Nasofibrolaringoscopia", tipo: "exame", valor_particular: 150, codigo: "OTOR003" },
      { nome: "Remoção Cerume", tipo: "procedimento", valor_particular: 80, codigo: "OTOR004" }
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
  "Pneumologia": {
    medicos_padrao: ["Dr. André Pneumologista"],
    atendimentos: [
      { nome: "Consulta Pneumológica", tipo: "consulta", valor_particular: 220, codigo: "PNEU001" },
      { nome: "Espirometria", tipo: "exame", valor_particular: 120, codigo: "PNEU002" },
      { nome: "Broncoscopia", tipo: "procedimento", valor_particular: 400, codigo: "PNEU003" },
      { nome: "Teste do Sono", tipo: "exame", valor_particular: 300, codigo: "PNEU004" }
    ]
  },
  "Proctologia": {
    medicos_padrao: ["Dr. Renato Proctologista"],
    atendimentos: [
      { nome: "Consulta Proctológica", tipo: "consulta", valor_particular: 200, codigo: "PROC001" },
      { nome: "Colonoscopia", tipo: "procedimento", valor_particular: 500, codigo: "PROC002" },
      { nome: "Anuscopia", tipo: "exame", valor_particular: 120, codigo: "PROC003" },
      { nome: "Hemorroidectomia", tipo: "procedimento", valor_particular: 800, codigo: "PROC004" }
    ]
  },
  "Psiquiatria": {
    medicos_padrao: ["Dra. Marina Psiquiatra"],
    atendimentos: [
      { nome: "Consulta Psiquiátrica", tipo: "consulta", valor_particular: 250, codigo: "PSIQ001" },
      { nome: "Psicoterapia", tipo: "tratamento", valor_particular: 180, codigo: "PSIQ002" },
      { nome: "Avaliação Psicológica", tipo: "exame", valor_particular: 200, codigo: "PSIQ003" },
      { nome: "Terapia de Grupo", tipo: "tratamento", valor_particular: 100, codigo: "PSIQ004" }
    ]
  },
  "Radiologia": {
    medicos_padrao: ["Dr. Henrique Radiologista"],
    atendimentos: [
      { nome: "Raio-X", tipo: "exame", valor_particular: 80, codigo: "RADI001" },
      { nome: "Tomografia", tipo: "exame", valor_particular: 300, codigo: "RADI002" },
      { nome: "Ressonância Magnética", tipo: "exame", valor_particular: 500, codigo: "RADI003" },
      { nome: "Ultrassom", tipo: "exame", valor_particular: 120, codigo: "RADI004" }
    ]
  },
  "Reumatologia": {
    medicos_padrao: ["Dra. Patrícia Reumatologista"],
    atendimentos: [
      { nome: "Consulta Reumatológica", tipo: "consulta", valor_particular: 220, codigo: "REUM001" },
      { nome: "Infiltração Articular", tipo: "procedimento", valor_particular: 300, codigo: "REUM002" },
      { nome: "Densitometria", tipo: "exame", valor_particular: 150, codigo: "REUM003" },
      { nome: "Biópsia Sinovial", tipo: "procedimento", valor_particular: 400, codigo: "REUM004" }
    ]
  },
  "Urologia": {
    medicos_padrao: ["Dr. Thiago Urologista"],
    atendimentos: [
      { nome: "Consulta Urológica", tipo: "consulta", valor_particular: 200, codigo: "UROL001" },
      { nome: "Cistoscopia", tipo: "procedimento", valor_particular: 350, codigo: "UROL002" },
      { nome: "Biópsia Próstata", tipo: "procedimento", valor_particular: 500, codigo: "UROL003" },
      { nome: "Ultrassom Próstata", tipo: "exame", valor_particular: 150, codigo: "UROL004" }
    ]
  },
  "Cirurgia Vascular": {
    medicos_padrao: ["Dr. Vinicius Vascular"],
    atendimentos: [
      { nome: "Consulta Vascular", tipo: "consulta", valor_particular: 220, codigo: "VASC001" },
      { nome: "Doppler Vascular", tipo: "exame", valor_particular: 180, codigo: "VASC002" },
      { nome: "Escleroterapia", tipo: "procedimento", valor_particular: 300, codigo: "VASC003" },
      { nome: "Angioplastia", tipo: "procedimento", valor_particular: 1000, codigo: "VASC004" }
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