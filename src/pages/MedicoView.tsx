// Página /medico — landing pra usuários com role medico.
//
// Reaproveita o componente DoctorSchedule da recepção (mesmo layout
// familiar — calendário lateral, filtros Manhã/Tarde/Noite, tabela de
// agendamentos) com prop readOnly={true}, que esconde elementos de
// escrita (Novo Agendamento, Fila de Espera, Gerenciar Horários, coluna
// Ações com edit/cancel/delete).
//
// Carrega via supabase client direto. RLS já filtra automaticamente:
//   - medicos: só os que o user tem assignment
//   - agendamentos: só dos médicos com assignment
//   - atendimentos: do mesmo cliente_id

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { DoctorSchedule } from '@/components/scheduling/DoctorSchedule';
import { Doctor, AppointmentWithRelations, Atendimento } from '@/types/scheduling';

const APPOINTMENTS_SELECT = `
  *,
  pacientes:paciente_id ( * ),
  medicos:medico_id ( * ),
  atendimentos:atendimento_id ( * )
`;

export default function MedicoView() {
  const { profile, signOut } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Carrega médicos visíveis ao user (RLS já filtra) ────────────────────
  useEffect(() => {
    if (!profile?.cliente_id) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: medicosData }, { data: atendimentosData }] = await Promise.all([
        supabase
          .from('medicos')
          .select('*')
          .eq('cliente_id', profile.cliente_id)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('atendimentos')
          .select('*')
          .eq('cliente_id', profile.cliente_id)
          .eq('ativo', true),
      ]);

      if (cancelled) return;

      const list = (medicosData || []) as Doctor[];
      setDoctors(list);
      setAtendimentos((atendimentosData || []) as Atendimento[]);
      if (list.length > 0) setSelectedDoctorId((curr) => curr ?? list[0].id);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.cliente_id]);

  // ─── Carrega agendamentos do médico selecionado ──────────────────────────
  useEffect(() => {
    if (!selectedDoctorId || !profile?.cliente_id) {
      setAppointments([]);
      return;
    }

    let cancelled = false;
    const fetchAppointments = async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select(APPOINTMENTS_SELECT)
        .eq('cliente_id', profile.cliente_id)
        .eq('medico_id', selectedDoctorId)
        .is('excluido_em', null)
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true });

      if (!cancelled) {
        setAppointments((data || []) as unknown as AppointmentWithRelations[]);
      }
    };

    fetchAppointments();

    // Realtime: refetch quando algo mudar nesse médico
    const channel = supabase
      .channel('medico-view-' + selectedDoctorId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `medico_id=eq.${selectedDoctorId}`,
        },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedDoctorId, profile?.cliente_id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Sem agenda configurada</h1>
          <p className="text-muted-foreground">
            Sua conta foi criada, mas você ainda não tem nenhum médico vinculado.
            Procure o administrador da clínica para liberar o acesso.
          </p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) ?? doctors[0];

  // No-ops pras props obrigatórias de mutação (DoctorSchedule não vai
  // chamar com readOnly=true, mas a interface exige os handlers).
  const noopAsync = async () => {};
  const noopAsyncBool = async () => false;
  const noopAsyncArr = async () => [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Médico</p>
            <p className="font-semibold text-base truncate">{selectedDoctor.nome}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <DoctorSchedule
          doctor={selectedDoctor}
          doctors={doctors}
          onDoctorChange={(id) => setSelectedDoctorId(id)}
          appointments={appointments}
          atendimentos={atendimentos}
          adicionarFilaEspera={noopAsyncBool}
          searchPatientsByBirthDate={noopAsyncArr}
          onCancelAppointment={noopAsync}
          readOnly
        />
      </main>
    </div>
  );
}
