import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PeriodoConfig {
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
  limite_pacientes: number;
  hora_inicio_medico?: string;
  hora_distribuicao_fichas?: string;
}

interface ServicoConfig {
  nome: string;
  tipo: 'exame' | 'consulta' | 'procedimento';
  disponivel_online: boolean;
  mensagem_personalizada: string;
  dias_atendimento: string[];
  periodos: {
    manha: PeriodoConfig;
    tarde: PeriodoConfig;
    noite: PeriodoConfig;
  };
}

interface PreparoConfig {
  nome: string;
  exame_relacionado: string;
  jejum_horas: number;
  restricoes_alimentares: string;
  medicacao_suspender: string;
  dias_suspensao: number;
  itens_levar: string;
  valor_particular: number;
  valor_convenio: number;
  formas_pagamento: string[];
  observacoes_especiais: string;
}

interface DoctorOnboardingData {
  cliente_id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
  idade_minima: number | null;
  idade_maxima: number | null;
  atende_criancas: boolean;
  atende_adultos: boolean;
  convenios_aceitos: string[];
  convenios_restricoes: Record<string, string>;
  tipo_agendamento: 'ordem_chegada' | 'hora_marcada';
  permite_agendamento_online: boolean;
  servicos: ServicoConfig[];
  observacoes_gerais: string;
  regras_especiais: string;
  restricoes_gerais: string;
  preparos: PreparoConfig[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: DoctorOnboardingData = await req.json();
    console.log('Dados recebidos:', JSON.stringify(data, null, 2));

    // Validar cliente_id
    if (!data.cliente_id) {
      return new Response(
        JSON.stringify({ error: 'cliente_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('id', data.cliente_id)
      .single();

    if (clienteError || !cliente) {
      console.error('Erro ao buscar cliente:', clienteError);
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cliente encontrado:', cliente.nome);

    // 1. Criar o médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .insert({
        cliente_id: data.cliente_id,
        nome: data.nome,
        especialidade: data.especialidade,
        ativo: data.ativo,
        idade_minima: data.idade_minima,
        idade_maxima: data.idade_maxima,
        convenios_aceitos: data.convenios_aceitos,
        convenios_restricoes: data.convenios_restricoes,
        observacoes: data.observacoes_gerais
      })
      .select()
      .single();

    if (medicoError) {
      console.error('Erro ao criar médico:', medicoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar médico', details: medicoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Médico criado:', medico.id);

    // 2. Criar atendimentos (serviços)
    const atendimentosData = data.servicos.map(servico => ({
      cliente_id: data.cliente_id,
      medico_id: medico.id,
      medico_nome: data.nome,
      nome: servico.nome,
      tipo: servico.tipo,
      ativo: true,
      observacoes: servico.mensagem_personalizada,
      horarios: {
        dias_atendimento: servico.dias_atendimento,
        periodos: servico.periodos,
        disponivel_online: servico.disponivel_online
      }
    }));

    if (atendimentosData.length > 0) {
      const { error: atendimentosError } = await supabase
        .from('atendimentos')
        .insert(atendimentosData);

      if (atendimentosError) {
        console.error('Erro ao criar atendimentos:', atendimentosError);
        // Continuar mesmo com erro nos atendimentos
      } else {
        console.log('Atendimentos criados:', atendimentosData.length);
      }
    }

    // 3. Criar regras de negócio (business_rules)
    const businessRulesConfig = {
      tipo_agendamento: data.tipo_agendamento,
      permite_agendamento_online: data.permite_agendamento_online,
      idade_minima: data.idade_minima,
      idade_maxima: data.idade_maxima,
      atende_criancas: data.atende_criancas,
      atende_adultos: data.atende_adultos,
      convenios_aceitos: data.convenios_aceitos,
      convenios_restricoes: data.convenios_restricoes,
      regras_especiais: data.regras_especiais,
      restricoes_gerais: data.restricoes_gerais,
      servicos: data.servicos
    };

    const { error: rulesError } = await supabase
      .from('business_rules')
      .insert({
        cliente_id: data.cliente_id,
        medico_id: medico.id,
        config: businessRulesConfig,
        ativo: true,
        version: 1
      });

    if (rulesError) {
      console.error('Erro ao criar business_rules:', rulesError);
      // Continuar mesmo com erro
    } else {
      console.log('Business rules criadas');
    }

    // 4. Criar preparos
    if (data.preparos.length > 0) {
      const preparosData = data.preparos.map(preparo => ({
        cliente_id: data.cliente_id,
        nome: preparo.nome,
        exame: preparo.exame_relacionado,
        jejum_horas: preparo.jejum_horas,
        restricoes_alimentares: preparo.restricoes_alimentares,
        medicacao_suspender: preparo.medicacao_suspender,
        dias_suspensao: preparo.dias_suspensao,
        itens_levar: preparo.itens_levar,
        valor_particular: preparo.valor_particular,
        valor_convenio: preparo.valor_convenio,
        forma_pagamento: preparo.formas_pagamento.join(', '),
        observacoes_especiais: preparo.observacoes_especiais
      }));

      const { error: preparosError } = await supabase
        .from('preparos')
        .insert(preparosData);

      if (preparosError) {
        console.error('Erro ao criar preparos:', preparosError);
        // Continuar mesmo com erro
      } else {
        console.log('Preparos criados:', preparosData.length);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Médico cadastrado com sucesso!',
        medico_id: medico.id,
        nome: medico.nome,
        cliente: cliente.nome
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
