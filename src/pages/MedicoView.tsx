// Página /medico — landing pra usuários com role medico.
//
// Só renderiza se:
//   - user autenticado (AuthGuard)
//   - profile aprovado (AuthGuard)
//   - must_change_password = false (AuthGuard redireciona pra /setup-senha se true)
//   - role = medico (AuthGuard redireciona pra / se admin/recepcionista)
//
// Carrega lista de médicos a que o user tem acesso (via assignments) e
// renderiza MyAppointmentsView. Se tiver acesso a >1 médico, mostra
// seletor; senão renderiza direto.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Loader2 } from 'lucide-react';
import { MyAppointmentsView } from '@/components/scheduling/MyAppointmentsView';
import { Doctor } from '@/types/scheduling';

export default function MedicoView() {
  const { profile, signOut } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.cliente_id) return;
    setLoading(true);

    // RLS já filtra: SELECT em medicos retorna só os que o user tem assignment
    supabase
      .from('medicos')
      .select('*')
      .eq('cliente_id', profile.cliente_id)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        const list = (data || []) as Doctor[];
        setDoctors(list);
        if (list.length === 1) setSelectedId(list[0].id);
        else if (list.length > 1) setSelectedId((curr) => curr ?? list[0].id);
        setLoading(false);
      });
  }, [profile?.cliente_id]);

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

  const selectedDoctor = doctors.find((d) => d.id === selectedId) ?? doctors[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              {doctors.length === 1 ? (
                <>
                  <p className="text-xs text-muted-foreground">Médico</p>
                  <p className="font-medium truncate">{selectedDoctor.nome}</p>
                </>
              ) : (
                <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Selecione um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <MyAppointmentsView doctors={selectedDoctor ? [selectedDoctor] : []} />
      </main>
    </div>
  );
}
