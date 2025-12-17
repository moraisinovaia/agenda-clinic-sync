import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  ChevronRight,
  Bell,
  BellOff
} from 'lucide-react';
import { ClinicHealthData, calculateHealthScore, HealthCheckItem } from '@/hooks/useClinicHealthScore';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  clinicId: string;
  clinicName: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
  checkId: string;
}

interface SmartAlertsCenterProps {
  clinics: ClinicHealthData[];
  onNavigateToClinic?: (clinicId: string, action?: string) => void;
  maxAlerts?: number;
}

export function SmartAlertsCenter({ 
  clinics, 
  onNavigateToClinic,
  maxAlerts = 10 
}: SmartAlertsCenterProps) {
  const alerts = useMemo(() => {
    const allAlerts: Alert[] = [];

    clinics.forEach(clinic => {
      const health = calculateHealthScore(clinic);
      
      // Add alerts for failed checks
      health.checks
        .filter(check => !check.passed)
        .forEach(check => {
          allAlerts.push({
            id: `${clinic.id}-${check.id}`,
            clinicId: clinic.id,
            clinicName: clinic.nome,
            type: check.severity,
            title: check.label,
            description: `${clinic.nome}: ${check.description}`,
            action: getActionForCheck(check.id),
            checkId: check.id
          });
        });
    });

    // Sort by severity: critical > warning > info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allAlerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

    return allAlerts.slice(0, maxAlerts);
  }, [clinics, maxAlerts]);

  const alertCounts = useMemo(() => ({
    critical: alerts.filter(a => a.type === 'critical').length,
    warning: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length
  }), [alerts]);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return 'border-l-destructive bg-destructive/5';
      case 'warning': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'info': return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Central de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="font-medium text-green-600">Tudo certo!</p>
            <p className="text-sm text-muted-foreground">
              Nenhum problema detectado nas clínicas
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Central de Alertas
          </CardTitle>
          <div className="flex items-center gap-2">
            {alertCounts.critical > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertCounts.critical} crítico{alertCounts.critical > 1 ? 's' : ''}
              </Badge>
            )}
            {alertCounts.warning > 0 && (
              <Badge className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                {alertCounts.warning} aviso{alertCounts.warning > 1 ? 's' : ''}
              </Badge>
            )}
            {alertCounts.info > 0 && (
              <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                {alertCounts.info} info
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4 pt-0">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border-l-4 transition-colors",
                  getAlertStyles(alert.type),
                  onNavigateToClinic && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => onNavigateToClinic?.(alert.clinicId, alert.action)}
              >
                <div className="mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {alert.description}
                  </p>
                </div>
                {onNavigateToClinic && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function getActionForCheck(checkId: string): string {
  const actions: Record<string, string> = {
    'has_doctors': 'doctors',
    'has_services': 'services',
    'has_contact': 'settings',
    'has_address': 'settings',
    'has_llm_config': 'llm',
    'has_business_rules': 'llm',
    'has_schedule_config': 'schedule',
    'has_users': 'users'
  };
  return actions[checkId] || 'settings';
}
