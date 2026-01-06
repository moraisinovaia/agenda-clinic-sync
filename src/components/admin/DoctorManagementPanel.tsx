import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from '@/hooks/useStableAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { RefreshCw, Plus, Pencil, Stethoscope, Users, Search, AlertCircle, Clock, Settings2, FileText } from 'lucide-react';
import { RuleEditDialog } from './llm-config/RuleEditDialog';
import { useLLMConfig, BusinessRule } from '@/hooks/useLLMConfig';

interface ServiceConfig {
  periodos?: Record<string, {
    inicio?: string;
    fim?: string;
    limite?: number;
    dias_especificos?: number[];
  }>;
}

interface BusinessRuleService {
  medico_id: string;
  medico_nome: string;
  servicos_count: number;
  config: {
    servicos?: Record<string, ServiceConfig>;  // Objeto, não array
    tipo_agendamento?: string;
    permite_agendamento_online?: boolean;
    idade_minima?: number;
    idade_maxima?: number;
    convenios?: string[];
  };
}

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
  ativo: boolean;
  convenios_aceitos: string[] | null;
  convenios_restricoes: Record<string, string> | null;
  idade_minima: number | null;
  idade_maxima: number | null;
  observacoes: string | null;
  horarios: Record<string, unknown> | null;
  created_at: string;
  crm?: string | null;
  rqe?: string | null;
  telefone_alternativo?: string | null;
  atende_criancas?: boolean;
  atende_adultos?: boolean;
}

interface Atendimento {
  id: string;
  nome: string;
  tipo: string;
}

interface PeriodoConfiguracao {
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
  limite_pacientes: number;
  dias_semana: number[]; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
}

interface HorariosPeriodos {
  manha: PeriodoConfiguracao;
  tarde: PeriodoConfiguracao;
  noite: PeriodoConfiguracao;
}

interface MedicoFormData {
  nome: string;
  especialidade: string;
  convenios_aceitos: string[];
  convenios_restricoes: Record<string, string>;
  outroConvenio: string;
  atendimentos_ids: string[];
  outroAtendimento: string;
  outroAtendimentoTipo: string;
  idade_minima: number | null;
  idade_maxima: number | null;
  atende_criancas: boolean;
  atende_adultos: boolean;
  observacoes: string;
  ativo: boolean;
  tipo_agendamento: 'ordem_chegada' | 'hora_marcada';
  permite_agendamento_online: boolean;
  crm: string;
  rqe: string;
  telefone_alternativo: string;
  horarios_periodos: HorariosPeriodos;
  intervalo_minutos: number;
}

const DIAS_SEMANA = [
  { valor: 1, label: 'Seg', nome: 'Segunda' },
  { valor: 2, label: 'Ter', nome: 'Terça' },
  { valor: 3, label: 'Qua', nome: 'Quarta' },
  { valor: 4, label: 'Qui', nome: 'Quinta' },
  { valor: 5, label: 'Sex', nome: 'Sexta' },
  { valor: 6, label: 'Sáb', nome: 'Sábado' },
  { valor: 0, label: 'Dom', nome: 'Domingo' },
];

const initialPeriodos: HorariosPeriodos = {
  manha: { ativo: false, hora_inicio: '08:00', hora_fim: '12:00', limite_pacientes: 10, dias_semana: [1, 2, 3, 4, 5] },
  tarde: { ativo: false, hora_inicio: '14:00', hora_fim: '18:00', limite_pacientes: 10, dias_semana: [1, 2, 3, 4, 5] },
  noite: { ativo: false, hora_inicio: '18:00', hora_fim: '21:00', limite_pacientes: 10, dias_semana: [1, 2, 3, 4, 5] },
};

const CONVENIOS_DISPONIVEIS = [
  'PARTICULAR',
  'UNIMED',
  'UNIMED 20%',
  'UNIMED 40%',
  'BRADESCO',
  'SULAMERICA',
  'AMIL',
  'HAPVIDA',
  'NOTREDAME',
  'CASSI',
  'GEAP',
  'IPSEMG',
  'PLANSERV',
  'OUTRO'
];

const ESPECIALIDADES_SUGERIDAS = [
  'Gastroenterologia',
  'Endoscopia',
  'Colonoscopia',
  'Clínica Geral',
  'Cardiologia',
  'Dermatologia',
  'Ginecologia',
  'Ortopedia',
  'Pediatria',
  'Neurologia'
];

export const DoctorManagementPanel: React.FC = () => {
  const { isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const queryClient = useQueryClient();
  
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Medico | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para o dialog de LLM inline
  const [llmDialogOpen, setLLMDialogOpen] = useState(false);
  const [selectedMedicoForLLM, setSelectedMedicoForLLM] = useState<BusinessRule | null>(null);
  
  const [formData, setFormData] = useState<MedicoFormData>({
    nome: '',
    especialidade: '',
    convenios_aceitos: [],
    convenios_restricoes: {},
    outroConvenio: '',
    atendimentos_ids: [],
    outroAtendimento: '',
    outroAtendimentoTipo: 'exame',
    idade_minima: null,
    idade_maxima: null,
    atende_criancas: true,
    atende_adultos: true,
    observacoes: '',
    ativo: true,
    tipo_agendamento: 'ordem_chegada',
    permite_agendamento_online: true,
    crm: '',
    rqe: '',
    telefone_alternativo: '',
    horarios_periodos: { ...initialPeriodos },
    intervalo_minutos: 15
  });

  // Para admin_clinica, usar seu cliente_id automaticamente
  const effectiveClinicId = isClinicAdmin ? clinicAdminClienteId : selectedClinicId;

  // Hook para gerenciar LLM config (usado no dialog inline)
  const { businessRules: llmBusinessRules, saveBusinessRule, saving: llmSaving, refetch: refetchLLM } = useLLMConfig(effectiveClinicId);

  // Buscar clientes (apenas para admin global)
  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !isClinicAdmin
  });

  // Buscar médicos da clínica selecionada
  const { data: medicos, isLoading, refetch } = useQuery({
    queryKey: ['medicos-por-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase.rpc('get_medicos_por_clinica', {
        p_cliente_id: effectiveClinicId
      });
      if (error) throw error;
      return (data || []) as Medico[];
    },
    enabled: !!effectiveClinicId
  });

  // Buscar business_rules com serviços
  const { data: businessRulesServices } = useQuery({
    queryKey: ['business-rules-services', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase.rpc('get_business_rules_with_services', {
        p_cliente_id: effectiveClinicId
      });
      if (error) throw error;
      return (data || []) as BusinessRuleService[];
    },
    enabled: !!effectiveClinicId
  });

  // Buscar atendimentos disponíveis da clínica
  const { data: atendimentosDisponiveis } = useQuery({
    queryKey: ['atendimentos-clinica', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, nome, tipo, medico_id')
        .eq('cliente_id', effectiveClinicId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as (Atendimento & { medico_id?: string })[];
    },
    enabled: !!effectiveClinicId
  });

  // Mutation para criar médico
  const createMutation = useMutation({
    mutationFn: async (data: MedicoFormData) => {
      if (!effectiveClinicId) throw new Error('Clínica não selecionada');
      
      // Criar médico usando a RPC existente
      const { data: result, error } = await supabase.rpc('criar_medico', {
        p_cliente_id: effectiveClinicId,
        p_nome: data.nome,
        p_especialidade: data.especialidade,
        p_convenios_aceitos: data.convenios_aceitos.length > 0 ? data.convenios_aceitos : null,
        p_idade_minima: data.idade_minima || 0,
        p_idade_maxima: data.idade_maxima,
        p_observacoes: data.observacoes || null,
        p_atendimentos_ids: data.atendimentos_ids.length > 0 ? data.atendimentos_ids : null
      });
      
      if (error) throw error;
      
      const resultObj = result as { success: boolean; error?: string; message?: string; medico_id?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'Erro ao criar médico');
      }
      
      // Atualizar campos adicionais usando a RPC de atualização
      if (resultObj.medico_id) {
        await supabase.rpc('atualizar_medico', {
          p_medico_id: resultObj.medico_id,
          p_dados: {
            crm: data.crm || null,
            rqe: data.rqe || null,
            telefone_alternativo: data.telefone_alternativo || null,
            atende_criancas: data.atende_criancas,
            atende_adultos: data.atende_adultos,
            convenios_restricoes: data.convenios_restricoes,
            horarios: {
              tipo_agendamento: data.tipo_agendamento,
              permite_agendamento_online: data.permite_agendamento_online
            }
          }
        });
      }
      
      // Salvar horários de atendimento
      if (resultObj.medico_id) {
        await saveHorariosConfig(resultObj.medico_id);
      }
      
      return resultObj;
    },
    onSuccess: () => {
      toast.success('Médico criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['medicos-por-clinica'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Mutation para atualizar médico
  const updateMutation = useMutation({
    mutationFn: async ({ medicoId, data }: { medicoId: string; data: MedicoFormData }) => {
      const { data: result, error } = await supabase.rpc('atualizar_medico', {
        p_medico_id: medicoId,
        p_dados: {
          nome: data.nome,
          especialidade: data.especialidade,
          ativo: data.ativo,
          convenios_aceitos: data.convenios_aceitos,
          convenios_restricoes: data.convenios_restricoes,
          idade_minima: data.idade_minima,
          idade_maxima: data.idade_maxima,
          atende_criancas: data.atende_criancas,
          atende_adultos: data.atende_adultos,
          observacoes: data.observacoes,
          crm: data.crm || null,
          rqe: data.rqe || null,
          telefone_alternativo: data.telefone_alternativo || null,
          horarios: {
            tipo_agendamento: data.tipo_agendamento,
            permite_agendamento_online: data.permite_agendamento_online
          }
        },
        p_atendimentos_ids: data.atendimentos_ids.length > 0 ? data.atendimentos_ids : []
      });
      
      if (error) throw error;
      
      const resultObj = result as { success: boolean; error?: string; message?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'Erro ao atualizar médico');
      }
      
      // Salvar horários de atendimento
      await saveHorariosConfig(medicoId);
      
      return resultObj;
    },
    onSuccess: () => {
      toast.success('Médico atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['medicos-por-clinica'] });
      queryClient.invalidateQueries({ queryKey: ['business-rules-services'] });
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      resetForm();
      setIsDialogOpen(false);
      setEditingDoctor(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Função auxiliar para obter serviços de um médico
  const getServicosForMedico = (medicoId: string): { count: number; nomes: string[]; rule?: BusinessRuleService } => {
    const rule = businessRulesServices?.find(br => br.medico_id === medicoId);
    if (!rule?.config?.servicos) return { count: 0, nomes: [] };
    
    // Servicos é um objeto, não array
    const nomes = Object.keys(rule.config.servicos);
    return {
      count: nomes.length,
      nomes,
      rule
    };
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      especialidade: '',
      convenios_aceitos: [],
      convenios_restricoes: {},
      outroConvenio: '',
      atendimentos_ids: [],
      outroAtendimento: '',
      outroAtendimentoTipo: 'exame',
      idade_minima: null,
      idade_maxima: null,
      atende_criancas: true,
      atende_adultos: true,
      observacoes: '',
      ativo: true,
      tipo_agendamento: 'ordem_chegada',
      permite_agendamento_online: true,
      crm: '',
      rqe: '',
      telefone_alternativo: '',
      horarios_periodos: { ...initialPeriodos },
      intervalo_minutos: 15
    });
    setEditingDoctor(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (medico: Medico) => {
    setEditingDoctor(medico);
    
    // Separar convênios padrão dos personalizados
    const conveniosPadrao = medico.convenios_aceitos?.filter(c => CONVENIOS_DISPONIVEIS.includes(c)) || [];
    const conveniosPersonalizados = medico.convenios_aceitos?.filter(c => !CONVENIOS_DISPONIVEIS.includes(c)) || [];
    const outroConvenioExistente = conveniosPersonalizados.length > 0 ? conveniosPersonalizados.join(', ') : '';
    
    // Buscar atendimentos vinculados ao médico
    const atendimentosDoMedico = atendimentosDisponiveis?.filter(a => 
      a.medico_id === medico.id
    ).map(a => a.id) || [];

    // Buscar horários configurados
    let periodosConfig: HorariosPeriodos = JSON.parse(JSON.stringify(initialPeriodos));
    let intervalo = 15;

    if (effectiveClinicId) {
      const { data: horarios } = await supabase
        .from('horarios_configuracao')
        .select('*')
        .eq('medico_id', medico.id)
        .eq('ativo', true);

      if (horarios && horarios.length > 0) {
        // Agrupar dias por período
        const diasPorPeriodo: Record<string, number[]> = {
          manha: [],
          tarde: [],
          noite: []
        };

        horarios.forEach(h => {
          const periodo = h.periodo as keyof HorariosPeriodos;
          if (periodosConfig[periodo]) {
            periodosConfig[periodo] = {
              ...periodosConfig[periodo],
              ativo: true,
              hora_inicio: h.hora_inicio,
              hora_fim: h.hora_fim,
              limite_pacientes: h.limite_pacientes || 10
            };
            // Coletar dias únicos
            if (!diasPorPeriodo[periodo].includes(h.dia_semana)) {
              diasPorPeriodo[periodo].push(h.dia_semana);
            }
          }
        });

        // Atribuir dias coletados
        Object.keys(diasPorPeriodo).forEach(periodo => {
          if (diasPorPeriodo[periodo].length > 0) {
            periodosConfig[periodo as keyof HorariosPeriodos].dias_semana = diasPorPeriodo[periodo].sort((a, b) => a - b);
          }
        });

        intervalo = horarios[0]?.intervalo_minutos || 15;
      }
    }
    
    setFormData({
      nome: medico.nome,
      especialidade: medico.especialidade,
      convenios_aceitos: conveniosPersonalizados.length > 0 
        ? [...conveniosPadrao, 'OUTRO'] 
        : conveniosPadrao,
      convenios_restricoes: (medico.convenios_restricoes as Record<string, string>) || {},
      outroConvenio: outroConvenioExistente,
      atendimentos_ids: atendimentosDoMedico,
      outroAtendimento: '',
      outroAtendimentoTipo: 'exame',
      idade_minima: medico.idade_minima,
      idade_maxima: medico.idade_maxima,
      atende_criancas: medico.atende_criancas !== false,
      atende_adultos: medico.atende_adultos !== false,
      observacoes: medico.observacoes || '',
      ativo: medico.ativo,
      tipo_agendamento: (medico.horarios?.tipo_agendamento as 'ordem_chegada' | 'hora_marcada') || 'ordem_chegada',
      permite_agendamento_online: medico.horarios?.permite_agendamento_online !== false,
      crm: medico.crm || '',
      rqe: medico.rqe || '',
      telefone_alternativo: medico.telefone_alternativo || '',
      horarios_periodos: periodosConfig,
      intervalo_minutos: intervalo
    });
    setIsDialogOpen(true);
  };

  const handlePeriodoChange = (
    periodo: keyof HorariosPeriodos, 
    config: PeriodoConfiguracao
  ) => {
    setFormData(prev => ({
      ...prev,
      horarios_periodos: {
        ...prev.horarios_periodos,
        [periodo]: config
      }
    }));
  };

  const saveHorariosConfig = async (medicoId: string) => {
    if (!effectiveClinicId) return;
    
    // Deletar configurações antigas
    await supabase
      .from('horarios_configuracao')
      .delete()
      .eq('medico_id', medicoId);
    
    // Inserir novas configurações para cada período ativo usando os dias selecionados
    const periodos = ['manha', 'tarde', 'noite'] as const;
    
    for (const periodo of periodos) {
      const config = formData.horarios_periodos[periodo];
      if (config.ativo && config.dias_semana.length > 0) {
        for (const dia of config.dias_semana) {
          await supabase.from('horarios_configuracao').insert({
            cliente_id: effectiveClinicId,
            medico_id: medicoId,
            dia_semana: dia,
            periodo,
            hora_inicio: config.hora_inicio,
            hora_fim: config.hora_fim,
            limite_pacientes: config.limite_pacientes,
            intervalo_minutos: formData.intervalo_minutos,
            ativo: true
          });
        }
      }
    }
  };

  const handleDiaSemanaToggle = (periodo: keyof HorariosPeriodos, dia: number) => {
    const diasAtuais = formData.horarios_periodos[periodo].dias_semana;
    const novosDias = diasAtuais.includes(dia)
      ? diasAtuais.filter(d => d !== dia)
      : [...diasAtuais, dia].sort((a, b) => a - b);
    handlePeriodoChange(periodo, { 
      ...formData.horarios_periodos[periodo], 
      dias_semana: novosDias 
    });
  };

  const setDiasSemana = (periodo: keyof HorariosPeriodos, dias: number[]) => {
    handlePeriodoChange(periodo, { 
      ...formData.horarios_periodos[periodo], 
      dias_semana: dias 
    });
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome do médico é obrigatório');
      return;
    }
    if (!formData.especialidade.trim()) {
      toast.error('Especialidade é obrigatória');
      return;
    }

    // Processar convênios: remover "OUTRO" e adicionar o convênio personalizado
    const conveniosFinal = [
      ...formData.convenios_aceitos.filter(c => c !== 'OUTRO'),
      ...(formData.outroConvenio.trim() ? [formData.outroConvenio.trim().toUpperCase()] : [])
    ];

    let atendimentosIdsFinal = [...formData.atendimentos_ids];

    // Se há atendimento personalizado, criar primeiro
    if (formData.outroAtendimento.trim() && effectiveClinicId) {
      try {
        const { data: novoAtendimento, error: atendError } = await supabase
          .from('atendimentos')
          .insert({
            cliente_id: effectiveClinicId,
            nome: formData.outroAtendimento.trim(),
            tipo: formData.outroAtendimentoTipo,
            ativo: true
          })
          .select('id')
          .single();
        
        if (atendError) {
          toast.error('Erro ao criar atendimento personalizado: ' + atendError.message);
          return;
        }
        
        if (novoAtendimento) {
          atendimentosIdsFinal.push(novoAtendimento.id);
          queryClient.invalidateQueries({ queryKey: ['atendimentos-clinica'] });
        }
      } catch (err) {
        toast.error('Erro ao criar atendimento personalizado');
        return;
      }
    }

    const dataToSubmit = {
      ...formData,
      convenios_aceitos: conveniosFinal,
      atendimentos_ids: atendimentosIdsFinal
    };

    if (editingDoctor) {
      updateMutation.mutate({ medicoId: editingDoctor.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleAtendimentoToggle = (atendimentoId: string) => {
    setFormData(prev => ({
      ...prev,
      atendimentos_ids: prev.atendimentos_ids.includes(atendimentoId)
        ? prev.atendimentos_ids.filter(id => id !== atendimentoId)
        : [...prev.atendimentos_ids, atendimentoId]
    }));
  };

  const handleConvenioToggle = (convenio: string) => {
    setFormData(prev => {
      const newConvenios = prev.convenios_aceitos.includes(convenio)
        ? prev.convenios_aceitos.filter(c => c !== convenio)
        : [...prev.convenios_aceitos, convenio];
      
      // Remover restrições de convênios desmarcados
      const newRestricoes = { ...prev.convenios_restricoes };
      if (!newConvenios.includes(convenio)) {
        delete newRestricoes[convenio];
      }
      
      return {
        ...prev,
        convenios_aceitos: newConvenios,
        convenios_restricoes: newRestricoes
      };
    });
  };

  const handleConvenioRestricaoChange = (convenio: string, restricao: string) => {
    setFormData(prev => ({
      ...prev,
      convenios_restricoes: {
        ...prev.convenios_restricoes,
        [convenio]: restricao
      }
    }));
  };

  // Especialidades únicas dos médicos existentes
  const especialidadesExistentes = useMemo(() => {
    if (!medicos) return ESPECIALIDADES_SUGERIDAS;
    const existentes = [...new Set(medicos.map(m => m.especialidade))];
    return [...new Set([...existentes, ...ESPECIALIDADES_SUGERIDAS])].sort();
  }, [medicos]);

  // Filtrar médicos pela busca
  const medicosFiltrados = useMemo(() => {
    if (!medicos || !searchTerm.trim()) return medicos || [];
    const termo = searchTerm.toLowerCase().trim();
    return medicos.filter(medico => 
      medico.nome.toLowerCase().includes(termo) ||
      medico.especialidade.toLowerCase().includes(termo)
    );
  }, [medicos, searchTerm]);

  // Se não é admin nem clinic_admin, não mostrar
  if (!isAdmin && !isClinicAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <CardTitle>Gestão de Médicos</CardTitle>
            {medicos && (
              <Badge variant="secondary">
                {searchTerm ? `${medicosFiltrados.length} de ${medicos.length}` : `${medicos.length} médicos`}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreate}
              disabled={!effectiveClinicId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Médico
            </Button>
          </div>
        </div>
        <CardDescription>
          {isClinicAdmin 
            ? 'Gerencie os médicos da sua clínica' 
            : 'Gerencie médicos por clínica'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de clínica (apenas para admin global) */}
        {isAdmin && !isClinicAdmin && (
          <div className="space-y-2">
            <Label>Selecionar Clínica</Label>
            <Select value={selectedClinicId || ''} onValueChange={setSelectedClinicId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma clínica..." />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map((cliente: { id: string; nome: string }) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Campo de pesquisa */}
        {effectiveClinicId && medicos && medicos.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Tabela de médicos */}
        {effectiveClinicId && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CRM/RQE</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Convênios</TableHead>
                  <TableHead>Faixa Etária</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : medicosFiltrados && medicosFiltrados.length > 0 ? (
                  medicosFiltrados.map((medico) => {
                    const tipoAgendamento = (medico.horarios?.tipo_agendamento as string) || 'ordem_chegada';
                    const permiteOnline = medico.horarios?.permite_agendamento_online !== false;
                    const atendeCriancas = medico.atende_criancas !== false;
                    const atendeAdultos = medico.atende_adultos !== false;
                    const servicosInfo = getServicosForMedico(medico.id);
                    
                    return (
                      <TableRow key={medico.id}>
                        <TableCell className="font-medium">{medico.nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            {medico.crm && <span className="text-muted-foreground">CRM: {medico.crm}</span>}
                            {medico.rqe && <span className="text-muted-foreground">RQE: {medico.rqe}</span>}
                            {!medico.crm && !medico.rqe && <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>{medico.especialidade}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  {servicosInfo.count > 0 ? (
                                    <Badge variant="default" className="text-xs">
                                      <FileText className="h-3 w-3 mr-1" />
                                      {servicosInfo.count}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      0
                                    </Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[300px]">
                                {servicosInfo.count > 0 && servicosInfo.rule?.config?.servicos ? (
                                  <div className="text-xs space-y-2">
                                    <p className="font-medium">Serviços configurados:</p>
                                    {servicosInfo.nomes.slice(0, 5).map((nome) => {
                                      const servicoConfig = servicosInfo.rule?.config?.servicos?.[nome];
                                      const periodos = servicoConfig?.periodos;
                                      return (
                                        <div key={nome} className="border-t border-border/50 pt-1">
                                          <p className="font-medium text-primary">{nome}</p>
                                          {periodos && Object.keys(periodos).length > 0 ? (
                                            <ul className="text-muted-foreground pl-2 mt-0.5">
                                              {Object.entries(periodos).slice(0, 3).map(([periodo, config]) => (
                                                <li key={periodo} className="flex gap-1">
                                                  <span className="capitalize">{periodo}:</span>
                                                  <span>{config.inicio || '?'} - {config.fim || '?'}</span>
                                                  {config.limite && <span>(max: {config.limite})</span>}
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <span className="text-muted-foreground">Sem horários definidos</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {servicosInfo.nomes.length > 5 && (
                                      <p className="text-muted-foreground">+{servicosInfo.nomes.length - 5} mais...</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs">Nenhum serviço configurado na LLM API</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {medico.convenios_aceitos?.length ? (
                            <Badge variant="outline">
                              {medico.convenios_aceitos.length} aceitos
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            {atendeCriancas && <Badge variant="outline" className="text-xs w-fit">Crianças</Badge>}
                            {atendeAdultos && <Badge variant="outline" className="text-xs w-fit">Adultos</Badge>}
                            {medico.idade_minima != null && medico.idade_minima > 0 && (
                              <span className="text-muted-foreground">Min: {medico.idade_minima} anos</span>
                            )}
                            {medico.idade_maxima != null && (
                              <span className="text-muted-foreground">Max: {medico.idade_maxima} anos</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="text-xs w-fit">
                              {tipoAgendamento === 'hora_marcada' ? 'Hora Marcada' : 'Ordem Chegada'}
                            </Badge>
                            {permiteOnline && (
                              <Badge variant="outline" className="text-xs w-fit text-green-600 border-green-300">
                                Online
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={medico.ativo ? 'default' : 'secondary'}>
                            {medico.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={servicosInfo.count > 0 ? "ghost" : "outline"}
                                    size="sm"
                                    className={servicosInfo.count === 0 ? "border-amber-300 text-amber-600 hover:bg-amber-50" : ""}
                                    onClick={() => {
                                      // Buscar regra existente ou criar nova
                                      const existingRule = llmBusinessRules.find(r => r.medico_id === medico.id);
                                      const ruleToEdit: BusinessRule = existingRule || {
                                        id: '',
                                        cliente_id: effectiveClinicId || '',
                                        medico_id: medico.id,
                                        medico_nome: medico.nome,
                                        config: {
                                          nome: medico.nome.toUpperCase(),
                                          tipo_agendamento: (medico.horarios as any)?.tipo_agendamento || 'ordem_chegada',
                                          permite_agendamento_online: true,
                                          servicos: {},
                                          convenios: medico.convenios_aceitos || [],
                                          idade_minima: medico.idade_minima,
                                          idade_maxima: medico.idade_maxima
                                        },
                                        ativo: true,
                                        version: 1
                                      };
                                      setSelectedMedicoForLLM(ruleToEdit);
                                      setLLMDialogOpen(true);
                                    }}
                                  >
                                    <Settings2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {servicosInfo.count > 0 
                                    ? `Editar ${servicosInfo.count} serviço(s) LLM` 
                                    : "Configurar serviços LLM"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEdit(medico)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar médico</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : searchTerm ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum médico encontrado para "{searchTerm}"
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum médico cadastrado nesta clínica
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!effectiveClinicId && !isClinicAdmin && (
          <div className="text-center py-8 text-muted-foreground">
            <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Selecione uma clínica para gerenciar seus médicos</p>
          </div>
        )}

        {/* Dialog de Criar/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDoctor ? 'Editar Médico' : 'Novo Médico'}
              </DialogTitle>
              <DialogDescription>
                {editingDoctor 
                  ? 'Atualize as informações do médico'
                  : 'Preencha as informações para cadastrar um novo médico'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Dr. João Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              {/* CRM e RQE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crm">CRM</Label>
                  <Input
                    id="crm"
                    placeholder="Ex: 12345/MG"
                    value={formData.crm}
                    onChange={(e) => setFormData(prev => ({ ...prev, crm: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rqe">RQE</Label>
                  <Input
                    id="rqe"
                    placeholder="Ex: 54321"
                    value={formData.rqe}
                    onChange={(e) => setFormData(prev => ({ ...prev, rqe: e.target.value }))}
                  />
                </div>
              </div>

              {/* Telefone Alternativo */}
              <div className="space-y-2">
                <Label htmlFor="telefone_alternativo">Telefone Alternativo</Label>
                <Input
                  id="telefone_alternativo"
                  placeholder="Ex: (31) 99999-9999"
                  value={formData.telefone_alternativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone_alternativo: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Telefone alternativo para contato com o médico
                </p>
              </div>

              {/* Especialidade */}
              <div className="space-y-2">
                <Label htmlFor="especialidade">Especialidade *</Label>
                <Select 
                  value={formData.especialidade} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, especialidade: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite..." />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidadesExistentes.map((esp) => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Ou digite uma especialidade personalizada..."
                  value={formData.especialidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, especialidade: e.target.value }))}
                  className="mt-2"
                />
              </div>

              {/* Status (apenas edição) */}
              {editingDoctor && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="ativo">Médico Ativo</Label>
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>
              )}

              {/* Configuração LLM / Agendamento Online */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">LLM API</Badge>
                  <span className="text-sm font-medium">Configuração de Agendamento</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_agendamento">Tipo de Agendamento</Label>
                    <Select 
                      value={formData.tipo_agendamento} 
                      onValueChange={(value: 'ordem_chegada' | 'hora_marcada') => 
                        setFormData(prev => ({ ...prev, tipo_agendamento: value }))
                      }
                    >
                      <SelectTrigger id="tipo_agendamento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordem_chegada">Ordem de Chegada</SelectItem>
                        <SelectItem value="hora_marcada">Hora Marcada</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define como os horários são distribuídos para pacientes
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="permite_agendamento_online">Agendamento Online</Label>
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <span className="text-sm">
                        {formData.permite_agendamento_online ? 'Habilitado' : 'Desabilitado'}
                      </span>
                      <Switch
                        id="permite_agendamento_online"
                        checked={formData.permite_agendamento_online}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, permite_agendamento_online: checked }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Permite agendamentos via WhatsApp/Bot
                    </p>
                  </div>
                </div>
              </div>

              {/* Horários de Atendimento por Período */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="font-medium">Horários de Atendimento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Intervalo:</Label>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={formData.intervalo_minutos}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        intervalo_minutos: parseInt(e.target.value) || 15 
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                </div>
                
                {/* Período Manhã */}
                <div className={`p-3 rounded-lg border transition-colors ${formData.horarios_periodos.manha.ativo ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      id="periodo-manha"
                      checked={formData.horarios_periodos.manha.ativo}
                      onCheckedChange={(checked) => handlePeriodoChange('manha', { ...formData.horarios_periodos.manha, ativo: !!checked })}
                    />
                    <label htmlFor="periodo-manha" className="font-medium cursor-pointer min-w-[80px]">🌅 Manhã</label>
                    
                    {formData.horarios_periodos.manha.ativo && (
                      <div className="flex flex-wrap items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          value={formData.horarios_periodos.manha.hora_inicio}
                          onChange={(e) => handlePeriodoChange('manha', { ...formData.horarios_periodos.manha, hora_inicio: e.target.value })}
                          className="w-28"
                        />
                        <span className="text-sm">às</span>
                        <Input
                          type="time"
                          value={formData.horarios_periodos.manha.hora_fim}
                          onChange={(e) => handlePeriodoChange('manha', { ...formData.horarios_periodos.manha, hora_fim: e.target.value })}
                          className="w-28"
                        />
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={formData.horarios_periodos.manha.limite_pacientes}
                            onChange={(e) => handlePeriodoChange('manha', { ...formData.horarios_periodos.manha, limite_pacientes: parseInt(e.target.value) || 1 })}
                            className="w-16"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {formData.horarios_periodos.manha.ativo && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-sm text-muted-foreground">Dias:</span>
                      {DIAS_SEMANA.map(dia => (
                        <Button
                          key={dia.valor}
                          type="button"
                          variant={formData.horarios_periodos.manha.dias_semana.includes(dia.valor) ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-10 p-0"
                          onClick={() => handleDiaSemanaToggle('manha', dia.valor)}
                          title={dia.nome}
                        >
                          {dia.label}
                        </Button>
                      ))}
                      <div className="flex gap-1 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('manha', [1, 2, 3, 4, 5])}
                        >
                          Seg-Sex
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('manha', [0, 1, 2, 3, 4, 5, 6])}
                        >
                          Todos
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Período Tarde */}
                <div className={`p-3 rounded-lg border transition-colors ${formData.horarios_periodos.tarde.ativo ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      id="periodo-tarde"
                      checked={formData.horarios_periodos.tarde.ativo}
                      onCheckedChange={(checked) => handlePeriodoChange('tarde', { ...formData.horarios_periodos.tarde, ativo: !!checked })}
                    />
                    <label htmlFor="periodo-tarde" className="font-medium cursor-pointer min-w-[80px]">☀️ Tarde</label>
                    
                    {formData.horarios_periodos.tarde.ativo && (
                      <div className="flex flex-wrap items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          value={formData.horarios_periodos.tarde.hora_inicio}
                          onChange={(e) => handlePeriodoChange('tarde', { ...formData.horarios_periodos.tarde, hora_inicio: e.target.value })}
                          className="w-28"
                        />
                        <span className="text-sm">às</span>
                        <Input
                          type="time"
                          value={formData.horarios_periodos.tarde.hora_fim}
                          onChange={(e) => handlePeriodoChange('tarde', { ...formData.horarios_periodos.tarde, hora_fim: e.target.value })}
                          className="w-28"
                        />
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={formData.horarios_periodos.tarde.limite_pacientes}
                            onChange={(e) => handlePeriodoChange('tarde', { ...formData.horarios_periodos.tarde, limite_pacientes: parseInt(e.target.value) || 1 })}
                            className="w-16"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {formData.horarios_periodos.tarde.ativo && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-sm text-muted-foreground">Dias:</span>
                      {DIAS_SEMANA.map(dia => (
                        <Button
                          key={dia.valor}
                          type="button"
                          variant={formData.horarios_periodos.tarde.dias_semana.includes(dia.valor) ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-10 p-0"
                          onClick={() => handleDiaSemanaToggle('tarde', dia.valor)}
                          title={dia.nome}
                        >
                          {dia.label}
                        </Button>
                      ))}
                      <div className="flex gap-1 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('tarde', [1, 2, 3, 4, 5])}
                        >
                          Seg-Sex
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('tarde', [0, 1, 2, 3, 4, 5, 6])}
                        >
                          Todos
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Período Noite */}
                <div className={`p-3 rounded-lg border transition-colors ${formData.horarios_periodos.noite.ativo ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      id="periodo-noite"
                      checked={formData.horarios_periodos.noite.ativo}
                      onCheckedChange={(checked) => handlePeriodoChange('noite', { ...formData.horarios_periodos.noite, ativo: !!checked })}
                    />
                    <label htmlFor="periodo-noite" className="font-medium cursor-pointer min-w-[80px]">🌙 Noite</label>
                    
                    {formData.horarios_periodos.noite.ativo && (
                      <div className="flex flex-wrap items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          value={formData.horarios_periodos.noite.hora_inicio}
                          onChange={(e) => handlePeriodoChange('noite', { ...formData.horarios_periodos.noite, hora_inicio: e.target.value })}
                          className="w-28"
                        />
                        <span className="text-sm">às</span>
                        <Input
                          type="time"
                          value={formData.horarios_periodos.noite.hora_fim}
                          onChange={(e) => handlePeriodoChange('noite', { ...formData.horarios_periodos.noite, hora_fim: e.target.value })}
                          className="w-28"
                        />
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={formData.horarios_periodos.noite.limite_pacientes}
                            onChange={(e) => handlePeriodoChange('noite', { ...formData.horarios_periodos.noite, limite_pacientes: parseInt(e.target.value) || 1 })}
                            className="w-16"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {formData.horarios_periodos.noite.ativo && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-sm text-muted-foreground">Dias:</span>
                      {DIAS_SEMANA.map(dia => (
                        <Button
                          key={dia.valor}
                          type="button"
                          variant={formData.horarios_periodos.noite.dias_semana.includes(dia.valor) ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-10 p-0"
                          onClick={() => handleDiaSemanaToggle('noite', dia.valor)}
                          title={dia.nome}
                        >
                          {dia.label}
                        </Button>
                      ))}
                      <div className="flex gap-1 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('noite', [1, 2, 3, 4, 5])}
                        >
                          Seg-Sex
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDiasSemana('noite', [0, 1, 2, 3, 4, 5, 6])}
                        >
                          Todos
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Selecione os dias da semana em que cada período está ativo. Por padrão, segunda a sexta estão selecionados.
                </p>
              </div>

              {/* Convênios */}
              <div className="space-y-2">
                <Label>Convênios Aceitos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-lg">
                  {CONVENIOS_DISPONIVEIS.map((convenio) => (
                    <div key={convenio} className="flex items-center space-x-2">
                      <Checkbox
                        id={`conv-${convenio}`}
                        checked={formData.convenios_aceitos.includes(convenio)}
                        onCheckedChange={() => handleConvenioToggle(convenio)}
                      />
                      <label 
                        htmlFor={`conv-${convenio}`}
                        className="text-sm cursor-pointer"
                      >
                        {convenio}
                      </label>
                    </div>
                  ))}
                </div>
                
                {/* Campo condicional para "Outro Convênio" */}
                {formData.convenios_aceitos.includes('OUTRO') && (
                  <div className="mt-2">
                    <Input
                      placeholder="Digite o nome do outro convênio..."
                      value={formData.outroConvenio}
                      onChange={(e) => setFormData(prev => ({ ...prev, outroConvenio: e.target.value }))}
                      className="border-dashed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      O convênio será salvo em MAIÚSCULAS
                    </p>
                  </div>
                )}

                {/* Restrições por Convênio */}
                {formData.convenios_aceitos.filter(c => c !== 'OUTRO').length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Restrições por Convênio (opcional)</span>
                    </div>
                    <div className="grid gap-2 p-3 border rounded-lg bg-amber-50/50">
                      {formData.convenios_aceitos.filter(c => c !== 'OUTRO').map((convenio) => (
                        <div key={convenio} className="flex items-center gap-2">
                          <Badge variant="outline" className="min-w-[100px] justify-center">
                            {convenio}
                          </Badge>
                          <Input
                            placeholder="Ex: Apenas consultas, Carência de 30 dias..."
                            value={formData.convenios_restricoes[convenio] || ''}
                            onChange={(e) => handleConvenioRestricaoChange(convenio, e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tipos de Atendimento */}
              <div className="space-y-2">
                <Label>Tipos de Atendimento</Label>
                <div className="p-3 border rounded-lg space-y-3">
                  {atendimentosDisponiveis && atendimentosDisponiveis.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {atendimentosDisponiveis.map((atend) => (
                        <div key={atend.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`atend-${atend.id}`}
                            checked={formData.atendimentos_ids.includes(atend.id)}
                            onCheckedChange={() => handleAtendimentoToggle(atend.id)}
                          />
                          <label 
                            htmlFor={`atend-${atend.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {atend.nome}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({atend.tipo})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum tipo de atendimento cadastrado para esta clínica
                    </p>
                  )}
                  
                  {/* Opção para adicionar atendimento personalizado */}
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm font-medium">Adicionar outro atendimento:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome do atendimento..."
                        value={formData.outroAtendimento}
                        onChange={(e) => setFormData(prev => ({ ...prev, outroAtendimento: e.target.value }))}
                        className="border-dashed"
                      />
                      <Select 
                        value={formData.outroAtendimentoTipo}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, outroAtendimentoTipo: value }))}
                      >
                        <SelectTrigger className="border-dashed">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consulta">Consulta</SelectItem>
                          <SelectItem value="exame">Exame</SelectItem>
                          <SelectItem value="procedimento">Procedimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O atendimento será criado automaticamente na clínica ao salvar
                    </p>
                  </div>
                </div>
              </div>

              {/* Faixa etária */}
              <div className="space-y-3 p-4 border rounded-lg">
                <span className="text-sm font-medium">Restrições de Idade</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="idade_minima">Idade Mínima</Label>
                    <Input
                      id="idade_minima"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={formData.idade_minima ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        idade_minima: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idade_maxima">Idade Máxima</Label>
                    <Input
                      id="idade_maxima"
                      type="number"
                      min={0}
                      placeholder="Sem limite"
                      value={formData.idade_maxima ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        idade_maxima: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <div className="flex items-center justify-between flex-1 p-3 border rounded-md">
                    <Label htmlFor="atende_criancas" className="cursor-pointer">Atende Crianças</Label>
                    <Switch
                      id="atende_criancas"
                      checked={formData.atende_criancas}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, atende_criancas: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between flex-1 p-3 border rounded-md">
                    <Label htmlFor="atende_adultos" className="cursor-pointer">Atende Adultos</Label>
                    <Switch
                      id="atende_adultos"
                      checked={formData.atende_adultos}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, atende_adultos: checked }))}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais sobre o médico..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingDoctor ? 'Salvar Alterações' : 'Criar Médico'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para edição inline de serviços LLM */}
        <RuleEditDialog
          rule={selectedMedicoForLLM}
          open={llmDialogOpen}
          onOpenChange={setLLMDialogOpen}
          onSave={async (medicoId, config) => {
            const success = await saveBusinessRule(medicoId, config);
            if (success) {
              await refetchLLM();
              queryClient.invalidateQueries({ queryKey: ['business-rules-services'] });
            }
            return success;
          }}
          saving={llmSaving}
          clienteId={effectiveClinicId}
        />
      </CardContent>
    </Card>
  );
};

export default DoctorManagementPanel;
