import { 
  Calendar, 
  CalendarPlus, 
  List, 
  X, 
  FileText, 
  Clock, 
  BarChart3, 
  Ban, 
  Bell, 
  Shield, 
  MessageCircle,
  Search 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface DashboardActionsProps {
  onDashboardAction: (action: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export const DashboardActions = ({ onDashboardAction, searchTerm, onSearchChange }: DashboardActionsProps) => {
  const actionButtons = [
    {
      label: "Novo Agendamento",
      icon: Calendar,
      action: "new-appointment",
      color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      label: "Múltiplos Exames",
      icon: CalendarPlus,
      action: "multiple-appointment",
      color: "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200",
    },
    {
      label: "Ver Todos os Agendamentos",
      icon: List,
      action: "appointments-list",
      color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
    },
    {
      label: "Ver Cancelados",
      icon: X,
      action: "canceled-appointments",
      color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200",
    },
    {
      label: "Preparos de Exames",
      icon: FileText,
      action: "preparos",
      color: "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200",
    },
    {
      label: "Fila de Espera",
      icon: Clock,
      action: "fila-espera",
      color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    {
      label: "Relatório de Agenda",
      icon: BarChart3,
      action: "relatorio-agenda",
      color: "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    {
      label: "Bloquear Agenda",
      icon: Ban,
      action: "bloqueio-agenda",
      color: "bg-red-100 hover:bg-red-200 text-red-800 border-red-300",
      priority: true,
    },
    {
      label: "Sistema de Alertas",
      icon: Bell,
      action: "sistema-alertas",
      color: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200",
    },
    {
      label: "Teste de Autenticação",
      icon: Shield,
      action: "teste-auth",
      color: "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200",
    },
    {
      label: "Agente WhatsApp",
      icon: MessageCircle,
      action: "whatsapp-agent",
      color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Campo de busca */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do médico..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Botões de ação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {actionButtons.map((button, index) => (
          <Button
            key={index}
            variant="outline"
            onClick={() => onDashboardAction(button.action)}
            className={`h-20 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 ${button.color} ${
              button.priority ? 'ring-2 ring-red-200' : ''
            }`}
          >
            <button.icon className="h-5 w-5" />
            <span className="text-sm font-medium leading-tight">
              {button.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};