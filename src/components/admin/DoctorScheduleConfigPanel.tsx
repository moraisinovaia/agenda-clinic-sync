import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStableAuth } from "@/hooks/useStableAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Calendar, Save, RotateCcw, Loader2, Building2, User } from "lucide-react";

interface HorarioConfig {
  id?: string;
  dia_semana: number;
  periodo: 'manha' | 'tarde' | 'noite';
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
}

interface DayConfig {
  manha: { ativo: boolean; hora_inicio: string; hora_fim: string };
  tarde: { ativo: boolean; hora_inicio: string; hora_fim: string };
  noite: { ativo: boolean; hora_inicio: string; hora_fim: string };
}

const DIAS_SEMANA = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const INTERVALOS = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
];

const DEFAULT_DAY_CONFIG: DayConfig = {
  manha: { ativo: false, hora_inicio: "08:00", hora_fim: "12:00" },
  tarde: { ativo: false, hora_inicio: "13:00", hora_fim: "18:00" },
  noite: { ativo: false, hora_inicio: "18:00", hora_fim: "21:00" },
};

const PRESETS = {
  diasUteis: {
    label: "Dias úteis integral",
    config: { manha: true, tarde: true, noite: false, dias: [1, 2, 3, 4, 5] }
  },
  soManhas: {
    label: "Só manhãs (Seg-Sex)",
    config: { manha: true, tarde: false, noite: false, dias: [1, 2, 3, 4, 5] }
  },
  soTardes: {
    label: "Só tardes (Seg-Sex)",
    config: { manha: false, tarde: true, noite: false, dias: [1, 2, 3, 4, 5] }
  },
  semanaCompleta: {
    label: "Semana completa",
    config: { manha: true, tarde: true, noite: false, dias: [0, 1, 2, 3, 4, 5, 6] }
  },
};

export default function DoctorScheduleConfigPanel() {
  const { profile, isAdmin, isClinicAdmin, clinicAdminClienteId } = useStableAuth();
  const queryClient = useQueryClient();
  
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [selectedMedicoId, setSelectedMedicoId] = useState<string>("");
  const [intervaloMinutos, setIntervaloMinutos] = useState<number>(15);
  const [scheduleConfig, setScheduleConfig] = useState<Record<number, DayConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize default config
  useEffect(() => {
    const initialConfig: Record<number, DayConfig> = {};
    DIAS_SEMANA.forEach(dia => {
      initialConfig[dia.value] = { ...DEFAULT_DAY_CONFIG };
    });
    setScheduleConfig(initialConfig);
  }, []);

  // Set clinic for clinic admin users
  useEffect(() => {
    if (isClinicAdmin && clinicAdminClienteId) {
      setSelectedClinicId(clinicAdminClienteId);
    } else if (!isAdmin && profile?.cliente_id) {
      setSelectedClinicId(profile.cliente_id);
    }
  }, [isAdmin, isClinicAdmin, clinicAdminClienteId, profile]);

  // Fetch clinics (admin global only)
  const { data: clinicas } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_clientes_ativos");
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !isClinicAdmin,
  });

  // Fetch doctors for selected clinic
  const { data: medicos, isLoading: loadingMedicos } = useQuery({
    queryKey: ["medicos-horarios", selectedClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicos")
        .select("id, nome, especialidade")
        .eq("cliente_id", selectedClinicId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClinicId,
  });

  // Fetch existing schedule config for selected doctor
  const { data: existingConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ["horarios-config", selectedMedicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horarios_configuracao")
        .select("*")
        .eq("medico_id", selectedMedicoId)
        .eq("cliente_id", selectedClinicId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMedicoId && !!selectedClinicId,
  });

  // Load existing config into state
  useEffect(() => {
    if (existingConfig && existingConfig.length > 0) {
      const newConfig: Record<number, DayConfig> = {};
      DIAS_SEMANA.forEach(dia => {
        newConfig[dia.value] = { ...DEFAULT_DAY_CONFIG };
      });

      existingConfig.forEach((config: any) => {
        const periodo = config.periodo as 'manha' | 'tarde' | 'noite';
        if (newConfig[config.dia_semana]) {
          newConfig[config.dia_semana][periodo] = {
            ativo: config.ativo ?? true,
            hora_inicio: config.hora_inicio,
            hora_fim: config.hora_fim,
          };
        }
        if (config.intervalo_minutos) {
          setIntervaloMinutos(config.intervalo_minutos);
        }
      });

      setScheduleConfig(newConfig);
      setHasChanges(false);
    } else if (existingConfig && existingConfig.length === 0) {
      // Reset to default if no config exists
      const initialConfig: Record<number, DayConfig> = {};
      DIAS_SEMANA.forEach(dia => {
        initialConfig[dia.value] = { ...DEFAULT_DAY_CONFIG };
      });
      setScheduleConfig(initialConfig);
      setHasChanges(false);
    }
  }, [existingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMedicoId || !selectedClinicId) {
        throw new Error("Selecione um médico");
      }

      // Delete existing configs
      const { error: deleteError } = await supabase
        .from("horarios_configuracao")
        .delete()
        .eq("medico_id", selectedMedicoId)
        .eq("cliente_id", selectedClinicId);

      if (deleteError) throw deleteError;

      // Build new configs
      const newConfigs: any[] = [];
      Object.entries(scheduleConfig).forEach(([diaSemana, dayConfig]) => {
        (['manha', 'tarde', 'noite'] as const).forEach(periodo => {
          const periodoConfig = dayConfig[periodo];
          if (periodoConfig.ativo) {
            newConfigs.push({
              medico_id: selectedMedicoId,
              cliente_id: selectedClinicId,
              dia_semana: parseInt(diaSemana),
              periodo,
              hora_inicio: periodoConfig.hora_inicio,
              hora_fim: periodoConfig.hora_fim,
              intervalo_minutos: intervaloMinutos,
              ativo: true,
            });
          }
        });
      });

      if (newConfigs.length > 0) {
        const { error: insertError } = await supabase
          .from("horarios_configuracao")
          .insert(newConfigs);
        if (insertError) throw insertError;
      }

      return newConfigs.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} configurações de horário salvas`);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["horarios-config", selectedMedicoId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const handlePeriodoChange = (diaSemana: number, periodo: 'manha' | 'tarde' | 'noite', field: string, value: any) => {
    setScheduleConfig(prev => ({
      ...prev,
      [diaSemana]: {
        ...prev[diaSemana],
        [periodo]: {
          ...prev[diaSemana][periodo],
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    const newConfig: Record<number, DayConfig> = {};
    
    DIAS_SEMANA.forEach(dia => {
      const isActiveDay = preset.config.dias.includes(dia.value);
      newConfig[dia.value] = {
        manha: { 
          ativo: isActiveDay && preset.config.manha, 
          hora_inicio: "08:00", 
          hora_fim: "12:00" 
        },
        tarde: { 
          ativo: isActiveDay && preset.config.tarde, 
          hora_inicio: "13:00", 
          hora_fim: "18:00" 
        },
        noite: { 
          ativo: isActiveDay && preset.config.noite, 
          hora_inicio: "18:00", 
          hora_fim: "21:00" 
        },
      };
    });

    setScheduleConfig(newConfig);
    setHasChanges(true);
    toast.info(`Preset "${preset.label}" aplicado`);
  };

  const clearAll = () => {
    const initialConfig: Record<number, DayConfig> = {};
    DIAS_SEMANA.forEach(dia => {
      initialConfig[dia.value] = { ...DEFAULT_DAY_CONFIG };
    });
    setScheduleConfig(initialConfig);
    setHasChanges(true);
    toast.info("Configurações limpas");
  };

  const getActivePeriodsCount = () => {
    let count = 0;
    Object.values(scheduleConfig).forEach(day => {
      if (day.manha.ativo) count++;
      if (day.tarde.ativo) count++;
      if (day.noite.ativo) count++;
    });
    return count;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Configuração de Horários
          {hasChanges && <Badge variant="secondary">Alterações não salvas</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Seletor de clínica apenas para admin global */}
          {isAdmin && !isClinicAdmin && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clínica
              </Label>
              <Select value={selectedClinicId} onValueChange={(v) => { setSelectedClinicId(v); setSelectedMedicoId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a clínica" />
                </SelectTrigger>
                <SelectContent>
                  {clinicas?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Médico
            </Label>
            <Select 
              value={selectedMedicoId} 
              onValueChange={setSelectedMedicoId}
              disabled={!selectedClinicId || loadingMedicos}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMedicos ? "Carregando..." : "Selecione o médico"} />
              </SelectTrigger>
              <SelectContent>
                {medicos?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} - {m.especialidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Intervalo padrão
            </Label>
            <Select 
              value={intervaloMinutos.toString()} 
              onValueChange={(v) => { setIntervaloMinutos(parseInt(v)); setHasChanges(true); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALOS.map((i) => (
                  <SelectItem key={i.value} value={i.value.toString()}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Presets */}
        {selectedMedicoId && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(key as keyof typeof PRESETS)}
              >
                {preset.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loadingConfig && selectedMedicoId && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando configurações...
          </div>
        )}

        {/* Schedule Grid */}
        {selectedMedicoId && !loadingConfig && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium">Dia</th>
                  <th className="text-center p-3 font-medium">Manhã</th>
                  <th className="text-center p-3 font-medium">Tarde</th>
                  <th className="text-center p-3 font-medium">Noite</th>
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((dia) => (
                  <tr key={dia.value} className="border-t">
                    <td className="p-3 font-medium">{dia.label}</td>
                    {(['manha', 'tarde', 'noite'] as const).map((periodo) => (
                      <td key={periodo} className="p-3">
                        <div className="flex flex-col items-center gap-2">
                          <Switch
                            checked={scheduleConfig[dia.value]?.[periodo]?.ativo ?? false}
                            onCheckedChange={(checked) => handlePeriodoChange(dia.value, periodo, 'ativo', checked)}
                          />
                          {scheduleConfig[dia.value]?.[periodo]?.ativo && (
                            <div className="flex items-center gap-1 text-sm">
                              <Input
                                type="time"
                                value={scheduleConfig[dia.value]?.[periodo]?.hora_inicio ?? ""}
                                onChange={(e) => handlePeriodoChange(dia.value, periodo, 'hora_inicio', e.target.value)}
                                className="w-24 h-8 text-xs"
                              />
                              <span>-</span>
                              <Input
                                type="time"
                                value={scheduleConfig[dia.value]?.[periodo]?.hora_fim ?? ""}
                                onChange={(e) => handlePeriodoChange(dia.value, periodo, 'hora_fim', e.target.value)}
                                className="w-24 h-8 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary and Save */}
        {selectedMedicoId && !loadingConfig && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {getActivePeriodsCount()} período(s) configurado(s)
            </div>
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Horários
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!selectedMedicoId && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma clínica e um médico para configurar os horários</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
