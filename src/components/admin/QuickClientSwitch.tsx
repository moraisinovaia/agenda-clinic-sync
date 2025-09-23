import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface ClientData {
  id: string;
  nome: string;
  ativo: boolean;
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    totalAppointments: number;
    activeDoctors: number;
    totalPatients: number;
  };
}

interface QuickClientSwitchProps {
  selectedClient: string | null;
  onClientChange: (clientId: string | null) => void;
  clients: ClientData[];
}

export const QuickClientSwitch = ({ 
  selectedClient, 
  onClientChange, 
  clients 
}: QuickClientSwitchProps) => {
  const selectedClientData = clients.find(c => c.id === selectedClient);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {selectedClientData ? selectedClientData.nome : 'Todos os Clientes'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuItem onClick={() => onClientChange(null)}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Todos os Clientes</span>
            </div>
            {!selectedClient && (
              <Badge variant="secondary" className="text-xs">
                Ativo
              </Badge>
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {clients.map((client) => (
          <DropdownMenuItem 
            key={client.id}
            onClick={() => onClientChange(client.id)}
          >
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{client.nome}</span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedClient === client.id && (
                    <Badge variant="secondary" className="text-xs">
                      Ativo
                    </Badge>
                  )}
                  {!client.ativo && (
                    <Badge variant="destructive" className="text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{client.stats.totalUsers} usuários</span>
                <span>{client.stats.activeDoctors} médicos</span>
                <span>{client.stats.totalAppointments} agendamentos</span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};