import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, addDays, getDay, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';
import { Clock, CalendarDays, AlertCircle, Zap, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { useScheduleGenerator } from '@/hooks/useScheduleGenerator';
import { DaySchedule } from '@/types/schedule-generator';
import { Doctor } from '@/types/scheduling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { generateTimeSlots } from '@/utils/scheduleGenerator';
import { useAuth } from '@/hooks/useAuth';

interface DoctorScheduleGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  preSelectedDoctorId?: string;
  onSuccess?: () => void;
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
  onSuccess
}: DoctorScheduleGeneratorProps) {
  const { generateSchedule, loading } = useScheduleGenerator();
  const { profile, loading: authLoading } = useAuth();
  
  const [selectedDoctor, setSelectedDoctor] = useState<string>(preSelectedDoctorId || '');
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [intervaloMinutos, setIntervaloMinutos] = useState<10 | 15 | 20 | 30>(15);
  const [previewCount, setPreviewCount] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const [openDoctorSearch, setOpenDoctorSearch] = useState(false);
  
  const [schedules, setSchedules] = useState<DaySchedule[]>(
    DIAS_SEMANA.map(dia => ({
      dia_semana: dia.value,
      manha: { ativo: false, hora_inicio: '08:00', hora_fim: '12:00' },
      tarde: { ativo: false, hora_inicio: '13:00', hora_fim: '18:00' },
    }))
  );

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
        // Seg-Sex: 08:00-12:00 / 13:00-18:00
        newSchedules.forEach((sched, idx) => {
          if (idx >= 1 && idx <= 5) { // Segunda a Sexta
            sched.manha = { ativo: true, hora_inicio: '08:00', hora_fim: '12:00' };
            sched.tarde = { ativo: true, hora_inicio: '13:00', hora_fim: '18:00' };
          } else {
            sched.manha.ativo = false;
            sched.tarde.ativo = false;
          }
        });
        break;
      case 'allMornings':
        // Todas as manhãs 08:00-12:00
        newSchedules.forEach(sched => {
          sched.manha = { ativo: true, hora_inicio: '08:00', hora_fim: '12:00' };
          sched.tarde.ativo = false;
        });
        break;
      case 'allAfternoons':
        // Todas as tardes 13:00-18:00
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
    
    // ✅ Parsing seguro de datas com timezone do Brasil
    const start = toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE);
    const end = toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE);
    
    // ✅ Validação de datas
    if (!isValid(start) || !isValid(end)) {
      console.error('❌ Datas inválidas:', { dataInicio, dataFim });
      return 0;
    }
    
    if (start > end) {
      console.warn('⚠️ Data início posterior à data fim');
      return 0;
    }
    
    const allDays = eachDayOfInterval({ start, end });
    let totalSlots = 0;
    
    console.log('🔍 Calculando preview de slots:');
    console.log(`📅 Período: ${format(start, 'dd/MM/yyyy')} até ${format(end, 'dd/MM/yyyy')}`);
    console.log(`📊 Total de dias no intervalo: ${allDays.length}`);
    
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      const dayName = DIAS_SEMANA[dayOfWeek].label;
      const schedule = schedules[dayOfWeek];
      let daySlotsCount = 0;
      
      ['manha', 'tarde'].forEach((periodo) => {
        const p = periodo as 'manha' | 'tarde';
        if (schedule[p].ativo) {
          // ✅ USAR A MESMA LÓGICA do generateTimeSlots real
          const timeSlots = generateTimeSlots(
            schedule[p].hora_inicio,
            schedule[p].hora_fim,
            intervaloMinutos
          );
          daySlotsCount += timeSlots.length;
          totalSlots += timeSlots.length;
        }
      });
      
      // Log detalhado por dia
      if (daySlotsCount > 0) {
        console.log(`  ✅ ${format(day, 'dd/MM/yyyy')} (${dayName}):`, {
          manha_ativo: schedule.manha.ativo,
          manha_horario: schedule.manha.ativo ? `${schedule.manha.hora_inicio}-${schedule.manha.hora_fim}` : 'N/A',
          tarde_ativo: schedule.tarde.ativo,
          tarde_horario: schedule.tarde.ativo ? `${schedule.tarde.hora_inicio}-${schedule.tarde.hora_fim}` : 'N/A',
          slots_gerados: daySlotsCount
        });
      }
    });
    
    console.log(`🎯 Total de slots a serem gerados: ${totalSlots}`);
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

  // Atualizar selectedDoctor quando preSelectedDoctorId mudar ou quando o modal abrir
  useEffect(() => {
    if (preSelectedDoctorId) {
      setSelectedDoctor(preSelectedDoctorId);
      console.log('🎯 Médico pré-selecionado:', preSelectedDoctorId);
    }
  }, [preSelectedDoctorId]);
  
  // Garantir que o médico seja selecionado quando o modal abrir
  useEffect(() => {
    if (open && preSelectedDoctorId && selectedDoctor !== preSelectedDoctorId) {
      setSelectedDoctor(preSelectedDoctorId);
      console.log('🔄 Atualizando médico ao abrir modal:', preSelectedDoctorId);
    }
  }, [open, preSelectedDoctorId, selectedDoctor]);

  useEffect(() => {
    const count = calculatePreview();
    setPreviewCount(count);
    
    console.log('📊 Preview atualizado:', {
      selectedDoctor,
      hasActiveConfig,
      previewCount: count,
      dataInicio,
      dataFim
    });
  }, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);

  const handleGenerate = async () => {
    if (!selectedDoctor) {
      setShowValidation(true);
      toast.error('Selecione um médico primeiro');
      return;
    }
    
    // ✅ CORREÇÃO DEFINITIVA: Aguardar até 3 segundos pelo cliente_id
    if (!profile?.cliente_id) {
      console.warn('⏳ Cliente ID ainda não carregado, aguardando...');
      toast.loading('Aguardando dados do usuário...', { id: 'waiting-profile' });
      
      // Aguardar até 3 segundos pelo profile
      let attempts = 0;
      while (!profile?.cliente_id && attempts < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      toast.dismiss('waiting-profile');
      
      if (!profile?.cliente_id) {
        console.error('❌ Cliente ID não encontrado após aguardar');
        toast.error('Erro: Dados do usuário não carregados. Recarregue a página.');
        return;
      }
      
      console.log('✅ Cliente ID carregado:', profile.cliente_id);
    }
    
    setShowValidation(false);

    const activeConfigs = schedules.flatMap(sched => 
      (['manha', 'tarde'] as const).flatMap(periodo => 
        sched[periodo].ativo
          ? [{
              medico_id: selectedDoctor,
              cliente_id: profile.cliente_id, // ✅ ADICIONAR cliente_id
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

    console.log('🚀 Gerando horários com configuração:', {
      medico_id: selectedDoctor,
      cliente_id: profile.cliente_id,
      periodo: `${dataInicio} até ${dataFim}`,
      configuracoes_ativas: activeConfigs.length,
      estimativa: previewCount
    });

    // ✅ Passar cliente_id como parâmetro
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Gerar Horários Vazios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                onValueChange={(v) => setIntervaloMinutos(Number(v) as 10 | 15 | 20 | 30)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                </SelectContent>
              </Select>
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

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground">
              <div className="col-span-2">Dia da Semana</div>
              <div className="col-span-5 text-center">Período da Manhã</div>
              <div className="col-span-5 text-center">Período da Tarde</div>
            </div>
            
            <div className="divide-y">
              {schedules.map((sched, idx) => {
                // Calcular se este dia da semana existe no período selecionado
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

          {previewCount === 0 && hasActiveConfig && selectedDoctor && (() => {
            const activeDaysNames = schedules
              .map((s, i) => (s.manha.ativo || s.tarde.ativo) ? DIAS_SEMANA[i].label : null)
              .filter(Boolean);
            
            const startDay = format(toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE), 'EEEE', { locale: ptBR });
            const endDay = format(toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE), 'EEEE', { locale: ptBR });
            
            return (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>⚠️ Nenhum horário será gerado!</strong>
                  <div className="text-sm mt-2 space-y-1">
                    <p><strong>Dias configurados:</strong> {activeDaysNames.join(', ')}</p>
                    <p><strong>Período selecionado:</strong> {startDay} ({format(toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE), 'dd/MM')}) até {endDay} ({format(toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE), 'dd/MM')})</p>
                    <p className="mt-2 font-medium">💡 Solução:</p>
                    <ul className="list-disc ml-5">
                      <li>Ajuste as <strong>datas</strong> para incluir os dias configurados, OU</li>
                      <li>Configure os <strong>dias da semana</strong> que existem no período selecionado</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })()}
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
