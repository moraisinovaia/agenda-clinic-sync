import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Settings, 
  Zap, 
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Users,
  Stethoscope,
  Calendar
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClinicHealthData, calculateHealthScore } from '@/hooks/useClinicHealthScore';
import { ClinicHealthScoreGauge } from './ClinicHealthScoreGauge';
import { cn } from '@/lib/utils';

interface EnhancedClinicCardProps {
  clinic: ClinicHealthData;
  onManage?: () => void;
  onConfigureLLM?: () => void;
}

export function EnhancedClinicCard({ 
  clinic, 
  onManage, 
  onConfigureLLM 
}: EnhancedClinicCardProps) {
  const health = calculateHealthScore(clinic);
  
  const getStatusBadge = () => {
    if (health.criticalIssues.length > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {health.criticalIssues.length} crítico{health.criticalIssues.length > 1 ? 's' : ''}
        </Badge>
      );
    }
    if (health.warnings.length > 0) {
      return (
        <Badge className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {health.warnings.length} aviso{health.warnings.length > 1 ? 's' : ''}
        </Badge>
      );
    }
    return (
      <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Saudável
      </Badge>
    );
  };

  return (
    <Card className={cn(
      "hover:shadow-lg transition-all duration-200 group relative overflow-hidden",
      health.grade === 'A' && "border-green-500/30",
      health.grade === 'F' && "border-destructive/30"
    )}>
      {/* Gradient accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: health.color }}
      />
      
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {clinic.nome}
            </CardTitle>
            <CardDescription className="text-xs">
              Desde {format(parseISO(clinic.created_at || new Date().toISOString()), 'MMM yyyy', { locale: ptBR })}
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ClinicHealthScoreGauge health={health} size="sm" showLabel={false} />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-medium">Health Score: {health.score}/100 ({health.grade})</p>
                  <p className="text-xs text-muted-foreground">
                    {health.passedCount} de {health.totalCount} verificações passaram
                  </p>
                  <div className="text-xs space-y-1 border-t pt-2">
                    <p>{clinic.services_count ?? 0} serviços • {clinic.schedule_count ?? 0} horários config.</p>
                    <p>{clinic.future_appointments} futuros • {clinic.last_30_days_count ?? 0} em 30 dias</p>
                  </div>
                  {health.criticalIssues.length > 0 && (
                    <div className="text-xs text-destructive border-t pt-2">
                      Problemas críticos: {health.criticalIssues.map(i => i.label).join(', ')}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {getStatusBadge()}
          {clinic.has_llm_config ? (
            <Badge variant="outline" className="text-xs bg-primary/5">
              <Zap className="h-3 w-3 mr-1" />
              LLM
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Zap className="h-3 w-3 mr-1" />
              Sem LLM
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-3">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Stethoscope className="h-3 w-3" />
            </div>
            <p className="text-lg font-bold">{clinic.doctors_count}</p>
            <p className="text-[10px] text-muted-foreground">Médicos</p>
          </div>
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
            </div>
            <p className="text-lg font-bold">{clinic.patients_count.toLocaleString('pt-BR')}</p>
            <p className="text-[10px] text-muted-foreground">Pacientes</p>
          </div>
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
            </div>
            <p className="text-lg font-bold text-primary">{clinic.today_appointments}</p>
            <p className="text-[10px] text-muted-foreground">Hoje</p>
          </div>
        </div>

        {/* Additional stats row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 px-1">
          <span>{clinic.services_count ?? 0} serviço{(clinic.services_count ?? 0) !== 1 ? 's' : ''}</span>
          <span className={cn(
            (clinic.last_7_days_count ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'
          )}>
            {clinic.last_7_days_count ?? 0} agend. 7d
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={onManage}
          >
            <Settings className="h-3 w-3 mr-1" />
            Gerenciar
          </Button>
          <Button 
            variant={clinic.has_llm_config ? "outline" : "default"}
            size="sm" 
            className="flex-1 text-xs"
            onClick={onConfigureLLM}
          >
            <Zap className="h-3 w-3 mr-1" />
            {clinic.has_llm_config ? 'Config LLM' : 'Ativar LLM'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
