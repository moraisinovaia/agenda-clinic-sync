import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileDown, Filter, History, User, Calendar, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuditEntry {
  id: string;
  audit_timestamp: string;
  action: string;
  table_name: string;
  record_id: string;
  user_id: string;
  user_name?: string | null;
  profile_name?: string | null;
  changed_fields: string[] | null;
  old_values: any;
  new_values: any;
  ip_address?: string | null;
  user_agent?: string | null;
  session_info?: any;
  created_at: string;
}

export const AuditReportsPage: React.FC = () => {
  const [auditData, setAuditData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('audit_timestamp', { ascending: false })
        .limit(500);

      if (startDate) {
        query = query.gte('audit_timestamp', startDate);
      }
      if (endDate) {
        query = query.lte('audit_timestamp', endDate + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar dados de auditoria:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados de auditoria",
          variant: "destructive",
        });
        return;
      }

      // Transformar os dados para adicionar campos derivados
      const transformedData = (data || []).map(entry => ({
        ...entry,
        user_name: null, // Será preenchido pela busca secundária se necessário
        profile_name: typeof entry.session_info === 'object' && entry.session_info !== null 
          ? (entry.session_info as any)?.profile_name || null 
          : null,
        ip_address: entry.ip_address as string | null,
        user_agent: entry.user_agent as string | null
      }));

      setAuditData(transformedData);
    } catch (error) {
      console.error('Erro ao buscar auditoria:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredData = auditData.filter(entry => {
    const matchesSearch = searchTerm === '' || 
      entry.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.record_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || entry.action === actionFilter;
    
    const matchesUser = userFilter === '' || 
      entry.profile_name?.toLowerCase().includes(userFilter.toLowerCase()) ||
      entry.user_name?.toLowerCase().includes(userFilter.toLowerCase());

    return matchesSearch && matchesAction && matchesUser;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      'INSERT': 'Criado',
      'UPDATE': 'Alterado',
      'DELETE': 'Excluído'
    };
    return actionMap[action] || action;
  };

  const exportToCSV = () => {
    const headers = ['Data/Hora', 'Ação', 'Usuário', 'Registro ID', 'Campos Alterados'];
    const csvData = filteredData.map(entry => [
      format(new Date(entry.audit_timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      getActionLabel(entry.action),
      entry.profile_name || entry.user_name || 'Sistema',
      entry.record_id,
      entry.changed_fields?.join(', ') || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios de Auditoria</h1>
          <p className="text-muted-foreground">
            Visualize e analise todas as alterações no sistema
          </p>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do usuário ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Ação</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="INSERT">Criado</SelectItem>
                  <SelectItem value="UPDATE">Alterado</SelectItem>
                  <SelectItem value="DELETE">Excluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchAuditData} className="w-full">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Auditoria */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log de Auditoria
            </CardTitle>
            <Badge variant="outline">
              {filteredData.length} registros
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Registro ID</TableHead>
                    <TableHead>Campos Alterados</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(entry.audit_timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(entry.action)}>
                          {getActionLabel(entry.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {entry.profile_name || entry.user_name || 'Sistema'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.record_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {entry.changed_fields && entry.changed_fields.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.changed_fields.map((field) => (
                              <Badge key={field} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.action === 'UPDATE' && entry.changed_fields && entry.changed_fields.length > 0 && (
                          <div className="text-xs space-y-1">
                            {entry.changed_fields.slice(0, 2).map((field) => (
                              <div key={field} className="flex items-center gap-2">
                                <span className="font-medium">{field}:</span>
                                <span className="text-red-600">
                                  {String(entry.old_values?.[field] || '').slice(0, 10)}...
                                </span>
                                <span>→</span>
                                <span className="text-green-600">
                                  {String(entry.new_values?.[field] || '').slice(0, 10)}...
                                </span>
                              </div>
                            ))}
                            {entry.changed_fields.length > 2 && (
                              <div className="text-muted-foreground">
                                +{entry.changed_fields.length - 2} mais...
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};