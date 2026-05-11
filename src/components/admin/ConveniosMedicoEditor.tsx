import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  CONVENIO_TIPOS,
  ConvenioMedico,
  ConvenioMedicoTipo,
  useConveniosMedico,
} from '@/hooks/useConveniosMedico';

interface Props {
  medicoId: string;
  clienteId: string;
}

interface DraftRow {
  convenio_nome: string;
  tipo: ConvenioMedicoTipo;
  observacao: string;
  mensagem_orientacao: string;
}

const emptyDraft: DraftRow = {
  convenio_nome: '',
  tipo: 'informativo',
  observacao: '',
  mensagem_orientacao: '',
};

export const ConveniosMedicoEditor: React.FC<Props> = ({ medicoId, clienteId }) => {
  const { list, create, update, remove } = useConveniosMedico(medicoId, clienteId);
  const [draft, setDraft] = useState<DraftRow>(emptyDraft);

  const handleAdd = async () => {
    if (!draft.convenio_nome.trim()) {
      toast.error('Informe o nome do convênio.');
      return;
    }
    try {
      await create.mutateAsync({
        convenio_nome: draft.convenio_nome.trim(),
        tipo: draft.tipo,
        observacao: draft.observacao.trim() || null,
        mensagem_orientacao: draft.mensagem_orientacao.trim() || null,
      });
      setDraft(emptyDraft);
      toast.success('Convênio adicionado.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adicionar convênio.');
    }
  };

  const handleUpdate = async (row: ConvenioMedico, patch: Partial<ConvenioMedico>) => {
    try {
      await update.mutateAsync({ id: row.id, patch });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este convênio?')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Removido.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover.');
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Convênios (modelo normalizado)</Label>
        {list.isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Estes registros são a fonte da verdade para a IA decidir o que aceitar via WhatsApp.
        Os convênios marcados acima ("Convênios Aceitos" legado) ainda são usados em outras telas.
      </p>

      {/* Lista existente */}
      <div className="space-y-2">
        {list.data && list.data.length > 0 ? (
          list.data.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-start p-2 border rounded">
              <div className="col-span-3">
                <Input
                  value={row.convenio_nome}
                  onChange={(e) => handleUpdate(row, { convenio_nome: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Select
                  value={row.tipo}
                  onValueChange={(value: ConvenioMedicoTipo) => handleUpdate(row, { tipo: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONVENIO_TIPOS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  placeholder="Observação"
                  value={row.observacao || ''}
                  onChange={(e) => handleUpdate(row, { observacao: e.target.value || null })}
                />
              </div>
              <div className="col-span-3">
                <Textarea
                  placeholder="Mensagem ao paciente"
                  value={row.mensagem_orientacao || ''}
                  onChange={(e) => handleUpdate(row, { mensagem_orientacao: e.target.value || null })}
                  rows={1}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(row.id)}
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-muted-foreground italic">Nenhum convênio cadastrado.</div>
        )}
      </div>

      {/* Linha de adição */}
      <div className="grid grid-cols-12 gap-2 items-start pt-2 border-t">
        <div className="col-span-3">
          <Input
            placeholder="Nome do convênio"
            value={draft.convenio_nome}
            onChange={(e) => setDraft(prev => ({ ...prev, convenio_nome: e.target.value }))}
          />
        </div>
        <div className="col-span-3">
          <Select
            value={draft.tipo}
            onValueChange={(value: ConvenioMedicoTipo) => setDraft(prev => ({ ...prev, tipo: value }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONVENIO_TIPOS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Input
            placeholder="Observação"
            value={draft.observacao}
            onChange={(e) => setDraft(prev => ({ ...prev, observacao: e.target.value }))}
          />
        </div>
        <div className="col-span-3">
          <Textarea
            placeholder="Mensagem ao paciente"
            value={draft.mensagem_orientacao}
            onChange={(e) => setDraft(prev => ({ ...prev, mensagem_orientacao: e.target.value }))}
            rows={1}
          />
        </div>
        <div className="col-span-1 flex justify-end">
          <Button
            type="button"
            size="icon"
            onClick={handleAdd}
            disabled={create.isPending}
            title="Adicionar"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
