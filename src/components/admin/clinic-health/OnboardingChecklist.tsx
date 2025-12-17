import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  ChevronRight,
  Rocket,
  Building2,
  UserPlus,
  Stethoscope,
  Settings,
  Zap,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { ClinicHealthData, calculateHealthScore, HealthCheckItem } from '@/hooks/useClinicHealthScore';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  checks: string[];
  action?: string;
  priority: number;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'basic_info',
    title: 'Informações Básicas',
    description: 'Configure nome, endereço e contato da clínica',
    icon: <Building2 className="h-5 w-5" />,
    checks: ['has_contact', 'has_address', 'is_active'],
    action: 'settings',
    priority: 1
  },
  {
    id: 'doctors',
    title: 'Cadastrar Médicos',
    description: 'Adicione os profissionais que atenderão',
    icon: <Stethoscope className="h-5 w-5" />,
    checks: ['has_doctors'],
    action: 'doctors',
    priority: 2
  },
  {
    id: 'services',
    title: 'Configurar Serviços',
    description: 'Defina consultas, exames e procedimentos',
    icon: <Settings className="h-5 w-5" />,
    checks: ['has_services'],
    action: 'services',
    priority: 3
  },
  {
    id: 'schedule',
    title: 'Horários de Atendimento',
    description: 'Configure a agenda de cada médico',
    icon: <Calendar className="h-5 w-5" />,
    checks: ['has_schedule_config'],
    action: 'schedule',
    priority: 4
  },
  {
    id: 'users',
    title: 'Equipe de Usuários',
    description: 'Adicione recepcionistas e administradores',
    icon: <UserPlus className="h-5 w-5" />,
    checks: ['has_users'],
    action: 'users',
    priority: 5
  },
  {
    id: 'integrations',
    title: 'Integrações & IA',
    description: 'Configure LLM API e regras de negócio',
    icon: <Zap className="h-5 w-5" />,
    checks: ['has_llm_config', 'has_business_rules'],
    action: 'llm',
    priority: 6
  }
];

interface OnboardingChecklistProps {
  clinic: ClinicHealthData;
  onNavigateToAction?: (action: string) => void;
  compact?: boolean;
}

export function OnboardingChecklist({ 
  clinic, 
  onNavigateToAction,
  compact = false 
}: OnboardingChecklistProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const health = calculateHealthScore(clinic);

  const stepsWithStatus = ONBOARDING_STEPS.map(step => {
    const relatedChecks = health.checks.filter(c => step.checks.includes(c.id));
    const passedChecks = relatedChecks.filter(c => c.passed);
    const isComplete = passedChecks.length === relatedChecks.length;
    const progress = relatedChecks.length > 0 
      ? Math.round((passedChecks.length / relatedChecks.length) * 100)
      : 100;

    return {
      ...step,
      relatedChecks,
      passedChecks,
      isComplete,
      progress
    };
  });

  const completedSteps = stepsWithStatus.filter(s => s.isComplete).length;
  const totalSteps = stepsWithStatus.length;
  const overallProgress = Math.round((completedSteps / totalSteps) * 100);

  // Find first incomplete step
  const nextStep = stepsWithStatus.find(s => !s.isComplete);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Onboarding</span>
          <Badge variant={overallProgress === 100 ? "default" : "secondary"}>
            {completedSteps}/{totalSteps}
          </Badge>
        </div>
        <Progress value={overallProgress} className="h-2" />
        {nextStep && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => onNavigateToAction?.(nextStep.action || '')}
          >
            <span className="truncate">Próximo: {nextStep.title}</span>
            <ChevronRight className="h-4 w-4 ml-auto shrink-0" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Checklist de Onboarding</CardTitle>
          </div>
          <Badge 
            variant={overallProgress === 100 ? "default" : "outline"}
            className={cn(
              overallProgress === 100 && "bg-green-500"
            )}
          >
            {overallProgress}% completo
          </Badge>
        </div>
        <CardDescription>
          Configure sua clínica em {totalSteps} passos simples
        </CardDescription>
        <Progress value={overallProgress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {stepsWithStatus.map((step, index) => (
          <Collapsible
            key={step.id}
            open={expandedStep === step.id}
            onOpenChange={(open) => setExpandedStep(open ? step.id : null)}
          >
            <CollapsibleTrigger asChild>
              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  step.isComplete 
                    ? "bg-green-500/5 hover:bg-green-500/10" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                  step.isComplete 
                    ? "bg-green-500 text-white" 
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {step.isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm",
                      step.isComplete && "text-green-600"
                    )}>
                      {step.title}
                    </span>
                    {!step.isComplete && step.progress > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {step.progress}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                  expandedStep === step.id && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-14 pr-3 pb-3 space-y-2">
                {step.relatedChecks.map(check => (
                  <div 
                    key={check.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={cn(
                      check.passed 
                        ? "text-muted-foreground line-through" 
                        : "text-foreground"
                    )}>
                      {check.label}
                    </span>
                  </div>
                ))}
                {!step.isComplete && step.action && (
                  <Button 
                    size="sm" 
                    className="mt-2"
                    onClick={() => onNavigateToAction?.(step.action || '')}
                  >
                    Configurar
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
