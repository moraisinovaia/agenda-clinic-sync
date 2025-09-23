import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight, Check, Building2, User, Stethoscope, ClipboardList, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface OnboardingData {
  clinica: {
    nome: string;
    logo_url: string;
    configuracoes: any;
  };
  admin: {
    nome: string;
    email: string;
    password: string;
    username: string;
  };
  especialidades: string[];
  atendimentos_customizados: any[];
}

const ESPECIALIDADES_TEMPLATES = {
  "Cardiologia": {
    medicos_padrao: ["Dr. João Cardoso"],
    atendimentos: ["Consulta Cardiológica", "Ecocardiograma", "ECG", "Teste Ergométrico"]
  },
  "Gastroenterologia": {
    medicos_padrao: ["Dr. Maria Santos"],
    atendimentos: ["Consulta Gastroenterológica", "Endoscopia", "Colonoscopia", "Ultrassom Abdominal"]
  },
  "Dermatologia": {
    medicos_padrao: ["Dra. Ana Silva"],
    atendimentos: ["Consulta Dermatológica", "Biópsia", "Cauterização", "Dermatoscopia"]
  },
  "Ortopedia": {
    medicos_padrao: ["Dr. Carlos Mendes"],
    atendimentos: ["Consulta Ortopédica", "Raio-X", "Infiltração", "Fisioterapia"]
  },
  "Pediatria": {
    medicos_padrao: ["Dra. Lucia Oliveira"],
    atendimentos: ["Consulta Pediátrica", "Puericultura", "Vacinação", "Teste do Pezinho"]
  },
  "Ginecologia": {
    medicos_padrao: ["Dra. Fernanda Lima"],
    atendimentos: ["Consulta Ginecológica", "Preventivo", "Ultrassom Pélvico", "Colposcopia"]
  },
  "Neurologia": {
    medicos_padrao: ["Dr. Roberto Alves"],
    atendimentos: ["Consulta Neurológica", "Eletroencefalograma", "Eletromiografia", "Doppler Transcraniano"]
  },
  "Oftalmologia": {
    medicos_padrao: ["Dr. Paulo Costa"],
    atendimentos: ["Consulta Oftalmológica", "Exame de Vista", "Tonometria", "Fundo de Olho"]
  }
};

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [data, setData] = useState<OnboardingData>({
    clinica: {
      nome: '',
      logo_url: '',
      configuracoes: {
        horario_funcionamento: { inicio: '08:00', fim: '18:00' },
        dias_funcionamento: ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
      }
    },
    admin: {
      nome: '',
      email: '',
      password: '',
      username: ''
    },
    especialidades: [],
    atendimentos_customizados: []
  });

  const steps = [
    { id: 1, title: 'Dados da Clínica', icon: Building2 },
    { id: 2, title: 'Administrador', icon: User },
    { id: 3, title: 'Especialidades', icon: Stethoscope },
    { id: 4, title: 'Atendimentos', icon: ClipboardList },
    { id: 5, title: 'Confirmação', icon: CheckCircle }
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('onboarding-clinica', {
        body: data
      });

      if (error) throw error;

      if (result.success) {
        toast({
          title: "Clínica criada com sucesso!",
          description: "Você será redirecionado para fazer login.",
        });
        navigate('/auth');
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar clínica",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.clinica.nome.length >= 3;
      case 2:
        return data.admin.nome && data.admin.email && data.admin.password.length >= 6;
      case 3:
        return data.especialidades.length > 0;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome-clinica">Nome da Clínica</Label>
              <Input
                id="nome-clinica"
                placeholder="Ex: Clínica São Lucas"
                value={data.clinica.nome}
                onChange={(e) => setData({
                  ...data,
                  clinica: { ...data.clinica, nome: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="logo-url">URL do Logo (opcional)</Label>
              <Input
                id="logo-url"
                placeholder="https://exemplo.com/logo.png"
                value={data.clinica.logo_url}
                onChange={(e) => setData({
                  ...data,
                  clinica: { ...data.clinica, logo_url: e.target.value }
                })}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-nome">Nome Completo</Label>
              <Input
                id="admin-nome"
                placeholder="João Silva"
                value={data.admin.nome}
                onChange={(e) => setData({
                  ...data,
                  admin: { ...data.admin, nome: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@clinica.com"
                value={data.admin.email}
                onChange={(e) => setData({
                  ...data,
                  admin: { 
                    ...data.admin, 
                    email: e.target.value,
                    username: e.target.value.split('@')[0]
                  }
                })}
              />
            </div>
            <div>
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={data.admin.password}
                onChange={(e) => setData({
                  ...data,
                  admin: { ...data.admin, password: e.target.value }
                })}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione as especialidades da sua clínica. Médicos e atendimentos padrão serão criados automaticamente.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(ESPECIALIDADES_TEMPLATES).map(([especialidade, template]) => (
                <Card 
                  key={especialidade} 
                  className={`cursor-pointer transition-colors ${
                    data.especialidades.includes(especialidade) 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    const isSelected = data.especialidades.includes(especialidade);
                    setData({
                      ...data,
                      especialidades: isSelected
                        ? data.especialidades.filter(e => e !== especialidade)
                        : [...data.especialidades, especialidade]
                    });
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{especialidade}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.atendimentos.length} atendimentos padrão
                        </p>
                      </div>
                      <Checkbox 
                        checked={data.especialidades.includes(especialidade)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Baseado nas especialidades selecionadas, os seguintes médicos e atendimentos serão criados:
            </p>
            {data.especialidades.map(especialidade => {
              const template = ESPECIALIDADES_TEMPLATES[especialidade];
              return (
                <Card key={especialidade}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{especialidade}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Médico:</p>
                      <p className="text-sm">{template.medicos_padrao[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Atendimentos:</p>
                      <p className="text-sm">{template.atendimentos.join(', ')}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <p className="text-xs text-muted-foreground mt-4">
              Estes dados podem ser editados posteriormente no painel administrativo.
            </p>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Tudo pronto!</h2>
              <p className="text-muted-foreground">
                Sua clínica será criada com {data.especialidades.length} especialidade(s) e todos os dados necessários.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Clínica:</span>
                  <span>{data.clinica.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Administrador:</span>
                  <span>{data.admin.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Email:</span>
                  <span>{data.admin.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Especialidades:</span>
                  <span>{data.especialidades.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <h2 className="text-lg font-semibold mb-2">Criando sua clínica...</h2>
            <p className="text-sm text-muted-foreground">
              Isso pode levar alguns segundos. Por favor, aguarde.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold mb-2">Criar Nova Clínica</h1>
          <p className="text-muted-foreground">
            Configure sua clínica em poucos passos simples
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors
                    ${isActive ? 'bg-primary text-primary-foreground' : ''}
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs text-center ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                  
                  {index < steps.length - 1 && (
                    <div className={`absolute h-px bg-border w-full top-5 left-1/2 transform translate-x-1/2 z-[-1]`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          
          {currentStep < 5 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Criar Clínica
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}