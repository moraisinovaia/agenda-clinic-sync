import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClientData {
  id: string;
  nome: string;
  ativo: boolean;
  configuracoes: any;
  created_at: string;
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    totalAppointments: number;
    activeDoctors: number;
    totalPatients: number;
  };
}

interface AuditLog {
  id: string;
  action: string;
  target_client_id?: string;
  target_user_id?: string;
  details?: any;
  created_at: string;
  admin_id: string;
}

interface SuperAdminContextType {
  selectedClient: string | null;
  setSelectedClient: (clientId: string | null) => void;
  clientsData: ClientData[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  auditLogs: AuditLog[];
  logAction: (action: string, targetClientId?: string, targetUserId?: string, details?: any) => Promise<void>;
}

const SuperAdminContext = createContext<SuperAdminContextType | undefined>(undefined);

export const useSuperAdminContext = () => {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdminContext must be used within a SuperAdminProvider');
  }
  return context;
};

interface SuperAdminProviderProps {
  children: ReactNode;
}

export const SuperAdminProvider = ({ children }: SuperAdminProviderProps) => {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientsData, setClientsData] = useState<ClientData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchClientsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientsError) throw clientsError;

      // For each client, fetch statistics
      const clientsWithStats = await Promise.all(
        clients.map(async (client) => {
          const isIpado = client.nome === 'IPADO';
          const tablePrefix = isIpado ? 'ipado_' : '';
          const profilesTable = isIpado ? 'ipado_profiles' : 'profiles';

          try {
            // Fetch user statistics
            const { data: users, error: usersError } = await supabase
              .from(profilesTable)
              .select('*');

            if (usersError) {
              console.error(`Error fetching users for ${client.nome}:`, usersError);
            }

            // Fetch appointments statistics
            const { data: appointments, error: appointmentsError } = await supabase
              .from(`${tablePrefix}agendamentos`)
              .select('*');

            if (appointmentsError) {
              console.error(`Error fetching appointments for ${client.nome}:`, appointmentsError);
            }

            // Fetch doctors statistics
            const { data: doctors, error: doctorsError } = await supabase
              .from(`${tablePrefix}medicos`)
              .select('*');

            if (doctorsError) {
              console.error(`Error fetching doctors for ${client.nome}:`, doctorsError);
            }

            // Fetch patients statistics
            const { data: patients, error: patientsError } = await supabase
              .from(`${tablePrefix}pacientes`)
              .select('*');

            if (patientsError) {
              console.error(`Error fetching patients for ${client.nome}:`, patientsError);
            }

            return {
              ...client,
              stats: {
                totalUsers: users?.length || 0,
                activeUsers: users?.filter(u => u.ativo)?.length || 0,
                pendingUsers: users?.filter(u => u.status === 'pendente')?.length || 0,
                totalAppointments: appointments?.length || 0,
                activeDoctors: doctors?.filter(d => d.ativo)?.length || 0,
                totalPatients: patients?.length || 0,
              }
            };
          } catch (err) {
            console.error(`Error calculating stats for ${client.nome}:`, err);
            return {
              ...client,
              stats: {
                totalUsers: 0,
                activeUsers: 0,
                pendingUsers: 0,
                totalAppointments: 0,
                activeDoctors: 0,
                totalPatients: 0,
              }
            };
          }
        })
      );

      setClientsData(clientsWithStats);
    } catch (err: any) {
      console.error('Error fetching clients data:', err);
      setError(err.message || 'Erro ao carregar dados dos clientes');
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os dados dos clientes"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('super_admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const logAction = async (
    action: string, 
    targetClientId?: string, 
    targetUserId?: string, 
    details?: any
  ) => {
    try {
      const { error } = await supabase.rpc('log_super_admin_action', {
        p_action: action,
        p_target_client_id: targetClientId,
        p_target_user_id: targetUserId,
        p_details: details
      });

      if (error) throw error;
      
      // Refresh audit logs
      await fetchAuditLogs();
    } catch (err: any) {
      console.error('Error logging action:', err);
    }
  };

  const refreshData = async () => {
    await Promise.all([
      fetchClientsData(),
      fetchAuditLogs()
    ]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const value = {
    selectedClient,
    setSelectedClient,
    clientsData,
    loading,
    error,
    refreshData,
    auditLogs,
    logAction
  };

  return (
    <SuperAdminContext.Provider value={value}>
      {children}
    </SuperAdminContext.Provider>
  );
};