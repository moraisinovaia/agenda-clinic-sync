import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RecursoEquipamento {
  id: string;
  nome: string;
  descricao: string | null;
  limite_diario: number;
  horario_instalacao: string | null;
  ficha_inicio: string | null;
  ficha_fim: string | null;
  ativo: boolean;
  cliente_id: string;
}

export interface DistribuicaoRecurso {
  id: string;
  recurso_id: string;
  medico_id: string;
  dia_semana: number;
  quantidade: number;
  periodo: string;
  horario_inicio: string | null;
  ativo: boolean;
  cliente_id: string;
  recurso?: RecursoEquipamento;
  medico?: { id: string; nome: string };
}

export interface AgendamentoRecurso {
  recurso_nome: string;
  medico_id: string;
  data: string;
  quantidade_usada: number;
  quantidade_total: number;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function useJoanaAgenda() {
  const [recursos, setRecursos] = useState<RecursoEquipamento[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<DistribuicaoRecurso[]>([]);
  const [medicos, setMedicos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch recursos
      const { data: recursosData, error: recursosError } = await supabase
        .from('recursos_equipamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (recursosError) throw recursosError;

      // Fetch distribuicoes com médicos
      const { data: distData, error: distError } = await supabase
        .from('distribuicao_recursos')
        .select(`
          *,
          recursos_equipamentos!inner(id, nome),
          medicos!inner(id, nome)
        `)
        .eq('ativo', true)
        .order('dia_semana');

      if (distError) throw distError;

      // Fetch médicos cardiologistas
      const { data: medicosData, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome')
        .ilike('especialidade', '%cardiolog%')
        .eq('ativo', true)
        .order('nome');

      if (medicosError) throw medicosError;

      setRecursos(recursosData || []);
      setDistribuicoes(
        (distData || []).map((d: any) => ({
          ...d,
          recurso: d.recursos_equipamentos,
          medico: d.medicos,
        }))
      );
      setMedicos(medicosData || []);
    } catch (error) {
      console.error('Erro ao carregar agenda Joana:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a agenda de equipamentos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDistribuicaoPorDia = useCallback(
    (diaSemana: number, recursoNome?: string) => {
      return distribuicoes.filter(
        (d) =>
          d.dia_semana === diaSemana &&
          (!recursoNome || d.recurso?.nome === recursoNome)
      );
    },
    [distribuicoes]
  );

  const getMedicosPorRecursoDia = useCallback(
    (recursoNome: string, diaSemana: number) => {
      return distribuicoes
        .filter(
          (d) => d.recurso?.nome === recursoNome && d.dia_semana === diaSemana
        )
        .map((d) => ({
          medicoId: d.medico_id,
          medicoNome: d.medico?.nome || '',
          quantidade: d.quantidade,
          periodo: d.periodo,
          horarioInicio: d.horario_inicio,
        }));
    },
    [distribuicoes]
  );

  const verificarDisponibilidade = useCallback(
    async (
      recursoNome: string,
      medicoId: string,
      data: string,
      periodo?: string
    ): Promise<{ disponivel: boolean; vagasUsadas: number; vagasTotal: number; mensagem?: string }> => {
      const dataObj = new Date(data + 'T12:00:00');
      const diaSemana = dataObj.getDay();

      // Buscar distribuição para o médico neste dia
      const distMedico = distribuicoes.find(
        (d) =>
          d.recurso?.nome === recursoNome &&
          d.medico_id === medicoId &&
          d.dia_semana === diaSemana &&
          (!periodo || d.periodo === periodo || d.periodo === 'integral')
      );

      if (!distMedico) {
        return {
          disponivel: false,
          vagasUsadas: 0,
          vagasTotal: 0,
          mensagem: `${recursoNome} não disponível para este médico em ${DIAS_SEMANA[diaSemana]}.`,
        };
      }

      // Contar agendamentos existentes
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select('id, atendimentos!inner(nome)')
        .eq('medico_id', medicoId)
        .eq('data_agendamento', data)
        .eq('status', 'agendado')
        .ilike('atendimentos.nome', `%${recursoNome}%`);

      if (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        return {
          disponivel: false,
          vagasUsadas: 0,
          vagasTotal: distMedico.quantidade,
          mensagem: 'Erro ao verificar disponibilidade.',
        };
      }

      const vagasUsadas = agendamentos?.length || 0;
      const disponivel = vagasUsadas < distMedico.quantidade;

      return {
        disponivel,
        vagasUsadas,
        vagasTotal: distMedico.quantidade,
        mensagem: disponivel
          ? undefined
          : `Limite de ${recursoNome} atingido (${vagasUsadas}/${distMedico.quantidade}).`,
      };
    },
    [distribuicoes]
  );

  const getResumoSemanal = useCallback(() => {
    const resumo: Record<string, Record<number, { medicos: string[]; total: number }>> = {};

    recursos.forEach((r) => {
      resumo[r.nome] = {};
      for (let dia = 1; dia <= 5; dia++) {
        const distDia = distribuicoes.filter(
          (d) => d.recurso?.nome === r.nome && d.dia_semana === dia
        );
        resumo[r.nome][dia] = {
          medicos: distDia.map((d) => d.medico?.nome || ''),
          total: distDia.reduce((sum, d) => sum + d.quantidade, 0),
        };
      }
    });

    return resumo;
  }, [recursos, distribuicoes]);

  const updateDistribuicao = useCallback(
    async (id: string, data: { quantidade: number; periodo: string; horario_inicio: string | null; medico_id: string; dia_semana: number }) => {
      try {
        const { error } = await supabase
          .from('distribuicao_recursos')
          .update({ 
            quantidade: data.quantidade, 
            periodo: data.periodo,
            horario_inicio: data.horario_inicio,
            medico_id: data.medico_id,
            dia_semana: data.dia_semana,
            updated_at: new Date().toISOString() 
          })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Distribuição atualizada.',
        });

        fetchData();
      } catch (error) {
        console.error('Erro ao atualizar distribuição:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível atualizar a distribuição.',
          variant: 'destructive',
        });
      }
    },
    [fetchData, toast]
  );

  const createDistribuicao = useCallback(
    async (data: {
      recurso_id: string;
      medico_id: string;
      dia_semana: number;
      quantidade: number;
      periodo: string;
      horario_inicio: string | null;
    }) => {
      try {
        // Get cliente_id from the recurso
        const recurso = recursos.find(r => r.id === data.recurso_id);
        if (!recurso) throw new Error('Recurso não encontrado');

        const { error } = await supabase
          .from('distribuicao_recursos')
          .insert({
            recurso_id: data.recurso_id,
            medico_id: data.medico_id,
            dia_semana: data.dia_semana,
            quantidade: data.quantidade,
            periodo: data.periodo,
            horario_inicio: data.horario_inicio,
            cliente_id: recurso.cliente_id,
            ativo: true,
          });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Distribuição criada.',
        });

        fetchData();
      } catch (error) {
        console.error('Erro ao criar distribuição:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar a distribuição.',
          variant: 'destructive',
        });
      }
    },
    [fetchData, toast, recursos]
  );

  const deleteDistribuicao = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('distribuicao_recursos')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Distribuição removida.',
        });

        fetchData();
      } catch (error) {
        console.error('Erro ao remover distribuição:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível remover a distribuição.',
          variant: 'destructive',
        });
      }
    },
    [fetchData, toast]
  );

  return {
    recursos,
    distribuicoes,
    medicos,
    loading,
    DIAS_SEMANA,
    getDistribuicaoPorDia,
    getMedicosPorRecursoDia,
    verificarDisponibilidade,
    getResumoSemanal,
    updateDistribuicao,
    createDistribuicao,
    deleteDistribuicao,
    refetch: fetchData,
  };
}
