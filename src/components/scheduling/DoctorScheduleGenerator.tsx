import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CalendarDays, AlertCircle } from 'lucide-react';
import { useScheduleGenerator } from '@/hooks/useScheduleGenerator';
import { DaySchedule } from '@/types/schedule-generator';
import { Doctor } from '@/types/scheduling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

  const calculatePreview = () => {
    if (!selectedDoctor) return 0;
    
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let totalSlots = 0;
    schedules.forEach(sched => {
      ['manha', 'tarde'].forEach((periodo) => {
        const p = periodo as 'manha' | 'tarde';
        if (sched[p].ativo) {
          const [startH, startM] = sched[p].hora_inicio.split(':').map(Number);
          const [endH, endM] = sched[p].hora_fim.split(':').map(Number);
          const minutes = (endH * 60 + endM) - (startH * 60 + startM);
          const slots = Math.floor(minutes / intervaloMinutos);
          
          // Estimar quantos dias deste dia_semana existem no período
          const daysOfWeek = Math.ceil(days / 7);
          totalSlots += slots * daysOfWeek;
        }
      });
    });
    
    return totalSlots;
  };

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
      alert('Selecione um médico');
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
      alert('Configure pelo menos um período de atendimento');
      return;
    }

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
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Configuração Semanal
            </h3>
            
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

          {previewCount > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="flex items-center justify-between">
                <span>Estimativa de horários a serem criados:</span>
                <Badge variant="secondary" className="text-lg">
                  ~{previewCount} horários
                </Badge>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !selectedDoctor}>
            {loading ? 'Gerando...' : 'Gerar Horários'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
