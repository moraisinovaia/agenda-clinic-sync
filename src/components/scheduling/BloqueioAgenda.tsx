import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, Clock, User, FileText, Check, ChevronsUpDown, ArrowLeft, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
}

interface Bloqueio {
  id: string;
  medico_id?: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  created_at: string;
  criado_por: string;
}

interface BloqueioAgendaProps {
  onBack?: () => void;
  onRefresh?: () => void;
}

export const BloqueioAgenda: React.FC<BloqueioAgendaProps> = ({ onBack, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [medicos, setMedicos] = useState<Medico[]>([]);

  // ── Aba Bloquear ──────────────────────────────────────────────────────────
  const [medicoIds, setMedicoIds] = useState<string[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ── Aba Abrir ─────────────────────────────────────────────────────────────
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [selectedDoctorAbrir, setSelectedDoctorAbrir] = useState<string>('');
  const [openDoctorAbrir, setOpenDoctorAbrir] = useState(false);
  const [loadingBloqueios, setLoadingBloqueios] = useState(false);
  const [bloqueioParaRemover, setBloqueioParaRemover] = useState<Bloqueio | null>(null);
  const [filtroBusca, setFiltroBusca] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    const carregarMedicos = async () => {
      try {
        setLoadingMedicos(true);
        const { data, error } = await supabase
          .from('medicos')
          .select('id, nome, especialidade')
          .eq('ativo', true)
          .order('nome');
        if (error) throw error;
        setMedicos(data || []);
      } catch {
        toast({ title: 'Erro', description: 'Não foi possível carregar a lista de médicos', variant: 'destructive' });
      } finally {
        setLoadingMedicos(false);
      }
    };
    carregarMedicos();
  }, [toast]);

  // ── helpers multi-select ──────────────────────────────────────────────────

  const isAllSelected = medicoIds.includes('ALL');

  const toggleMedico = (id: string) => {
    if (id === 'ALL') {
      setMedicoIds(isAllSelected ? [] : ['ALL']);
      return;
    }
    setMedicoIds(prev => {
      const semAll = prev.filter(x => x !== 'ALL');
      return semAll.includes(id) ? semAll.filter(x => x !== id) : [...semAll, id];
    });
  };

  const labelBloquear = () => {
    if (medicoIds.length === 0) return 'Selecione o(s) médico(s)...';
    if (isAllSelected) return 'Todos os médicos';
    if (medicoIds.length === 1) {
      const m = medicos.find(m => m.id === medicoIds[0]);
      return m ? `${m.nome} - ${m.especialidade}` : '1 médico';
    }
    return `${medicoIds.length} médicos selecionados`;
  };

  const previewMedicos = () => {
    if (isAllSelected) return 'todos os médicos';
    if (medicoIds.length === 1) return medicos.find(m => m.id === medicoIds[0])?.nome ?? '1 médico';
    return `${medicoIds.length} médicos`;
  };

  // ── criação de bloqueio ───────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (medicoIds.length === 0 || !dataInicio || !dataFim || !motivo) {
      toast({ title: 'Erro', description: 'Todos os campos são obrigatórios', variant: 'destructive' });
      return;
    }
    if (new Date(dataInicio) > new Date(dataFim)) {
      toast({ title: 'Erro', description: 'A data de início deve ser anterior ou igual à data de fim', variant: 'destructive' });
      return;
    }
    setShowConfirmation(true);
  };

  const handleBloqueioAgenda = async () => {
    setLoading(true);
    setShowConfirmation(false);
    try {
      const targetIds = isAllSelected ? medicos.map(m => m.id) : medicoIds;
      const results = await Promise.all(
        targetIds.map(id =>
          supabase.functions.invoke('bloqueio-agenda', {
            body: { action: 'create', medicoId: id, dataInicio, dataFim, motivo },
          })
        )
      );

      const successes = results.filter(r => r.data?.success);
      const totalAfetados = successes.reduce((sum, r) => sum + (r.data?.data?.agendamentos_afetados || 0), 0);
      const fails = results.length - successes.length;

      if (successes.length === 0) throw new Error('Falha ao bloquear agendas. Tente novamente.');

      toast({
        title: successes.length === 1 ? 'Agenda Bloqueada!' : 'Agendas Bloqueadas!',
        description: `${successes.length} médico(s) processados. ${totalAfetados} agendamento(s) serão cancelados${fails ? ` • ${fails} falha(s)` : ''}.`,
      });

      setMedicoIds([]);
      setDataInicio('');
      setDataFim('');
      setMotivo('');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast({ title: 'Erro ao Bloquear Agenda', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── listagem de bloqueios ─────────────────────────────────────────────────

  const sortBloqueios = (list: Bloqueio[]): Bloqueio[] =>
    [...list].sort((a, b) => {
      if (a.data_inicio !== b.data_inicio) return b.data_inicio.localeCompare(a.data_inicio);
      return b.created_at.localeCompare(a.created_at);
    });

  const carregarBloqueios = async (id: string) => {
    if (!id) return;
    setLoadingBloqueios(true);
    try {
      if (id === 'ALL') {
        const results = await Promise.all(
          medicos.map(m =>
            supabase.functions.invoke('bloqueio-agenda', { body: { action: 'list', medicoId: m.id } })
          )
        );
        const todos: Bloqueio[] = [];
        for (let i = 0; i < results.length; i++) {
          const { data, error } = results[i];
          if (!error && data?.success) {
            const comMedico = (data.data || []).map((b: Bloqueio) => ({ ...b, medico_id: medicos[i].id }));
            todos.push(...comMedico);
          }
        }
        setBloqueios(sortBloqueios(todos));
        return;
      }

      const { data, error } = await supabase.functions.invoke('bloqueio-agenda', {
        body: { action: 'list', medicoId: id },
      });
      if (error) { toast({ title: 'Erro', description: 'Erro ao carregar bloqueios', variant: 'destructive' }); return; }
      if (!data?.success) { toast({ title: 'Erro', description: data?.error || 'Erro ao carregar bloqueios', variant: 'destructive' }); return; }
      setBloqueios(sortBloqueios(data.data || []));
    } catch (error: any) {
      toast({ title: 'Erro', description: `Erro inesperado: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingBloqueios(false);
    }
  };

  // ── remoção de bloqueio ───────────────────────────────────────────────────

  const handleRemoverBloqueio = async () => {
    if (!bloqueioParaRemover) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bloqueio-agenda', {
        body: { action: 'remove', bloqueioId: bloqueioParaRemover.id },
      });
      if (error) { toast({ title: 'Erro', description: 'Erro ao remover bloqueio', variant: 'destructive' }); return; }
      if (!data?.success) { toast({ title: 'Erro', description: data?.error || 'Erro ao remover bloqueio', variant: 'destructive' }); return; }

      toast({
        title: 'Sucesso',
        description: data.data.agendamentos_restaurados
          ? `Bloqueio removido! ${data.data.agendamentos_restaurados} agendamento(s) restaurado(s).`
          : 'Bloqueio removido com sucesso!',
      });

      if (selectedDoctorAbrir) carregarBloqueios(selectedDoctorAbrir);
      if (onRefresh) onRefresh();
      setBloqueioParaRemover(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: `Erro inesperado: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const nomeDoMedico = (id?: string) => medicos.find(m => m.id === id)?.nome ?? '';

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {onBack && (
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gestão de Bloqueios de Agenda
          </CardTitle>
          <CardDescription>Bloqueie ou abra períodos específicos na agenda dos médicos</CardDescription>
        </CardHeader>

        <CardContent>
          {loadingMedicos ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando médicos...</p>
            </div>
          ) : medicos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum médico ativo encontrado</p>
            </div>
          ) : (
            <Tabs defaultValue="bloquear" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bloquear">Bloquear Agenda</TabsTrigger>
                <TabsTrigger value="abrir">Abrir Agenda</TabsTrigger>
              </TabsList>

              {/* ── ABA BLOQUEAR ─────────────────────────────────────────── */}
              <TabsContent value="bloquear" className="space-y-6 mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Médico(s)
                    </Label>

                    {/* badges dos médicos selecionados individualmente */}
                    {!isAllSelected && medicoIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {medicoIds.map(id => {
                          const m = medicos.find(m => m.id === id);
                          return m ? (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="cursor-pointer text-xs"
                              onClick={() => toggleMedico(id)}
                            >
                              {m.nome} ×
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="w-full justify-between"
                        >
                          {labelBloquear()}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                        <Command>
                          <CommandInput placeholder="Pesquisar médico..." />
                          <CommandList>
                            <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                key="ALL"
                                value="Todos os médicos"
                                onSelect={() => toggleMedico('ALL')}
                              >
                                <Check className={cn('mr-2 h-4 w-4', isAllSelected ? 'opacity-100' : 'opacity-0')} />
                                Todos os médicos
                              </CommandItem>
                              {medicos.map(medico => (
                                <CommandItem
                                  key={medico.id}
                                  value={`${medico.nome} ${medico.especialidade}`}
                                  onSelect={() => toggleMedico(medico.id)}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', medicoIds.includes(medico.id) ? 'opacity-100' : 'opacity-0')} />
                                  {medico.nome} - {medico.especialidade}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataInicio" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Data de Início
                      </Label>
                      <Input
                        id="dataInicio"
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataFim" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Data de Fim
                      </Label>
                      <Input
                        id="dataFim"
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        min={dataInicio || new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motivo" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Motivo do Bloqueio
                    </Label>
                    <Textarea
                      id="motivo"
                      placeholder="Ex: Médico em férias, emergência pessoal, etc."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  {medicoIds.length > 0 && dataInicio && dataFim && (
                    <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-l-destructive">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Ação que será executada:
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Agenda de <strong>{previewMedicos()}</strong> será bloqueada</li>
                        <li>• Período: <strong>{formatDateForDisplay(dataInicio)}</strong> até <strong>{formatDateForDisplay(dataFim)}</strong></li>
                        <li>• Todos os agendamentos neste período serão <strong>cancelados temporariamente</strong></li>
                        <li>• Os agendamentos serão <strong>restaurados automaticamente</strong> se você abrir a agenda novamente</li>
                        <li>• Pacientes serão <strong>notificados via WhatsApp</strong> sobre o cancelamento</li>
                      </ul>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || medicoIds.length === 0 || !dataInicio || !dataFim || !motivo}
                    className="w-full"
                    variant="destructive"
                  >
                    {loading ? (
                      <><Clock className="mr-2 h-4 w-4 animate-spin" />Processando Bloqueio...</>
                    ) : (
                      <><AlertTriangle className="mr-2 h-4 w-4" />Bloquear Agenda e Notificar Pacientes</>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ── ABA ABRIR ────────────────────────────────────────────── */}
              <TabsContent value="abrir" className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="medico-abrir">Médico</Label>
                  <Popover open={openDoctorAbrir} onOpenChange={setOpenDoctorAbrir}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDoctorAbrir}
                        className="w-full justify-between"
                      >
                        {selectedDoctorAbrir === 'ALL'
                          ? 'Todos os médicos'
                          : selectedDoctorAbrir
                            ? medicos.find(m => m.id === selectedDoctorAbrir)?.nome
                            : 'Selecione um médico...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar médico..." />
                        <CommandList>
                          <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              key="ALL"
                              value="Todos os médicos"
                              onSelect={() => {
                                setSelectedDoctorAbrir('ALL');
                                setOpenDoctorAbrir(false);
                                setFiltroBusca('');
                                carregarBloqueios('ALL');
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selectedDoctorAbrir === 'ALL' ? 'opacity-100' : 'opacity-0')} />
                              Todos os médicos
                            </CommandItem>
                            {medicos.map(medico => (
                              <CommandItem
                                key={medico.id}
                                value={medico.nome}
                                onSelect={() => {
                                  setSelectedDoctorAbrir(medico.id);
                                  setOpenDoctorAbrir(false);
                                  setFiltroBusca('');
                                  carregarBloqueios(medico.id);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', selectedDoctorAbrir === medico.id ? 'opacity-100' : 'opacity-0')} />
                                {medico.nome}
                                <span className="ml-auto text-sm text-muted-foreground">{medico.especialidade}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedDoctorAbrir && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Bloqueios Ativos</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => carregarBloqueios(selectedDoctorAbrir)}
                        disabled={loadingBloqueios}
                      >
                        {loadingBloqueios ? 'Carregando...' : 'Atualizar'}
                      </Button>
                    </div>

                    <Input
                      placeholder="Buscar por data (dd/mm/aaaa)"
                      value={filtroBusca}
                      onChange={(e) => setFiltroBusca(e.target.value)}
                    />

                    {loadingBloqueios ? (
                      <div className="text-center py-8">
                        <div className="text-muted-foreground">Carregando bloqueios...</div>
                      </div>
                    ) : bloqueios.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-muted-foreground">Nenhum bloqueio ativo encontrado.</div>
                      </div>
                    ) : (() => {
                      const filtrados = filtroBusca
                        ? bloqueios.filter(b =>
                            formatDateForDisplay(b.data_inicio).includes(filtroBusca) ||
                            formatDateForDisplay(b.data_fim).includes(filtroBusca)
                          )
                        : bloqueios;

                      return filtrados.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-muted-foreground">Nenhum bloqueio encontrado para a data pesquisada.</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filtrados.map(bloqueio => (
                            <Card key={bloqueio.id}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    {selectedDoctorAbrir === 'ALL' && bloqueio.medico_id && (
                                      <div className="text-xs font-semibold text-primary">
                                        {nomeDoMedico(bloqueio.medico_id)}
                                      </div>
                                    )}
                                    <div className="font-medium">
                                      {formatDateForDisplay(bloqueio.data_inicio)} até {formatDateForDisplay(bloqueio.data_fim)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      <strong>Motivo:</strong> {bloqueio.motivo}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Criado em {formatDateForDisplay(bloqueio.created_at)} por {bloqueio.criado_por}
                                    </div>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBloqueioParaRemover(bloqueio)}
                                    disabled={loading}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remover
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação — Bloqueio */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Confirmar Bloqueio de Agenda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  ⚠️ Atenção: Os agendamentos serão cancelados temporariamente
                </p>
                <ul className="text-sm space-y-1">
                  <li>• Médico(s): <strong>{previewMedicos()}</strong></li>
                  <li>• Período: <strong>{formatDateForDisplay(dataInicio)}</strong> até <strong>{formatDateForDisplay(dataFim)}</strong></li>
                  <li>• Agendamentos serão <strong>cancelados temporariamente</strong></li>
                  <li>• Você pode <strong>restaurá-los</strong> abrindo a agenda novamente</li>
                  <li>• Pacientes serão notificados via WhatsApp</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1" disabled={loading}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleBloqueioAgenda} className="flex-1" disabled={loading}>
                  {loading
                    ? <><Clock className="mr-2 h-4 w-4 animate-spin" />Processando...</>
                    : 'Confirmar Bloqueio'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Confirmação — Remoção */}
      {bloqueioParaRemover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Confirmar Remoção de Bloqueio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-primary font-medium mb-2">
                  ✅ Ao remover este bloqueio, os agendamentos cancelados pelo bloqueio serão automaticamente restaurados.
                </p>
                <ul className="text-sm space-y-1">
                  <li>• Período: <strong>{formatDateForDisplay(bloqueioParaRemover.data_inicio)}</strong> até <strong>{formatDateForDisplay(bloqueioParaRemover.data_fim)}</strong></li>
                  <li>• Motivo: <strong>{bloqueioParaRemover.motivo}</strong></li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setBloqueioParaRemover(null)} className="flex-1" disabled={loading}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleRemoverBloqueio} className="flex-1" disabled={loading}>
                  {loading
                    ? <><Clock className="mr-2 h-4 w-4 animate-spin" />Removendo...</>
                    : 'Confirmar Remoção'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
