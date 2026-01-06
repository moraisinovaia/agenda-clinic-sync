import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useJoanaAgenda, DistribuicaoRecurso } from '@/hooks/useJoanaAgenda';
import { EditDistribuicaoModal, AddDistribuicaoModal } from './joana-agenda';
import { Activity, Heart, Zap, RefreshCw, Clock, Plus, Pencil, Trash2 } from 'lucide-react';

const RECURSO_ICONS: Record<string, React.ReactNode> = {
  MAPA: <Activity className="h-4 w-4" />,
  HOLTER: <Heart className="h-4 w-4" />,
  ECG: <Zap className="h-4 w-4" />,
};

const RECURSO_COLORS: Record<string, string> = {
  MAPA: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  HOLTER: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
  ECG: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
};

const DIAS_HEADER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export function JoanaAgendaPanel() {
  const {
    recursos,
    distribuicoes,
    medicos,
    loading,
    DIAS_SEMANA,
    getResumoSemanal,
    updateDistribuicao,
    createDistribuicao,
    deleteDistribuicao,
    refetch,
  } = useJoanaAgenda();

  const [activeTab, setActiveTab] = useState('visao-geral');
  const [editingDist, setEditingDist] = useState<DistribuicaoRecurso | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addRecursoPreSelecionado, setAddRecursoPreSelecionado] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<DistribuicaoRecurso | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const resumoSemanal = getResumoSemanal();

  const formatMedicos = (medicosNomes: string[]) => {
    return medicosNomes
      .map((m) => {
        const partes = m.split(' ');
        return partes.length > 2 ? `Dr. ${partes[1]}` : m;
      })
      .join(' / ');
  };

  const handleAddClick = (recursoId?: string) => {
    setAddRecursoPreSelecionado(recursoId || '');
    setShowAddModal(true);
  };

  const handleEditClick = (dist: DistribuicaoRecurso) => {
    setEditingDist(dist);
  };

  const handleDeleteClick = (dist: DistribuicaoRecurso) => {
    setDeleteConfirm(dist);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteDistribuicao(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Agenda de Joana - Equipamentos
            </CardTitle>
            <CardDescription>
              Gerenciamento de MAPA, Holter e ECG compartilhados entre cardiologistas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAddClick()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="mapa">MAPA</TabsTrigger>
              <TabsTrigger value="holter">Holter</TabsTrigger>
              <TabsTrigger value="ecg">ECG</TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral">
              <div className="space-y-6">
                {/* Resumo de recursos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recursos.map((recurso) => (
                    <Card key={recurso.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {RECURSO_ICONS[recurso.nome]}
                            <span className="font-semibold">{recurso.nome}</span>
                          </div>
                          <Badge variant="outline">
                            Limite: {recurso.limite_diario}/dia
                          </Badge>
                        </div>
                        {recurso.horario_instalacao && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Instalação: {recurso.horario_instalacao.slice(0, 5)} | 
                            Ficha: {recurso.ficha_inicio?.slice(0, 5)} - {recurso.ficha_fim?.slice(0, 5)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Tabela de distribuição semanal */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Exame</TableHead>
                        {DIAS_HEADER.map((dia) => (
                          <TableHead key={dia} className="text-center">
                            {dia}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(resumoSemanal).map(([recursoNome, dias]) => (
                        <TableRow key={recursoNome}>
                          <TableCell>
                            <Badge className={RECURSO_COLORS[recursoNome]}>
                              {RECURSO_ICONS[recursoNome]}
                              <span className="ml-1">{recursoNome}</span>
                            </Badge>
                          </TableCell>
                          {[1, 2, 3, 4, 5].map((dia) => {
                            const info = dias[dia];
                            return (
                              <TableCell key={dia} className="text-center">
                                {info?.total > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      {formatMedicos(info.medicos)}
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                      {info.total} vagas
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {['mapa', 'holter', 'ecg'].map((recursoKey) => {
              const recursoNome = recursoKey.toUpperCase();
              const recurso = recursos.find((r) => r.nome === recursoNome);
              const distRecurso = distribuicoes.filter(
                (d) => d.recurso?.nome === recursoNome
              );

              return (
                <TabsContent key={recursoKey} value={recursoKey}>
                  <div className="space-y-4">
                    {recurso && (
                      <Card className="border-l-4 border-l-primary">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">
                                {RECURSO_ICONS[recursoNome]}
                                {recurso.nome}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {recurso.descricao}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap items-center">
                              <Badge>Limite: {recurso.limite_diario}/dia</Badge>
                              {recurso.horario_instalacao && (
                                <Badge variant="outline">
                                  Instalação: {recurso.horario_instalacao.slice(0, 5)}
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddClick(recurso.id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dia</TableHead>
                            <TableHead>Médico</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead className="text-center">Vagas</TableHead>
                            {recursoNome === 'ECG' && <TableHead>Horário</TableHead>}
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {distRecurso
                            .sort((a, b) => a.dia_semana - b.dia_semana)
                            .map((dist) => (
                              <TableRow key={dist.id}>
                                <TableCell>{DIAS_SEMANA[dist.dia_semana]}</TableCell>
                                <TableCell className="font-medium">
                                  {dist.medico?.nome}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {dist.periodo}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary">{dist.quantidade}</Badge>
                                </TableCell>
                                {recursoNome === 'ECG' && (
                                  <TableCell>
                                    {dist.horario_inicio?.slice(0, 5) || '-'}
                                  </TableCell>
                                )}
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditClick(dist)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteClick(dist)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <EditDistribuicaoModal
        open={!!editingDist}
        onOpenChange={(open) => !open && setEditingDist(null)}
        distribuicao={editingDist}
        medicos={medicos}
        onSave={updateDistribuicao}
      />

      {/* Modal de Adicionar */}
      <AddDistribuicaoModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        recursos={recursos}
        medicos={medicos}
        recursoPreSelecionado={addRecursoPreSelecionado}
        onSave={createDistribuicao}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover esta distribuição de{' '}
              <strong>{deleteConfirm?.recurso?.nome}</strong> para{' '}
              <strong>{deleteConfirm?.medico?.nome}</strong> em{' '}
              <strong>{deleteConfirm && DIAS_SEMANA[deleteConfirm.dia_semana]}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
