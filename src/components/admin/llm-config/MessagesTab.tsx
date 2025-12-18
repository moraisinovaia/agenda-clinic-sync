import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Save, Loader2, MessageSquare } from 'lucide-react';
import { LLMMensagem } from '@/hooks/useLLMConfig';

interface MessagesTabProps {
  mensagens: LLMMensagem[];
  medicos: any[];
  saving: boolean;
  onSave: (data: Partial<LLMMensagem>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const TIPOS_MENSAGEM = [
  { value: 'bloqueio_agenda', label: 'Bloqueio de Agenda' },
  { value: 'confirmacao_agendamento', label: 'Confirmação de Agendamento' },
  { value: 'data_bloqueada', label: 'Data Bloqueada' },
  { value: 'sem_disponibilidade', label: 'Sem Disponibilidade' },
  { value: 'agendamentos_antigos', label: 'Agendamentos Antigos' },
  { value: 'boas_vindas', label: 'Boas-Vindas' },
  { value: 'encerramento', label: 'Encerramento' },
  { value: 'erro_generico', label: 'Erro Genérico' },
  { value: 'ordem_chegada', label: 'Ordem de Chegada' },
  { value: 'hora_marcada', label: 'Hora Marcada' },
  { value: 'encaixe', label: 'Encaixe / Urgência' },
  { value: 'servico_nao_agendavel', label: 'Serviço Não Agendável Online' },
];

export function MessagesTab({ mensagens, medicos, saving, onSave, onDelete }: MessagesTabProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMensagem, setEditingMensagem] = useState<Partial<LLMMensagem> | null>(null);

  const handleNew = () => {
    setEditingMensagem({
      tipo: 'bloqueio_agenda',
      mensagem: '',
      medico_id: null,
      ativo: true
    });
    setShowDialog(true);
  };

  const handleEdit = (msg: LLMMensagem) => {
    setEditingMensagem(msg);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingMensagem) return;
    const success = await onSave(editingMensagem);
    if (success) {
      setShowDialog(false);
      setEditingMensagem(null);
    }
  };

  const getMedicoNome = (medicoId: string | null) => {
    if (!medicoId) return 'Global (todos os médicos)';
    const medico = medicos.find(m => m.id === medicoId);
    return medico?.nome || 'Médico não encontrado';
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_MENSAGEM.find(t => t.value === tipo)?.label || tipo;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mensagens Personalizadas</CardTitle>
              <CardDescription>
                Configure mensagens específicas para diferentes situações do agente LLM
              </CardDescription>
            </div>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Mensagem
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mensagens.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead className="max-w-md">Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensagens.map(msg => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <Badge variant="outline">{getTipoLabel(msg.tipo)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getMedicoNome(msg.medico_id)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm text-muted-foreground">
                        {msg.mensagem}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={msg.ativo ? 'default' : 'secondary'}>
                        {msg.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(msg)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onDelete(msg.id)}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma mensagem personalizada configurada.</p>
              <p className="text-sm">Clique em "Nova Mensagem" para adicionar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMensagem?.id ? 'Editar Mensagem' : 'Nova Mensagem'}
            </DialogTitle>
            <DialogDescription>
              Configure uma mensagem personalizada para o agente LLM
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Mensagem</Label>
              <Select 
                value={editingMensagem?.tipo || 'bloqueio_agenda'}
                onValueChange={v => setEditingMensagem(prev => prev ? { ...prev, tipo: v } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MENSAGEM.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Médico (opcional)</Label>
              <Select 
                value={editingMensagem?.medico_id || 'global'}
                onValueChange={v => setEditingMensagem(prev => prev ? { ...prev, medico_id: v === 'global' ? null : v } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (todos os médicos)</SelectItem>
                  {medicos.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deixe como "Global" para aplicar a todos os médicos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={editingMensagem?.mensagem || ''}
                onChange={e => setEditingMensagem(prev => prev ? { ...prev, mensagem: e.target.value } : null)}
                placeholder="Digite a mensagem que será enviada ao paciente..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !editingMensagem?.mensagem}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
