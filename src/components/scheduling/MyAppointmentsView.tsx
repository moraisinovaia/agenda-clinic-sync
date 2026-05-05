// View principal do médico — sua agenda em formato leve.
//
// Reutiliza AppointmentsList existente passando handlers vazios
// (médico não pode editar/cancelar/confirmar — apenas leitura).
//
// Tabs:
//   - Hoje (default): só agendamentos do dia
//   - Esta semana: today..today+6
//   - Próximas: today..today+30
//
// Estado vazio bem cuidado (médico no domingo às 22h).

import { useState } from 'react';
import { useMeusAgendamentos, AgendaWindow } from '@/hooks/useMeusAgendamentos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AppointmentsList } from '@/components/scheduling/AppointmentsList';
import { Calendar, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MyAppointmentsViewProps {
  /** Médicos visíveis ao usuário (1 ou poucos). Passado pelo MedicoView. */
  doctors: any[];
}

const TAB_LABELS: Record<AgendaWindow, string> = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  proximas: 'Próximas 4 semanas',
};

const EMPTY_STATES: Record<AgendaWindow, { title: string; subtitle: string }> = {
  hoje: {
    title: 'Sem agendamentos hoje 🎉',
    subtitle: 'Você não tem consultas agendadas para hoje.',
  },
  semana: {
    title: 'Semana tranquila',
    subtitle: 'Sem consultas previstas nos próximos 7 dias.',
  },
  proximas: {
    title: 'Agenda livre',
    subtitle: 'Nenhum agendamento nas próximas 4 semanas.',
  },
};

export function MyAppointmentsView({ doctors }: MyAppointmentsViewProps) {
  const [tab, setTab] = useState<AgendaWindow>('hoje');
  const { appointments, loading, error, counts } = useMeusAgendamentos(tab);

  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground capitalize">{today}</p>
        <h1 className="text-2xl font-bold">Minha agenda</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AgendaWindow)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hoje">{TAB_LABELS.hoje}</TabsTrigger>
          <TabsTrigger value="semana">{TAB_LABELS.semana}</TabsTrigger>
          <TabsTrigger value="proximas">{TAB_LABELS.proximas}</TabsTrigger>
        </TabsList>

        {(['hoje', 'semana', 'proximas'] as AgendaWindow[]).map((w) => (
          <TabsContent key={w} value={w} className="space-y-3">
            {loading && tab === w && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Carregando agenda...</span>
                </CardContent>
              </Card>
            )}

            {error && tab === w && (
              <Card className="border-destructive/50">
                <CardContent className="flex items-start gap-3 py-6">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Não foi possível carregar a agenda</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && !error && appointments.length === 0 && tab === w && (
              <Card>
                <CardContent className="flex flex-col items-center text-center py-12 space-y-3">
                  <Sparkles className="h-10 w-10 text-muted-foreground/60" />
                  <div>
                    <p className="font-medium">{EMPTY_STATES[w].title}</p>
                    <p className="text-sm text-muted-foreground">{EMPTY_STATES[w].subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && !error && appointments.length > 0 && tab === w && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {counts.naoCancelados} agendamento{counts.naoCancelados !== 1 ? 's' : ''}
                    {counts.total !== counts.naoCancelados ? ` (${counts.total - counts.naoCancelados} cancelado${counts.total - counts.naoCancelados !== 1 ? 's' : ''})` : ''}
                  </span>
                </div>
                {/* AppointmentsList já é read-friendly. Não passamos handlers
                    de edit/cancel/delete — médico é apenas leitura (RLS bloqueia
                    no banco, mas a UI também não oferece os botões). */}
                <AppointmentsList
                  appointments={appointments}
                  doctors={doctors}
                  allowCanceled={true}
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
