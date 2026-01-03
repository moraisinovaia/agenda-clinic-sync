import { useState, useEffect, useRef, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Clock, Calendar, Save, RotateCcw, Loader2, Building2, User, Users, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorarioConfig {
  id?: string;
  dia_semana: number;
  periodo: 'manha' | 'tarde' | 'noite';
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  limite_pacientes?: number | null;
}

interface PeriodoConfig {
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
  limite_pacientes: number | null;
}

interface DayConfig {
  manha: PeriodoConfig;
  tarde: PeriodoConfig;
  noite: PeriodoConfig;
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

const COMMON_INTERVALS = [10, 15, 20, 30, 45, 60];

const DEFAULT_DAY_CONFIG: DayConfig = {
  manha: { ativo: false, hora_inicio: "08:00", hora_fim: "12:00", limite_pacientes: null },
  tarde: { ativo: false, hora_inicio: "13:00", hora_fim: "18:00", limite_pacientes: null },
  noite: { ativo: false, hora_inicio: "18:00", hora_fim: "21:00", limite_pacientes: null },
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
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize default config
  useEffect(() => {
    const initialConfig: Record<number, DayConfig> = {};
    DIAS_SEMANA.forEach(dia => {
      initialConfig[dia.value] = { ...DEFAULT_DAY_CONFIG };
    });
    setScheduleConfig(initialConfig);
  }, []);
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

  // Filter doctors by search term
  const filteredMedicos = useMemo(() => {
    if (!medicos) return [];
    if (!searchTerm.trim()) return medicos;
    
    const normalizedSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return medicos.filter(m => {
      const nome = m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const especialidade = m.especialidade?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      return nome.includes(normalizedSearch) || especialidade.includes(normalizedSearch);
    });
  }, [medicos, searchTerm]);

  const selectedDoctor = useMemo(() => {
    return medicos?.find(m => m.id === selectedMedicoId);
  }, [medicos, selectedMedicoId]);

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
            limite_pacientes: config.limite_pacientes ?? null,
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
              limite_pacientes: periodoConfig.limite_pacientes,
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
          hora_fim: "12:00",
          limite_pacientes: null
        },
        tarde: { 
          ativo: isActiveDay && preset.config.tarde, 
          hora_inicio: "13:00", 
          hora_fim: "18:00",
          limite_pacientes: null
        },
        noite: { 
          ativo: isActiveDay && preset.config.noite, 
          hora_inicio: "18:00", 
          hora_fim: "21:00",
          limite_pacientes: null
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

          {/* Busca de Médico */}
          <div className="space-y-2" ref={dropdownRef}>
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Médico
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={loadingMedicos ? "Carregando..." : "Buscar médico por nome ou especialidade..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                className="pl-10 pr-10"
                disabled={!selectedClinicId || loadingMedicos}
              />
              {(searchTerm || selectedMedicoId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedMedicoId("");
                    setIsDropdownOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Dropdown de resultados */}
            {isDropdownOpen && selectedClinicId && !loadingMedicos && (
              <Card className="absolute z-50 w-full max-w-md mt-1 max-h-64 overflow-y-auto shadow-lg border bg-popover">
                {filteredMedicos.length > 0 ? (
                  <div className="py-1">
                    {filteredMedicos.map(m => (
                      <div
                        key={m.id}
                        className={cn(
                          "px-4 py-2 cursor-pointer hover:bg-accent transition-colors",
                          selectedMedicoId === m.id && "bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedMedicoId(m.id);
                          setSearchTerm("");
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="font-medium text-foreground">{m.nome}</div>
                        <div className="text-sm text-muted-foreground">{m.especialidade}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-center text-muted-foreground">
                    Nenhum médico encontrado
                  </div>
                )}
              </Card>
            )}
            
            {/* Badge do médico selecionado */}
            {selectedDoctor && (
              <Badge variant="secondary" className="mt-2">
                {selectedDoctor.nome} - {selectedDoctor.especialidade}
              </Badge>
            )}
          </div>

          {/* Intervalo personalizado */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Intervalo (minutos)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={180}
                value={intervaloMinutos}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 15;
                  setIntervaloMinutos(Math.min(180, Math.max(1, value)));
                  setHasChanges(true);
                }}
                className="w-20"
                placeholder="15"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            
            {/* Botões de atalho */}
            <div className="flex flex-wrap gap-1">
              {COMMON_INTERVALS.map(v => (
                <Button
                  key={v}
                  variant={intervaloMinutos === v ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setIntervaloMinutos(v); setHasChanges(true); }}
                >
                  {v}min
                </Button>
              ))}
            </div>
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
                            <>
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
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <Input
                                        type="number"
                                        min="1"
                                        max="50"
                                        placeholder="∞"
                                        value={scheduleConfig[dia.value]?.[periodo]?.limite_pacientes ?? ""}
                                        onChange={(e) => handlePeriodoChange(
                                          dia.value, 
                                          periodo, 
                                          'limite_pacientes', 
                                          e.target.value ? parseInt(e.target.value) : null
                                        )}
                                        className="w-16 h-7 text-xs text-center"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Limite de pacientes (deixe vazio para ilimitado)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
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
