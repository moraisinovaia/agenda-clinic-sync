# Pacote de Migração - Formulário Cadastro de Médicos

Este documento contém todos os arquivos necessários para criar um novo projeto Lovable dedicado ao cadastro de médicos.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│  NOVO PROJETO LOVABLE (cadastro-medicos.lovable.app)                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Página Principal: /:clinicaId                              │   │
│  │  - DoctorOnboardingForm                                     │   │
│  │  - useDoctorOnboardingForm (adaptado)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│            fetch() para Edge Function                               │
└────────────────────────────────────│────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SUPABASE (qxlvzbvzajibdtlzngdy)                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Edge Function: doctor-onboarding (PÚBLICA)                 │   │
│  │  - Recebe dados do formulário                               │   │
│  │  - Usa service_role para bypass RLS                         │   │
│  │  - Insere em: medicos, atendimentos, business_rules, preparos│  │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Banco de Dados PostgreSQL                                  │   │
│  │  - Tabelas: medicos, atendimentos, business_rules, preparos │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Passo a Passo

### 1. Criar Novo Projeto Lovable
- Acesse lovable.dev e crie um novo projeto
- Nome sugerido: "Cadastro Médicos InovaIA"

### 2. Conectar ao Mesmo Supabase
- No novo projeto, vá em Settings > Supabase
- Conecte ao projeto existente usando:
  - Project URL: `https://qxlvzbvzajibdtlzngdy.supabase.co`
  - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. Instalar Componentes shadcn/ui
Cole no chat do novo projeto:
```
Instalar os seguintes componentes shadcn: button, input, label, select, switch, checkbox, textarea, card, accordion, badge, progress, radio-group, sonner
```

### 4. Copiar Arquivos
Copie os arquivos listados abaixo para o novo projeto.

### 5. Links por Clínica

| Clínica | Link |
|---------|------|
| IPADO | `https://seu-projeto.lovable.app/2bfb98b5-ae41-4a9f-8a3c-c47b95abab98` |
| ENDOGASTRO | `https://seu-projeto.lovable.app/39e120b4-5fb7-4ab7-a9df-e1af0f69f053` |
| Clínica Vênus | `https://seu-projeto.lovable.app/20747f3c-8fa1-4e5e-9a69-c9a69b09ecf4` |

---

## Arquivos para Copiar

### 1. `src/types/doctor-onboarding.ts`

```typescript
// Types for the complete doctor onboarding form

export interface PeriodoConfig {
  ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  limite_pacientes: number;
  // Campos específicos para "ordem de chegada"
  horario_inicio_medico?: string;
  horario_distribuicao_fichas?: string;
}

export interface ServicoConfig {
  id?: string;
  nome: string;
  tipo: 'exame' | 'consulta' | 'procedimento';
  permite_online: boolean;
  mensagem_personalizada?: string;
  dias_atendimento: number[]; // 0-6 (domingo-sábado)
  periodos: {
    manha: PeriodoConfig;
    tarde: PeriodoConfig;
    noite: PeriodoConfig;
  };
}

export interface PreparoConfig {
  id?: string;
  nome: string;
  exame: string;
  jejum_horas: number | null;
  restricoes_alimentares: string;
  medicacao_suspender: string;
  dias_suspensao: number | null;
  itens_levar: string;
  valor_particular: number | null;
  valor_convenio: number | null;
  forma_pagamento: string;
  observacoes_especiais: string;
}

export interface DoctorOnboardingFormData {
  // Seção 1: Dados Básicos
  nome: string;
  especialidade: string;
  ativo: boolean;
  
  // Seção 2: Restrições de Idade
  idade_minima: number | null;
  idade_maxima: number | null;
  atende_criancas: boolean;
  atende_adultos: boolean;
  
  // Seção 3: Convênios
  convenios_aceitos: string[];
  convenio_personalizado: string;
  convenios_restricoes: Record<string, string>;
  
  // Seção 4: Tipo de Agendamento
  tipo_agendamento: 'ordem_chegada' | 'hora_marcada';
  permite_agendamento_online: boolean;
  
  // Seção 5: Serviços/Atendimentos
  servicos: ServicoConfig[];
  
  // Seção 6: Observações
  observacoes_gerais: string;
  regras_especiais: string;
  restricoes_gerais: string;
  
  // Seção 7: Preparos (para exames)
  preparos: PreparoConfig[];
}

export const CONVENIOS_PADRAO = [
  'PARTICULAR',
  'UNIMED',
  'UNIMED 20%',
  'UNIMED 40%',
  'BRADESCO',
  'SULAMERICA',
  'AMIL',
  'HAPVIDA',
  'NOTREDAME',
  'CASSI',
  'GEAP',
  'IPSEMG',
  'PLANSERV',
] as const;

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
] as const;

export const TIPOS_SERVICO = [
  { value: 'exame', label: 'Exame' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'procedimento', label: 'Procedimento' },
] as const;

export const initialPeriodoConfig: PeriodoConfig = {
  ativo: false,
  horario_inicio: '08:00',
  horario_fim: '12:00',
  limite_pacientes: 10,
};

export const initialServicoConfig: ServicoConfig = {
  nome: '',
  tipo: 'consulta',
  permite_online: true,
  mensagem_personalizada: '',
  dias_atendimento: [1, 2, 3, 4, 5], // Segunda a sexta por padrão
  periodos: {
    manha: { ...initialPeriodoConfig, ativo: true },
    tarde: { ...initialPeriodoConfig, ativo: false, horario_inicio: '14:00', horario_fim: '18:00' },
    noite: { ...initialPeriodoConfig, ativo: false, horario_inicio: '18:00', horario_fim: '21:00' },
  },
};

export const initialPreparoConfig: PreparoConfig = {
  nome: '',
  exame: '',
  jejum_horas: null,
  restricoes_alimentares: '',
  medicacao_suspender: '',
  dias_suspensao: null,
  itens_levar: '',
  valor_particular: null,
  valor_convenio: null,
  forma_pagamento: '',
  observacoes_especiais: '',
};

export const initialDoctorFormData: DoctorOnboardingFormData = {
  nome: '',
  especialidade: '',
  ativo: true,
  idade_minima: 0,
  idade_maxima: null,
  atende_criancas: true,
  atende_adultos: true,
  convenios_aceitos: [],
  convenio_personalizado: '',
  convenios_restricoes: {},
  tipo_agendamento: 'ordem_chegada',
  permite_agendamento_online: true,
  servicos: [],
  observacoes_gerais: '',
  regras_especiais: '',
  restricoes_gerais: '',
  preparos: [],
};
```

---

### 2. `src/hooks/useDoctorOnboardingForm.ts` (ADAPTADO)

```typescript
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  DoctorOnboardingFormData,
  ServicoConfig,
  PreparoConfig,
  initialDoctorFormData,
  initialServicoConfig,
  initialPreparoConfig,
} from '@/types/doctor-onboarding';

// URL fixa do Supabase
const SUPABASE_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co';

interface UseDoctorOnboardingFormProps {
  clienteId: string;
  onSuccess?: () => void;
}

export function useDoctorOnboardingForm({ clienteId, onSuccess }: UseDoctorOnboardingFormProps) {
  const [formData, setFormData] = useState<DoctorOnboardingFormData>(initialDoctorFormData);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 7;

  // Update a specific field
  const updateField = useCallback(<K extends keyof DoctorOnboardingFormData>(
    field: K,
    value: DoctorOnboardingFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Add a new service
  const addServico = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      servicos: [...prev.servicos, { ...initialServicoConfig }],
    }));
  }, []);

  // Update a specific service
  const updateServico = useCallback((index: number, servico: ServicoConfig) => {
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.map((s, i) => i === index ? servico : s),
    }));
  }, []);

  // Remove a service
  const removeServico = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== index),
    }));
  }, []);

  // Add a new preparo
  const addPreparo = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      preparos: [...prev.preparos, { ...initialPreparoConfig }],
    }));
  }, []);

  // Update a specific preparo
  const updatePreparo = useCallback((index: number, preparo: PreparoConfig) => {
    setFormData(prev => ({
      ...prev,
      preparos: prev.preparos.map((p, i) => i === index ? preparo : p),
    }));
  }, []);

  // Remove a preparo
  const removePreparo = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      preparos: prev.preparos.filter((_, i) => i !== index),
    }));
  }, []);

  // Toggle convenio
  const toggleConvenio = useCallback((convenio: string) => {
    setFormData(prev => ({
      ...prev,
      convenios_aceitos: prev.convenios_aceitos.includes(convenio)
        ? prev.convenios_aceitos.filter(c => c !== convenio)
        : [...prev.convenios_aceitos, convenio],
    }));
  }, []);

  // Validate current step
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
        if (!formData.especialidade.trim()) newErrors.especialidade = 'Especialidade é obrigatória';
        break;
      case 1:
        if (formData.idade_minima !== null && formData.idade_maxima !== null) {
          if (formData.idade_minima > formData.idade_maxima) {
            newErrors.idade_minima = 'Idade mínima não pode ser maior que a máxima';
          }
        }
        break;
      case 4:
        if (formData.servicos.length === 0) {
          newErrors.servicos = 'Adicione pelo menos um serviço';
        } else {
          formData.servicos.forEach((servico, index) => {
            if (!servico.nome.trim()) {
              newErrors[`servico_${index}_nome`] = 'Nome do serviço é obrigatório';
            }
            if (servico.dias_atendimento.length === 0) {
              newErrors[`servico_${index}_dias`] = 'Selecione pelo menos um dia de atendimento';
            }
          });
        }
        break;
      case 6:
        formData.preparos.forEach((preparo, index) => {
          if (preparo.nome && !preparo.exame) {
            newErrors[`preparo_${index}_exame`] = 'Selecione o exame relacionado';
          }
        });
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Navigation
  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    }
  }, [currentStep, validateStep, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  const resetForm = useCallback(() => {
    setFormData(initialDoctorFormData);
    setCurrentStep(0);
    setErrors({});
  }, []);

  // Submit via Edge Function
  const submitForm = useCallback(async () => {
    if (!clienteId) {
      toast.error('Clínica não identificada');
      return false;
    }

    // Validate all steps
    for (let i = 0; i <= currentStep; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        toast.error('Por favor, corrija os erros antes de continuar');
        return false;
      }
    }

    setIsSubmitting(true);

    try {
      const conveniosFinal = [
        ...formData.convenios_aceitos,
        ...(formData.convenio_personalizado.trim() 
          ? formData.convenio_personalizado.split(',').map(c => c.trim().toUpperCase())
          : []
        ),
      ];

      const payload = {
        cliente_id: clienteId,
        nome: formData.nome,
        especialidade: formData.especialidade,
        ativo: formData.ativo,
        idade_minima: formData.idade_minima,
        idade_maxima: formData.idade_maxima,
        atende_criancas: formData.atende_criancas,
        atende_adultos: formData.atende_adultos,
        convenios_aceitos: conveniosFinal,
        convenios_restricoes: formData.convenios_restricoes,
        tipo_agendamento: formData.tipo_agendamento,
        permite_agendamento_online: formData.permite_agendamento_online,
        servicos: formData.servicos.map(s => ({
          nome: s.nome,
          tipo: s.tipo,
          disponivel_online: s.permite_online,
          mensagem_personalizada: s.mensagem_personalizada || '',
          dias_atendimento: s.dias_atendimento.map(d => 
            ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][d]
          ),
          periodos: {
            manha: {
              ativo: s.periodos.manha.ativo,
              hora_inicio: s.periodos.manha.horario_inicio,
              hora_fim: s.periodos.manha.horario_fim,
              limite_pacientes: s.periodos.manha.limite_pacientes,
              hora_inicio_medico: s.periodos.manha.horario_inicio_medico,
              hora_distribuicao_fichas: s.periodos.manha.horario_distribuicao_fichas,
            },
            tarde: {
              ativo: s.periodos.tarde.ativo,
              hora_inicio: s.periodos.tarde.horario_inicio,
              hora_fim: s.periodos.tarde.horario_fim,
              limite_pacientes: s.periodos.tarde.limite_pacientes,
              hora_inicio_medico: s.periodos.tarde.horario_inicio_medico,
              hora_distribuicao_fichas: s.periodos.tarde.horario_distribuicao_fichas,
            },
            noite: {
              ativo: s.periodos.noite.ativo,
              hora_inicio: s.periodos.noite.horario_inicio,
              hora_fim: s.periodos.noite.horario_fim,
              limite_pacientes: s.periodos.noite.limite_pacientes,
              hora_inicio_medico: s.periodos.noite.horario_inicio_medico,
              hora_distribuicao_fichas: s.periodos.noite.horario_distribuicao_fichas,
            },
          },
        })),
        observacoes_gerais: formData.observacoes_gerais,
        regras_especiais: formData.regras_especiais,
        restricoes_gerais: formData.restricoes_gerais,
        preparos: formData.preparos.map(p => ({
          nome: p.nome,
          exame_relacionado: p.exame,
          jejum_horas: p.jejum_horas || 0,
          restricoes_alimentares: p.restricoes_alimentares,
          medicacao_suspender: p.medicacao_suspender,
          dias_suspensao: p.dias_suspensao || 0,
          itens_levar: p.itens_levar,
          valor_particular: p.valor_particular || 0,
          valor_convenio: p.valor_convenio || 0,
          formas_pagamento: p.forma_pagamento ? p.forma_pagamento.split(',').map(f => f.trim()) : [],
          observacoes_especiais: p.observacoes_especiais,
        })),
      };

      console.log('Enviando para Edge Function:', payload);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/doctor-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao cadastrar médico');
      }

      console.log('Resposta:', result);
      toast.success(`Médico ${result.nome} cadastrado com sucesso!`);
      resetForm();
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('Erro ao salvar médico:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar médico');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [clienteId, formData, currentStep, validateStep, resetForm, onSuccess]);

  return {
    formData,
    currentStep,
    totalSteps,
    isSubmitting,
    errors,
    updateField,
    addServico,
    updateServico,
    removeServico,
    addPreparo,
    updatePreparo,
    removePreparo,
    toggleConvenio,
    nextStep,
    prevStep,
    goToStep,
    resetForm,
    submitForm,
    validateStep,
  };
}
```

---

### 3. Componentes (copiar sem alterações)

Os seguintes componentes devem ser copiados **exatamente como estão** para `src/components/doctor-onboarding/`:

- `BasicInfoSection.tsx`
- `AgeRestrictionsSection.tsx`
- `ConveniosSection.tsx`
- `SchedulingTypeSection.tsx`
- `ServicesSection.tsx`
- `ObservationsSection.tsx`
- `PreparosSection.tsx`
- `DoctorOnboardingForm.tsx`
- `index.ts`

---

### 4. `src/pages/DoctorOnboarding.tsx` (NOVA PÁGINA)

```typescript
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DoctorOnboardingForm } from '@/components/doctor-onboarding/DoctorOnboardingForm';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Stethoscope, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8';

interface Clinica {
  id: string;
  nome: string;
  logo_url?: string;
}

export default function DoctorOnboarding() {
  const { clinicaId } = useParams<{ clinicaId: string }>();
  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchClinica() {
      if (!clinicaId) {
        setError('ID da clínica não informado');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/clientes?id=eq.${clinicaId}&select=id,nome,logo_url`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        const data = await response.json();
        
        if (data.length === 0) {
          setError('Clínica não encontrada');
        } else {
          setClinica(data[0]);
        }
      } catch (err) {
        console.error('Erro ao buscar clínica:', err);
        setError('Erro ao carregar dados da clínica');
      } finally {
        setLoading(false);
      }
    }

    fetchClinica();
  }, [clinicaId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Verifique se o link está correto e tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Cadastro Realizado!</h2>
            <p className="text-muted-foreground mb-6">
              O médico foi cadastrado com sucesso na clínica {clinica?.nome}.
            </p>
            <Button onClick={() => setSuccess(false)} variant="outline">
              Cadastrar Outro Médico
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {clinica?.logo_url && (
            <img 
              src={clinica.logo_url} 
              alt={clinica.nome} 
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold mb-2">Cadastro de Médico</h1>
          <p className="text-muted-foreground">
            {clinica?.nome}
          </p>
        </div>

        {/* Form */}
        <DoctorOnboardingForm
          clienteId={clinicaId || null}
          onSuccess={() => setSuccess(true)}
        />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by InovaIA</p>
        </div>
      </div>
    </div>
  );
}
```

---

### 5. `src/App.tsx` (exemplo)

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import DoctorOnboarding from '@/pages/DoctorOnboarding';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:clinicaId" element={<DoctorOnboarding />} />
        <Route path="/" element={
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-muted-foreground">
              Acesse usando o link da sua clínica.
            </p>
          </div>
        } />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
```

---

## Resumo de Dependências

```json
{
  "dependencies": {
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-checkbox": "^1.1.1",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-switch": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.462.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.2",
    "tailwindcss-animate": "^1.0.7"
  }
}
```
