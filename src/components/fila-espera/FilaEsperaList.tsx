import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, User, Calendar, Phone, AlertCircle, CheckCircle, X, Search, RefreshCw } from 'lucide-react';
import { FilaEsperaWithRelations, FilaStatus } from '@/types/fila-espera';

interface FilaEsperaListProps {
  filaEspera: FilaEsperaWithRelations[];
  status: FilaStatus;
  loading?: boolean;
  error?: string | null;
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onLoadData?: () => Promise<void>;
}

export function FilaEsperaList({ 
  filaEspera, 
  status, 
  loading = false, 
  error, 
  onUpdateStatus, 
  onRemove, 
  onLoadData 
}: FilaEsperaListProps) {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroMedico, setFiltroMedico] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Carregar dados automaticamente quando o componente monta
  useEffect(() => {
    if (!dataLoaded && onLoadData) {
      onLoadData();
      setDataLoaded(true);
    }
  }, [onLoadData, dataLoaded]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'notificado':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'agendado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando':
        return <Clock className="h-4 w-4" />;
      case 'notificado':
        return <AlertCircle className="h-4 w-4" />;
      case 'agendado':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelado':
        return <X className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPrioridadeColor = (prioridade: number) => {
    if (prioridade >= 4) return 'text-red-600 font-bold';
    if (prioridade >= 3) return 'text-orange-600 font-medium';
    return 'text-gray-600';
  };

  const filaFiltrada = filaEspera.filter(item => {
    const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus;
    const matchMedico = filtroMedico === 'todos' || item.medico_id === filtroMedico;
    const matchBusca = !busca || 
      item.pacientes?.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
      item.medicos?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      item.atendimentos?.nome?.toLowerCase().includes(busca.toLowerCase());
    
    return matchStatus && matchMedico && matchBusca;
  });

  const medicosUnicos = [...new Set(filaEspera.map(item => item.medicos?.nome).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{status.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{status.aguardando}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{status.notificado}</p>
                <p className="text-sm text-muted-foreground">Notificados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{status.agendado}</p>
                <p className="text-sm text-muted-foreground">Agendados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{status.cancelado}</p>
                <p className="text-sm text-muted-foreground">Cancelados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do paciente, médico ou exame..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="notificado">Notificado</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Médico</label>
              <Select value={filtroMedico} onValueChange={setFiltroMedico}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {medicosUnicos.map((medico) => (
                    <SelectItem key={medico} value={medico || ''}>
                      {medico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista da Fila */}
      <div className="space-y-4">
        {loading ? (
          // Skeleton loading
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          // Erro com botão de retry
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Erro ao carregar a fila
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {error}
              </p>
              {onLoadData && (
                <Button 
                  onClick={() => onLoadData()} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar Novamente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filaFiltrada.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum paciente na fila
              </h3>
              <p className="text-sm text-muted-foreground">
                {busca || filtroStatus !== 'todos' || filtroMedico !== 'todos' 
                  ? 'Nenhum resultado encontrado com os filtros aplicados.'
                  : 'A fila de espera está vazia no momento.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filaFiltrada.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium">{item.pacientes?.nome_completo}</span>
                      </div>
                      <Badge variant="secondary" className={`${getStatusColor(item.status)} flex items-center gap-1`}>
                        {getStatusIcon(item.status)}
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                      <span className={`text-sm ${getPrioridadeColor(item.prioridade)}`}>
                        Prioridade {item.prioridade}
                      </span>
                    </div>

                    {/* Informações */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{item.pacientes?.celular}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{item.medicos?.nome}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(item.data_preferida), "dd/MM/yyyy", { locale: ptBR })}
                          {item.periodo_preferido !== 'qualquer' && ` (${item.periodo_preferido})`}
                        </span>
                      </div>
                      
                      <div className="text-muted-foreground">
                        {item.atendimentos?.nome}
                      </div>
                    </div>

                    {/* Data limite */}
                    {item.data_limite && (
                      <div className="text-sm text-orange-600">
                        Até: {format(new Date(item.data_limite), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    )}

                    {/* Observações */}
                    {item.observacoes && (
                      <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        {item.observacoes}
                      </div>
                    )}

                    {/* Data de criação */}
                    <div className="text-xs text-muted-foreground">
                      Adicionado em {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 ml-4">
                    {item.status === 'aguardando' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onUpdateStatus(item.id, 'cancelado')}
                      >
                        Cancelar
                      </Button>
                    )}
                    
                    {item.status === 'notificado' && (
                      <>
                        <Button 
                          size="sm"
                          onClick={() => onUpdateStatus(item.id, 'agendado')}
                        >
                          Confirmar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onUpdateStatus(item.id, 'aguardando')}
                        >
                          Voltar
                        </Button>
                      </>
                    )}

                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onRemove(item.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}