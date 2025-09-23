import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStableAuth } from '@/hooks/useStableAuth';
import { useSuperAdminContext } from '@/hooks/useSuperAdminContext';
import { NavigationHeader } from '@/components/ui/navigation-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientOverview } from '@/components/admin/ClientOverview';
import { QuickClientSwitch } from '@/components/admin/QuickClientSwitch';
import { BulkUserActions } from '@/components/admin/BulkUserActions';
import { AuditLog } from '@/components/admin/AuditLog';
import { ClientHealthMonitor } from '@/components/admin/ClientHealthMonitor';
import { SuperAdminStats } from '@/components/admin/SuperAdminStats';
import { Users, Building2, Activity, Shield, Settings, AlertTriangle } from 'lucide-react';

const SuperAdminDashboard = () => {
  const { user, profile, loading: authLoading, isSuperAdmin } = useStableAuth();
  const { 
    selectedClient, 
    setSelectedClient, 
    clientsData, 
    loading, 
    refreshData,
    auditLogs 
  } = useSuperAdminContext();

  // Redirect if not authenticated or not super admin
  if (!authLoading && (!user || !isSuperAdmin)) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/20 mx-auto"></div>
          </div>
          <div>
            <p className="text-lg font-medium">Super Admin Dashboard</p>
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <NavigationHeader
            title="Super Admin Dashboard"
            subtitle={`Gerenciamento Multi-Cliente • ${profile?.nome}`}
            onBack={() => window.history.back()}
            showBack={true}
            showHome={false}
          />
          
          {/* Client Switcher */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Super Admin
              </Badge>
              <QuickClientSwitch 
                selectedClient={selectedClient}
                onClientChange={setSelectedClient}
                clients={clientsData}
              />
            </div>
            <Button onClick={refreshData} variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Atualizar Dados
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <SuperAdminStats clientsData={clientsData} />

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <Building2 className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="h-4 w-4 mr-2" />
              Monitoramento
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Shield className="h-4 w-4 mr-2" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <ClientOverview 
              clientsData={clientsData}
              selectedClient={selectedClient}
              onClientSelect={setSelectedClient}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <BulkUserActions 
              selectedClient={selectedClient}
              clientsData={clientsData}
            />
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            <ClientHealthMonitor 
              clientsData={clientsData}
              selectedClient={selectedClient}
            />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <AuditLog logs={auditLogs} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Funcionalidade em desenvolvimento
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;