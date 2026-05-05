// Hook que retorna agendamentos visíveis ao médico logado.
//
// Confia no RLS pra fazer o filtro (defesa tripla aplicada nas migrations
// 20260505152935): cliente_id + user_has_medico_access + status='aprovado'.
// O front NÃO refaz o filtro — qualquer query que retorne mais do que o
// permitido seria bug do banco, não dos componentes.
//
// Janelas:
//   - hoje:      data_agendamento = today
//   - semana:    today..today+6
//   - proximas:  today..today+30 (limit 200, virtualizado se preciso)
//
// Realtime: subscreve ao canal 'medico-meus-agendamentos' e refaz fetch
// em INSERT/UPDATE/DELETE.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppointmentWithRelations } from '@/types/scheduling';
import { format, addDays } from 'date-fns';

export type AgendaWindow = 'hoje' | 'semana' | 'proximas';

const SELECT_RELATIONS = `
  *,
  pacientes:paciente_id ( * ),
  medicos:medico_id ( * ),
  atendimentos:atendimento_id ( * )
`;

function rangeFor(window: AgendaWindow): { start: string; end: string } {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (window === 'hoje') return { start: today, end: today };
  if (window === 'semana') return { start: today, end: format(addDays(new Date(), 6), 'yyyy-MM-dd') };
  return { start: today, end: format(addDays(new Date(), 30), 'yyyy-MM-dd') };
}

export function useMeusAgendamentos(window: AgendaWindow = 'hoje') {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id || !profile?.cliente_id) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const { start, end } = rangeFor(window);
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('agendamentos')
        .select(SELECT_RELATIONS)
        .gte('data_agendamento', start)
        .lte('data_agendamento', end)
        .is('excluido_em', null)
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true })
        .limit(200);

      if (fetchErr) {
        console.error('[useMeusAgendamentos] erro:', fetchErr);
        setError(fetchErr.message);
        setAppointments([]);
      } else {
        setAppointments((data || []) as unknown as AppointmentWithRelations[]);
      }
    } catch (e: any) {
      console.error('[useMeusAgendamentos] exception:', e);
      setError(e?.message || 'Erro ao carregar agendamentos');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.cliente_id, window]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Realtime: refetch quando algo mudar em agendamentos do tenant
  useEffect(() => {
    if (!profile?.cliente_id) return;
    const channel = supabase
      .channel('medico-meus-agendamentos-' + profile.cliente_id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos', filter: `cliente_id=eq.${profile.cliente_id}` },
        () => fetchAppointments()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.cliente_id, fetchAppointments]);

  const counts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: appointments.length,
      hoje: appointments.filter((a) => a.data_agendamento === today).length,
      naoCancelados: appointments.filter((a) => !a.cancelado_em).length,
    };
  }, [appointments]);

  return { appointments, loading, error, counts, refetch: fetchAppointments };
}
