import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addDays, getDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CalendarDays, AlertCircle, Zap, AlertTriangle } from 'lucide-react';
import { useScheduleGenerator } from '@/hooks/useScheduleGenerator';
import { DaySchedule } from '@/types/schedule-generator';
import { Doctor } from '@/types/scheduling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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
  
  const [selectedDoctor, setSelectedDoctor] = useState<string>(preSelectedDoctorId || '');
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [intervaloMinutos, setIntervaloMinutos] = useState<10 | 15 | 20 | 30>(15);
  const [previewCount, setPreviewCount] = useState(0);
  
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
    
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    const allDays = eachDayOfInterval({ start, end });
    
    let totalSlots = 0;
    
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      const schedule = schedules[dayOfWeek];
      
      ['manha', 'tarde'].forEach((periodo) => {
        const p = periodo as 'manha' | 'tarde';
        if (schedule[p].ativo) {
          const [startH, startM] = schedule[p].hora_inicio.split(':').map(Number);
          const [endH, endM] = schedule[p].hora_fim.split(':').map(Number);
          const minutes = (endH * 60 + endM) - (startH * 60 + startM);
          const slots = Math.floor(minutes / intervaloMinutos);
          totalSlots += slots;
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

  // Atualizar selectedDoctor quando preSelectedDoctorId mudar
  useEffect(() => {
    if (preSelectedDoctorId) {
      setSelectedDoctor(preSelectedDoctorId);
    }
  }, [preSelectedDoctorId]);

  useEffect(() => {
    setPreviewCount(calculatePreview());
  }, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);

  const handleGenerate = async () => {
    if (!selectedDoctor) {
      toast.error('Selecione um médico');
      return;
    }

    const activeConfigs = schedules.flatMap(sched => 
      (['manha', 'tarde'] as const).flatMap(periodo => 
        sched[periodo].ativo
          ? [{
              medico_id: selectedDoctor,
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
      periodo: `${dataInicio} até ${dataFim}`,
      configuracoes_ativas: activeConfigs.length,
      estimativa: previewCount
    });

    const result = await generateSchedule({
      medico_id: selectedDoctor,
      data_inicio: dataInicio,
      data_fim: dataFim,
      configuracoes: activeConfigs
    });

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
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o médico" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(doc => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.nome} - {doc.especialidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Configuração Semanal
              </h3>
              
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => applyQuickConfig('weekdays')}
                  className="flex items-center gap-1"
                >
                  <Zap className="h-3 w-3" />
                  Seg-Sex 8-18h
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => applyQuickConfig('allMornings')}
                >
                  Todas Manhãs
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => applyQuickConfig('allAfternoons')}
                >
                  Todas Tardes
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              {schedules.map((sched, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                  <div className="col-span-2 font-medium text-sm">
                    {DIAS_SEMANA[idx].label}
                  </div>
                  
                  <div className="col-span-5 flex items-center gap-2">
                    <Checkbox 
                      checked={sched.manha.ativo}
                      onCheckedChange={(checked) => 
                        updateSchedule(idx, 'manha', 'ativo', checked)
                      }
                    />
                    <Label className="text-xs">Manhã</Label>
                    <Input 
                      type="time" 
                      className="h-8 text-xs"
                      value={sched.manha.hora_inicio}
                      disabled={!sched.manha.ativo}
                      onChange={(e) => updateSchedule(idx, 'manha', 'hora_inicio', e.target.value)}
                    />
                    <span className="text-xs">às</span>
                    <Input 
                      type="time" 
                      className="h-8 text-xs"
                      value={sched.manha.hora_fim}
                      disabled={!sched.manha.ativo}
                      onChange={(e) => updateSchedule(idx, 'manha', 'hora_fim', e.target.value)}
                    />
                  </div>
                  
                  <div className="col-span-5 flex items-center gap-2">
                    <Checkbox 
                      checked={sched.tarde.ativo}
                      onCheckedChange={(checked) => 
                        updateSchedule(idx, 'tarde', 'ativo', checked)
                      }
                    />
                    <Label className="text-xs">Tarde</Label>
                    <Input 
                      type="time" 
                      className="h-8 text-xs"
                      value={sched.tarde.hora_inicio}
                      disabled={!sched.tarde.ativo}
                      onChange={(e) => updateSchedule(idx, 'tarde', 'hora_inicio', e.target.value)}
                    />
                    <span className="text-xs">às</span>
                    <Input 
                      type="time" 
                      className="h-8 text-xs"
                      value={sched.tarde.hora_fim}
                      disabled={!sched.tarde.ativo}
                      onChange={(e) => updateSchedule(idx, 'tarde', 'hora_fim', e.target.value)}
                    />
                  </div>
                </div>
              ))}
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
                    <p><strong>Período:</strong> {format(new Date(dataInicio), 'dd/MM/yyyy')} até {format(new Date(dataFim), 'dd/MM/yyyy')}</p>
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

          {previewCount === 0 && hasActiveConfig && selectedDoctor && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>⚠️ Nenhum horário será gerado!</strong>
                <p className="text-sm mt-1">
                  Verifique se os dias da semana configurados existem no período selecionado.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={loading || !selectedDoctor || previewCount === 0 || !hasActiveConfig}
          >
            {loading ? 'Gerando...' : `Gerar ${previewCount} Horários`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
