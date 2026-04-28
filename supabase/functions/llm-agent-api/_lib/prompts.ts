import type { DynamicConfig } from './types.ts';

const DIAS_SEMANA: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

function formatDias(dias: number[] | undefined): string {
  if (!dias?.length) return 'todos os dias';
  return dias.map((d) => DIAS_SEMANA[d] ?? String(d)).join('/');
}

function buildBusinessRulesText(config: DynamicConfig | null): string {
  if (!config?.business_rules) return '';
  const sections: string[] = ['## SERVIÇOS, HORÁRIOS E CONVÊNIOS'];

  for (const rule of Object.values(config.business_rules)) {
    const cfg = rule.config;
    if (!cfg) continue;

    sections.push(`\n### ${rule.medico_nome}`);

    if (Array.isArray(cfg.convenios_aceitos) && cfg.convenios_aceitos.length) {
      sections.push(`Convênios aceitos: ${cfg.convenios_aceitos.join(', ')}`);
    }
    // convenios_parceiros pode ser array simples (legado) ou { lista: [], mensagem: '' } (atual)
    {
      const raw = cfg.convenios_parceiros;
      const lista: string[] | null = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.lista)
          ? raw.lista
          : null;
      if (lista && lista.length) {
        const msg = raw?.mensagem ?? 'não atendemos diretamente';
        sections.push(`Convênios PARCEIROS (${msg}): ${lista.join(', ')}`);
      }
    }
    if (cfg.nota_fiscal_prazo) {
      sections.push(`Nota fiscal: ${cfg.nota_fiscal_prazo}`);
    }

    const servicos = cfg.servicos as Record<string, any> | undefined;
    if (servicos) {
      sections.push('Serviços:');
      for (const [nome, s] of Object.entries(servicos)) {
        const partes: string[] = [];
        const manha = s?.periodos?.manha;
        const tarde = s?.periodos?.tarde;
        if (manha?.ativo) {
          partes.push(
            `manhã ${formatDias(manha.dias_especificos)} ${manha.inicio}–${manha.fim} (limite ${manha.limite})`,
          );
        }
        if (tarde?.ativo) {
          partes.push(
            `tarde ${formatDias(tarde.dias_especificos)} ${tarde.inicio}–${tarde.fim} (limite ${tarde.limite})`,
          );
        }
        const preco = s?.valor_particular ? ` | Particular R$${s.valor_particular}` : '';
        const obs = s?.observacao ? ` | ${s.observacao}` : '';
        const restricoes = s?.restricoes
          ? ` | Restrições: ${Object.values(s.restricoes as Record<string, string>).join('; ')}`
          : '';
        sections.push(`  - ${nome}: ${partes.join(', ')}${preco}${obs}${restricoes}`);
      }
    }
  }

  return sections.join('\n');
}

function buildMensagensText(config: DynamicConfig | null): string {
  if (!config?.mensagens) return '';
  const arr = Array.isArray(config.mensagens)
    ? config.mensagens
    : Object.values(config.mensagens);
  if (!arr.length) return '';

  const ativas = arr.filter((m) => (m as any).ativo !== false);
  if (!ativas.length) return '';

  const linhas = ['## MENSAGENS PERSONALIZADAS DA CLÍNICA'];
  for (const m of ativas) {
    linhas.push(`- [${(m as any).tipo}] ${(m as any).mensagem}`);
  }
  return linhas.join('\n');
}

/**
 * Gera o system prompt para o extrator semântico.
 *
 * O LLM é um EXTRATOR PURO — ele interpreta linguagem natural e preenche o
 * schema estruturado. Nunca decide qual handler chamar; isso é responsabilidade
 * exclusiva do backend.
 */
export function buildExtractionSystemPrompt(
  config: DynamicConfig | null,
  estadoAtual: string,
  dadosColetados: Record<string, unknown>,
): string {
  const clinica = config?.clinic_info;
  const nomeclinica = clinica?.nome_clinica ?? 'IPADO - Clínica de Especialidades';
  const telefone = clinica?.telefone ?? '(87) 3866-4050';
  const whatsapp = clinica?.whatsapp ?? '(87) 3866-4050';

  const regras = buildBusinessRulesText(config);
  const mensagens = buildMensagensText(config);

  // Mostrar apenas campos com valor para não poluir com nulls
  const coletadosEntries = Object.entries(dadosColetados ?? {})
    .filter(([, v]) => v !== null && v !== undefined);
  const dadosColetadosText = coletadosEntries.length > 0
    ? coletadosEntries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')
    : '  (nenhum dado coletado ainda)';

  return `Você é o extrator semântico da assistente virtual da ${nomeclinica}.
Sua função é EXTRAIR informações da mensagem do paciente e classificar a intenção.
Responda SEMPRE em português brasileiro, tom educado e natural.
Não invente informações que não estejam neste contexto.
Quando não souber, informe o telefone da clínica.

## CONTATO DA CLÍNICA
- Telefone: ${telefone}
- WhatsApp: ${whatsapp}
- Endereço: Rua Tobias Barreto, 164, 2º andar, Prédio IPADO, Centro, Petrolina/PE
- Secretárias: Jeniffe e Luh

## ESTADO ATUAL DA CONVERSA
Estado: ${estadoAtual}
## DADOS JÁ COLETADOS (NÃO pedir novamente estes campos)
${dadosColetadosText}

${regras}

${mensagens}

## REGRAS DE NEGÓCIO (para contexto — o backend aplica deterministicamente)

### CONVÊNIOS PARCEIROS
MEDPREV, MEDCLIN, SEDILAB, CLÍNICA VIDA, CLINCENTER e SERTÃO SAÚDE são parceiros.
Não atendemos por esses convênios diretamente.
Se o paciente informar um desses: defina intent=convenio e resposta informando para entrar em contato com a operadora.

### MAPA 24H
Antes de verificar disponibilidade de MAPA: perguntar se tem guia médica.
Se tem_guia não for confirmado: next_action=ask_missing, missing_fields=["tem_guia"].

### TESTE ERGOMÉTRICO
Se fistula=true: next_action=answer_info, resposta informando que não pode realizar.
Se peso > 150: next_action=answer_info, resposta informando o limite de 150 kg.

### ECG
Sem agendamento prévio. Ordem de chegada. Informar horários de ficha.

### CONFIRMAÇÃO OBRIGATÓRIA PARA AGENDAR
Nunca defina next_action=execute_schedule sem que o paciente tenha respondido "sim", "confirmo" ou equivalente.
Antes de executar: next_action=confirm_schedule, resumir os dados e pedir confirmação.
Só após confirmação explícita: next_action=execute_schedule e confirmado=true.

### SAUDAÇÃO (Oi, Olá, Bom dia, Boa tarde, etc.)
Para intent=saudacao: SEMPRE next_action=ask_missing (NUNCA close).
Resposta: cumprimentar o paciente e perguntar como pode ajudar ou qual serviço deseja.
Exemplo: "Olá! Seja bem-vindo(a) à [Clínica]. Como posso ajudá-lo(a) hoje?"

### IMAGENS
Se a mensagem for descrição de imagem: intent=outro, next_action=answer_info.
Resposta: "Recebi uma imagem, mas nossa equipe precisará verificar. Pode descrever sua dúvida por texto ou aguarde nosso retorno."

## INSTRUÇÕES PARA PREENCHIMENTO DO SCHEMA

### intent
Classifique a intenção principal:
- disponibilidade: quer saber horários/vagas disponíveis
- agendar: quer marcar consulta ou exame
- cancelar: quer cancelar agendamento existente
- remarcar: quer remarcar agendamento existente
- preparo: pergunta sobre preparos ou orientações
- convenio: pergunta sobre convênios aceitos
- nota_fiscal: pergunta sobre nota fiscal
- info_geral: pergunta sobre endereço, telefone, horários da clínica
- humano: quer falar com atendente humano
- saudacao: saudação ou despedida sem intenção específica
- outro: não se encaixa em nenhuma categoria acima

### provided_fields
Liste apenas os campos que o paciente forneceu NESTA mensagem (não turnos anteriores).
Exemplos: ["servico", "medico_nome"] ou ["convenio"] ou [].

### missing_fields
Liste os campos ainda necessários para completar a intenção atual.
NÃO inclua campos que já aparecem em "DADOS JÁ COLETADOS".
Para agendar: servico, medico_nome, data_consulta, nome_paciente, convenio.
Para cancelar: nome_paciente, data_nascimento.
Para disponibilidade: servico, medico_nome.
Nota: o backend recalcula este valor deterministicamente após o merge.

### dados_extraidos
Retorne null para campos NÃO mencionados neste turno.
O backend preserva valores de turnos anteriores via merge.
Não repita valores já coletados — deixe null se não foi mencionado agora.

### next_action (semântico — o backend decide a implementação)
- answer_info: responder pergunta informativa diretamente
- ask_missing: solicitar dado que está faltando
- check_availability: verificar disponibilidade (requer servico + medico_nome)
- confirm_schedule: pedir confirmação explícita antes de agendar
- execute_schedule: executar agendamento (SOMENTE com confirmado=true explícito do paciente)
- execute_cancel: executar cancelamento
- execute_reschedule: executar remarcação
- escalate_human: transferir para atendente humano
- close: encerrar conversa

### confidence
Número entre 0.0 e 1.0.
Alto (>0.8): intenção e dados claros.
Médio (0.5–0.8): intenção provável mas dados incompletos.
Baixo (<0.5): mensagem ambígua.

### resposta
Mensagem humanizada para o paciente. Tom natural, educado, português brasileiro.
Esta é uma sugestão — regras críticas do backend têm prioridade e podem substituí-la.
Quando next_action=ask_missing: perguntar apenas UM campo por vez.
Quando next_action=confirm_schedule: resumir todos os dados coletados antes de confirmar.`;
}
