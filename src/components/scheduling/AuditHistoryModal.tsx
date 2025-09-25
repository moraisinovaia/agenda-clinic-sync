import React, { useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, User, Edit, Plus, Trash2 } from "lucide-react";
import { useAuditHistory } from '@/hooks/useAuditHistory';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuditHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId: string;
  pacienteNome: string;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  open,
  onOpenChange,
  agendamentoId,
  pacienteNome
}) => {
  const { 
    loading, 
    history, 
    fetchAuditHistory, 
    getFieldDisplayName, 
    getActionDisplayName, 
    formatValue 
  } = useAuditHistory();

  useEffect(() => {
    if (open && agendamentoId) {
      fetchAuditHistory(agendamentoId);
    }
  }, [open, agendamentoId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <Plus className="h-4 w-4" />;
      case 'UPDATE': return <Edit className="h-4 w-4" />;
      case 'DELETE': return <Trash2 className="h-4 w-4" />;
      default: return <Edit className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Alterações - {pacienteNome}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum histórico de alterações encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <Card key={entry.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getActionColor(entry.action)}>
                          {getActionIcon(entry.action)}
                          {getActionDisplayName(entry.action)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(entry.audit_timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {entry.profile_name || entry.user_name || 'Sistema'}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {entry.action === 'UPDATE' && entry.changed_fields && entry.changed_fields.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Campos alterados:</h4>
                        {entry.changed_fields.map((field) => (
                          <div key={field} className="bg-muted/30 p-3 rounded-lg">
                            <div className="font-medium text-sm mb-2">
                              {getFieldDisplayName(field)}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex-1">
                                <span className="text-muted-foreground">De:</span>
                                <div className="bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded mt-1">
                                  {formatValue(entry.old_values?.[field], field)}
                                </div>
                              </div>
                              <div className="flex-1">
                                <span className="text-muted-foreground">Para:</span>
                                <div className="bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded mt-1">
                                  {formatValue(entry.new_values?.[field], field)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : entry.action === 'INSERT' ? (
                      <div className="text-sm text-muted-foreground">
                        Agendamento criado no sistema
                      </div>
                    ) : entry.action === 'DELETE' ? (
                      <div className="text-sm text-muted-foreground">
                        Agendamento removido do sistema
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Alteração realizada sem campos específicos detectados
                      </div>
                    )}
                  </CardContent>
                  
                  {index < history.length - 1 && (
                    <div className="absolute left-6 bottom-0 w-px h-4 bg-border translate-y-full" />
                  )}
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};