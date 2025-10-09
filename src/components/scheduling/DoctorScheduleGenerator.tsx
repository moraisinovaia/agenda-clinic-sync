import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { format, addDays, getDay, eachDayOfInterval, parseISO, isValid, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { Clock, CalendarDays, AlertCircle, Zap, AlertTriangle, Check, ChevronsUpDown, Plus, Trash2, Settings, CalendarIcon, Loader2 } from 'lucide-react';
import { useScheduleGenerator } from '@/hooks/useScheduleGenerator';
import { DaySchedule } from '@/types/schedule-generator';
import { Doctor } from '@/types/scheduling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { generateTimeSlots } from '@/utils/scheduleGenerator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEmptySlotsManager, EmptySlot } from '@/hooks/useEmptySlotsManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface DoctorScheduleGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  preSelectedDoctorId?: string;
  onSuccess?: () => void;
  emptySlots?: any[];
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function DoctorScheduleGenerator({
  open,
  onOpenChange,
  doctors,
  preSelectedDoctorId,
  onSuccess,
  emptySlots = []
}: DoctorScheduleGeneratorProps) {
  const { generateSchedule, loading } = useScheduleGenerator();
  const { profile, loading: authLoading } = useAuth();
  const { loading: slotsLoading, fetchEmptySlots, deleteSlot, deleteSlotsForDate, deleteSlotsForPeriod } = useEmptySlotsManager();
  
  // States compartilhados entre abas
  const [selectedDoctor, setSelectedDoctor] = useState<string>(preSelectedDoctorId || '');
  const [openDoctorSearch, setOpenDoctorSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'gerar' | 'adicionar' | 'gerenciar'>('gerar');
  
  // States da aba "Gerar em Lote"
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [intervaloMinutos, setIntervaloMinutos] = useState<1 | 5 | 10 | 15 | 20 | 30>(15);
  const [previewCount, setPreviewCount] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  
  const [schedules, setSchedules] = useState<DaySchedule[]>(
    DIAS_SEMANA.map(dia => ({
      dia_semana: dia.value,
      manha: { ativo: false, hora_inicio: '08:00', hora_fim: '12:00' },
      tarde: { ativo: false, hora_inicio: '13:00', hora_fim: '18:00' },
    }))
  );
  
  // States da aba "Adicionar Manualmente"
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States da aba "Gerenciar Existentes"
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<EmptySlot[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'slot' | 'date' | 'period', value: string | null }>({ type: 'slot', value: null });

  const updateSchedule = (diaIndex: number, periodo: 'manha' | 'tarde', field: string, value: any) => {
    setSchedules(prev => prev.map((sched, idx) => 
      idx === diaIndex 
        ? { 
            ...sched, 
            [periodo]: { ...sched[periodo], [field]: value } 
          }
        : sched
    ));
  };

  const applyQuickConfig = (type: 'weekdays' | 'allMornings' | 'allAfternoons') => {
    const newSchedules = [...schedules];
    
    switch (type) {
      case 'weekdays':
        newSchedules.forEach((sched, idx) => {
          if (idx >= 1 && idx <= 5) {
            sched.manha = { ativo: true, hora_inicio: '08:00', hora_fim: '12:00' };
            sched.tarde = { ativo: true, hora_inicio: '13:00', hora_fim: '18:00' };
          } else {
            sched.manha.ativo = false;
            sched.tarde.ativo = false;
          }
        });
        break;
      case 'allMornings':
        newSchedules.forEach(sched => {
          sched.manha = { ativo: true, hora_inicio: '08:00', hora_fim: '12:00' };
          sched.tarde.ativo = false;
        });
        break;
      case 'allAfternoons':
        newSchedules.forEach(sched => {
          sched.manha.ativo = false;
          sched.tarde = { ativo: true, hora_inicio: '13:00', hora_fim: '18:00' };
        });
        break;
    }
    
    setSchedules(newSchedules);
  };

  const calculatePreview = () => {
    if (!selectedDoctor) return 0;
    
    const start = toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE);
    const end = toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE);
    
    if (!isValid(start) || !isValid(end)) return 0;
    if (start > end) return 0;
    
    const allDays = eachDayOfInterval({ start, end });
    let totalSlots = 0;
    
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      const schedule = schedules[dayOfWeek];
      
      ['manha', 'tarde'].forEach((periodo) => {
        const p = periodo as 'manha' | 'tarde';
        if (schedule[p].ativo) {
          const timeSlots = generateTimeSlots(
            schedule[p].hora_inicio,
            schedule[p].hora_fim,
            intervaloMinutos
          );
          totalSlots += timeSlots.length;
        }
      });
    });
    
    return totalSlots;
  };

  const getActiveDaysSummary = () => {
    const activeDays = schedules
      .map((sched, idx) => {
        const periods = [];
        if (sched.manha.ativo) periods.push(`Manhã (${sched.manha.hora_inicio}-${sched.manha.hora_fim})`);
        if (sched.tarde.ativo) periods.push(`Tarde (${sched.tarde.hora_inicio}-${sched.tarde.hora_fim})`);
        
        if (periods.length > 0) {
          return `${DIAS_SEMANA[idx].label}: ${periods.join(' + ')}`;
        }
        return null;
      })
      .filter(Boolean);
    
    return activeDays;
  };

  const hasActiveConfig = schedules.some(s => s.manha.ativo || s.tarde.ativo);

  useEffect(() => {
    if (preSelectedDoctorId) {
      setSelectedDoctor(preSelectedDoctorId);
    }
  }, [preSelectedDoctorId]);
  
  useEffect(() => {
    if (open && preSelectedDoctorId && selectedDoctor !== preSelectedDoctorId) {
      setSelectedDoctor(preSelectedDoctorId);
    }
  }, [open, preSelectedDoctorId, selectedDoctor]);

  useEffect(() => {
    const count = calculatePreview();
    setPreviewCount(count);
  }, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);
  
  useEffect(() => {
    if (open && activeTab === 'gerenciar' && selectedDoctor) {
      loadSlots();
    }
  }, [open, activeTab, selectedDoctor]);

  // Funções da aba "Adicionar Manualmente"
  const validateTime = (timeStr: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  };

  const handleAddManualSlot = async () => {
    if (!selectedDoctor) {
      toast.error('Selecione um médico primeiro');
      return;
    }

    if (!selectedDate) {
      toast.error('Selecione uma data');
      return;
    }

    if (!time || !validateTime(time)) {
      toast.error('Digite uma hora válida no formato HH:mm (ex: 08:30)');
      return;
    }

    setIsSubmitting(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: existingAppointment } = await supabase
        .from('agendamentos')
        .select('id, pacientes(nome_completo)')
        .eq('medico_id', selectedDoctor)
        .eq('data_agendamento', dateStr)
        .eq('hora_agendamento', time)
        .neq('status', 'cancelado')
        .neq('status', 'excluido')
        .maybeSingle();

      if (existingAppointment) {
        toast.error(`Já existe um agendamento neste horário`);
        setIsSubmitting(false);
        return;
      }

      const { data: existingSlot } = await supabase
        .from('horarios_vazios')
        .select('id')
        .eq('medico_id', selectedDoctor)
        .eq('data', dateStr)
        .eq('hora', time)
        .maybeSingle();

      if (existingSlot) {
        toast.warning('Este horário vazio já existe');
        setIsSubmitting(false);
        return;
      }

      const { data: doctorData } = await supabase
        .from('medicos')
        .select('cliente_id')
        .eq('id', selectedDoctor)
        .single();

      if (!doctorData?.cliente_id) {
        toast.error('Erro ao buscar dados do médico');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('horarios_vazios')
        .insert({
          medico_id: selectedDoctor,
          data: dateStr,
          hora: time,
          status: 'disponivel',
          cliente_id: doctorData.cliente_id
        });

      if (error) throw error;

      toast.success(`Horário ${time} adicionado com sucesso!`);
      onSuccess?.();
      setTime('');
      setSelectedDate(new Date());
    } catch (error) {
      console.error('Erro ao adicionar horário:', error);
      toast.error('Erro ao adicionar horário');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funções da aba "Gerenciar Existentes"
  const loadSlots = async () => {
    if (!selectedDoctor) return;
    const data = await fetchEmptySlots(selectedDoctor, startDate, endDate);
    setSlots(data);
  };

  const handleSearch = () => {
    loadSlots();
  };

  const handleDeleteSlot = async (slotId: string) => {
    const success = await deleteSlot(slotId);
    if (success) {
      loadSlots();
      onSuccess?.();
    }
    setDeleteConfirm({ type: 'slot', value: null });
  };

  const handleDeleteDate = async (date: string) => {
    if (!selectedDoctor) return;
    const success = await deleteSlotsForDate(selectedDoctor, date);
    if (success) {
      loadSlots();
      onSuccess?.();
    }
    setDeleteConfirm({ type: 'date', value: null });
  };

  const handleDeletePeriod = async () => {
    if (!selectedDoctor) return;
    const success = await deleteSlotsForPeriod(selectedDoctor, startDate, endDate);
    if (success) {
      loadSlots();
      onSuccess?.();
    }
    setDeleteConfirm({ type: 'period', value: null });
  };

  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.data]) {
      acc[slot.data] = [];
    }
    acc[slot.data].push(slot);
    return acc;
  }, {} as Record<string, EmptySlot[]>);

  const sortedDates = Object.keys(groupedSlots).sort();

  const handleGenerate = async () => {
    if (!selectedDoctor) {
      setShowValidation(true);
      toast.error('Selecione um médico primeiro');
      return;
    }
    
    if (!profile?.cliente_id) {
      toast.loading('Aguardando dados do usuário...', { id: 'waiting-profile' });
      
      let attempts = 0;
      while (!profile?.cliente_id && attempts < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      toast.dismiss('waiting-profile');
      
      if (!profile?.cliente_id) {
        toast.error('Erro: Dados do usuário não carregados. Recarregue a página.');
        return;
      }
    }
    
    setShowValidation(false);

    const activeConfigs = schedules.flatMap(sched => 
      (['manha', 'tarde'] as const).flatMap(periodo => 
        sched[periodo].ativo
          ? [{
              medico_id: selectedDoctor,
              cliente_id: profile.cliente_id,
              dia_semana: sched.dia_semana,
              periodo,
              hora_inicio: sched[periodo].hora_inicio,
              hora_fim: sched[periodo].hora_fim,
              intervalo_minutos: intervaloMinutos,
              ativo: true
            }]
          : []
      )
    );

    if (activeConfigs.length === 0) {
      toast.error('Configure pelo menos um período de atendimento (Manhã ou Tarde)');
      return;
    }

    const result = await generateSchedule({
      medico_id: selectedDoctor,
      data_inicio: dataInicio,
      data_fim: dataFim,
      configuracoes: activeConfigs
    }, profile.cliente_id!);

    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const selectedDoctorData = doctors.find(d => d.id === selectedDoctor);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gerenciamento de Horários Vazios
            </DialogTitle>
            {selectedDoctorData && (
              <DialogDescription>
                {selectedDoctorData.nome} - {selectedDoctorData.especialidade}
              </DialogDescription>
            )}
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="gerar" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Gerar em Lote
              </TabsTrigger>
              <TabsTrigger value="adicionar" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Manual
              </TabsTrigger>
              <TabsTrigger value="gerenciar" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Gerenciar ({slots.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: GERAR EM LOTE */}
            <TabsContent value="gerar" className="space-y-6 mt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Este sistema cria horários vazios na agenda do médico. Agendamentos existentes não serão afetados.
                </AlertDescription>
              </Alert>

              {!hasActiveConfig && selectedDoctor && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-semibold">
                    ⚠️ Nenhum período configurado! Marque pelo menos uma checkbox de Manhã ou Tarde.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Médico *</Label>
                  <Popover open={openDoctorSearch} onOpenChange={setOpenDoctorSearch}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDoctorSearch}
                        className={`w-full justify-between ${
                          showValidation && !selectedDoctor ? 'border-red-500 border-2' : ''
                        }`}
                      >
                        {selectedDoctor
                          ? doctors.find((doc) => doc.id === selectedDoctor)?.nome
                          : "Selecione o médico"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Pesquisar médico..." />
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {doctors.map((doc) => (
                              <CommandItem
                                key={doc.id}
                                value={`${doc.nome} ${doc.especialidade}`}
                                onSelect={() => {
                                  setSelectedDoctor(doc.id);
                                  setShowValidation(false);
                                  setOpenDoctorSearch(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedDoctor === doc.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {doc.nome} - {doc.especialidade}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {showValidation && !selectedDoctor && (
                    <p className="text-sm text-red-500 font-medium">Selecione um médico para continuar</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Intervalo entre horários</Label>
                  <Select 
                    value={String(intervaloMinutos)} 
                    onValueChange={(v) => setIntervaloMinutos(Number(v) as 1 | 5 | 10 | 15 | 20 | 30)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 minuto (máxima flexibilidade)</SelectItem>
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="20">20 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    💡 Intervalos menores geram mais horários disponíveis
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input 
                    type="date" 
                    value={dataInicio} 
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Fim *</Label>
                  <Input 
                    type="date" 
                    value={dataFim} 
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4" />
                    Horários de Atendimento
                  </h3>
                  
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => applyQuickConfig('weekdays')}
                      className="flex items-center gap-1 h-8 text-xs"
                    >
                      <Zap className="h-3 w-3" />
                      Seg-Sex 8-18h
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => applyQuickConfig('allMornings')}
                      className="h-8 text-xs"
                    >
                      Todas Manhãs
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => applyQuickConfig('allAfternoons')}
                      className="h-8 text-xs"
                    >
                      Todas Tardes
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground">
                  <div className="col-span-2">Dia da Semana</div>
                  <div className="col-span-5 text-center">Período da Manhã</div>
                  <div className="col-span-5 text-center">Período da Tarde</div>
                </div>
                
                <div className="divide-y">
                  {schedules.map((sched, idx) => {
                    const daysInPeriod = dataInicio && dataFim ? (() => {
                      const start = toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE);
                      const end = toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE);
                      if (!isValid(start) || !isValid(end)) return [];
                      return eachDayOfInterval({ start, end }).map(d => getDay(d));
                    })() : [];
                    
                    const dayExistsInPeriod = daysInPeriod.includes(idx);
                    
                    return (
                      <div 
                        key={idx} 
                        className={`grid grid-cols-12 gap-2 items-center px-4 py-3 transition-all hover:bg-muted/30 ${
                          idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                        } ${!dayExistsInPeriod ? 'opacity-40' : ''}`}
                      >
                        <div className="col-span-2 font-medium text-sm flex items-center gap-2">
                          <span className={sched.manha.ativo || sched.tarde.ativo ? 'text-primary' : ''}>
                            {DIAS_SEMANA[idx].label}
                          </span>
                          {!dayExistsInPeriod && dataInicio && dataFim && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                              fora do período
                            </Badge>
                          )}
                        </div>
                      
                        <div className="col-span-5 flex items-center gap-2">
                          <Checkbox 
                            id={`manha-${idx}`}
                            checked={sched.manha.ativo}
                            onCheckedChange={(checked) => 
                              updateSchedule(idx, 'manha', 'ativo', checked)
                            }
                            className="data-[state=checked]:bg-primary"
                          />
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input 
                              type="time" 
                              className="h-9 text-xs font-mono"
                              value={sched.manha.hora_inicio}
                              disabled={!sched.manha.ativo}
                              onChange={(e) => updateSchedule(idx, 'manha', 'hora_inicio', e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">até</span>
                            <Input 
                              type="time" 
                              className="h-9 text-xs font-mono"
                              value={sched.manha.hora_fim}
                              disabled={!sched.manha.ativo}
                              onChange={(e) => updateSchedule(idx, 'manha', 'hora_fim', e.target.value)}
                            />
                          </div>
                        </div>
                      
                        <div className="col-span-5 flex items-center gap-2">
                          <Checkbox 
                            id={`tarde-${idx}`}
                            checked={sched.tarde.ativo}
                            onCheckedChange={(checked) => 
                              updateSchedule(idx, 'tarde', 'ativo', checked)
                            }
                            className="data-[state=checked]:bg-primary"
                          />
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input 
                              type="time" 
                              className="h-9 text-xs font-mono"
                              value={sched.tarde.hora_inicio}
                              disabled={!sched.tarde.ativo}
                              onChange={(e) => updateSchedule(idx, 'tarde', 'hora_inicio', e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">até</span>
                            <Input 
                              type="time" 
                              className="h-9 text-xs font-mono"
                              value={sched.tarde.hora_fim}
                              disabled={!sched.tarde.ativo}
                              onChange={(e) => updateSchedule(idx, 'tarde', 'hora_fim', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasActiveConfig && previewCount > 0 && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <AlertDescription>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">📊 Resumo da Geração:</span>
                        <Badge variant="secondary" className="text-lg">
                          ~{previewCount} horários
                        </Badge>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p><strong>Período:</strong> {format(toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE), 'dd/MM/yyyy')} até {format(toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE), 'dd/MM/yyyy')}</p>
                        <p><strong>Intervalo:</strong> {intervaloMinutos} minutos</p>
                        <p><strong>Dias configurados:</strong></p>
                        <ul className="ml-4 list-disc">
                          {getActiveDaysSummary().map((day, idx) => (
                            <li key={idx}>{day}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancelar
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button 
                          onClick={handleGenerate} 
                          disabled={loading || authLoading || !selectedDoctor || previewCount === 0 || !hasActiveConfig || !profile?.cliente_id}
                        >
                          {authLoading 
                            ? 'Carregando dados...' 
                            : loading 
                              ? 'Gerando...' 
                              : !profile?.cliente_id
                                ? 'Aguardando dados...'
                                : !selectedDoctor 
                                  ? 'Selecione um médico' 
                                  : !hasActiveConfig 
                                    ? 'Configure horários' 
                                    : previewCount === 0 
                                      ? 'Nenhum horário será gerado' 
                                      : `Gerar ${previewCount} Horários`
                          }
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(!selectedDoctor || !hasActiveConfig || previewCount === 0 || !profile?.cliente_id) && (
                      <TooltipContent>
                        <p>
                          {!selectedDoctor && "Selecione um médico primeiro"}
                          {selectedDoctor && !hasActiveConfig && "Configure pelo menos um período (Manhã ou Tarde)"}
                          {selectedDoctor && hasActiveConfig && previewCount === 0 && "Nenhum horário será gerado com esta configuração"}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TabsContent>

            {/* ABA 2: ADICIONAR MANUAL */}
            <TabsContent value="adicionar" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Médico *</Label>
                  <Popover open={openDoctorSearch} onOpenChange={setOpenDoctorSearch}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDoctorSearch}
                        className="w-full justify-between"
                      >
                        {selectedDoctor
                          ? doctors.find((doc) => doc.id === selectedDoctor)?.nome
                          : "Selecione o médico"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Pesquisar médico..." />
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {doctors.map((doc) => (
                              <CommandItem
                                key={doc.id}
                                value={`${doc.nome} ${doc.especialidade}`}
                                onSelect={() => {
                                  setSelectedDoctor(doc.id);
                                  setOpenDoctorSearch(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedDoctor === doc.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {doc.nome} - {doc.especialidade}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={ptBR}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Hora (formato HH:mm)</Label>
                  <Input
                    id="time"
                    type="text"
                    placeholder="Ex: 08:30, 14:45, 07:02"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Você pode adicionar qualquer horário (ex: 07:02, 14:47)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddManualSlot} 
                  disabled={isSubmitting || !selectedDoctor || !selectedDate || !time}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Adicionando...' : 'Adicionar Horário'}
                </Button>
              </div>
            </TabsContent>

            {/* ABA 3: GERENCIAR EXISTENTES */}
            <TabsContent value="gerenciar" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Médico *</Label>
                  <Popover open={openDoctorSearch} onOpenChange={setOpenDoctorSearch}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDoctorSearch}
                        className="w-full justify-between"
                      >
                        {selectedDoctor
                          ? doctors.find((doc) => doc.id === selectedDoctor)?.nome
                          : "Selecione o médico"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Pesquisar médico..." />
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {doctors.map((doc) => (
                              <CommandItem
                                key={doc.id}
                                value={`${doc.nome} ${doc.especialidade}`}
                                onSelect={() => {
                                  setSelectedDoctor(doc.id);
                                  setOpenDoctorSearch(false);
                                  loadSlots();
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedDoctor === doc.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {doc.nome} - {doc.especialidade}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleSearch} className="w-full" disabled={slotsLoading || !selectedDoctor}>
                {slotsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
                Buscar Horários
              </Button>

              <ScrollArea className="h-[400px] rounded-md border p-4">
                {slotsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Clock className="h-12 w-12 mb-2" />
                    <p>Nenhum horário vazio encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <Badge variant="outline">
                        Total: {slots.length} horários
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm({ type: 'period', value: 'all' })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir todos do período
                      </Button>
                    </div>

                    {sortedDates.map(date => {
                      const dateSlots = groupedSlots[date];
                      const dateObj = parse(date, 'yyyy-MM-dd', new Date());
                      const formattedDate = format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

                      return (
                        <Card key={date} className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                              <h3 className="font-semibold capitalize">{formattedDate}</h3>
                              <Badge>{dateSlots.length} horários</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm({ type: 'date', value: date })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir dia
                            </Button>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {dateSlots.map(slot => (
                              <div
                                key={slot.id}
                                className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                              >
                                <span className="text-sm font-mono">{slot.hora}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setDeleteConfirm({ type: 'slot', value: slot.id })}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialogs de confirmação */}
      <AlertDialog open={deleteConfirm.value !== null} onOpenChange={() => setDeleteConfirm({ type: 'slot', value: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.type === 'slot' && 'Deseja realmente excluir este horário?'}
              {deleteConfirm.type === 'date' && 'Deseja realmente excluir TODOS os horários deste dia?'}
              {deleteConfirm.type === 'period' && `Deseja realmente excluir TODOS os ${slots.length} horários deste período?`}
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm.type === 'slot' && deleteConfirm.value) {
                  handleDeleteSlot(deleteConfirm.value);
                } else if (deleteConfirm.type === 'date' && deleteConfirm.value) {
                  handleDeleteDate(deleteConfirm.value);
                } else if (deleteConfirm.type === 'period') {
                  handleDeletePeriod();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
