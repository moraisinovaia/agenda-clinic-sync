import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DistribuicaoRecurso } from '@/hooks/useJoanaAgenda';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PERIODOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'integral', label: 'Integral' },
];

interface EditDistribuicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distribuicao: DistribuicaoRecurso | null;
  medicos: { id: string; nome: string }[];
  onSave: (id: string, data: { quantidade: number; periodo: string; horario_inicio: string | null; medico_id: string; dia_semana: number }) => Promise<void>;
}

export function EditDistribuicaoModal({
  open,
  onOpenChange,
  distribuicao,
  medicos,
  onSave,
}: EditDistribuicaoModalProps) {
  const [quantidade, setQuantidade] = useState(1);
  const [periodo, setPeriodo] = useState('integral');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [diaSemana, setDiaSemana] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (distribuicao) {
      setQuantidade(distribuicao.quantidade);
      setPeriodo(distribuicao.periodo || 'integral');
      setHorarioInicio(distribuicao.horario_inicio || '');
      setMedicoId(distribuicao.medico_id);
      setDiaSemana(distribuicao.dia_semana);
    }
  }, [distribuicao]);

  const handleSave = async () => {
    if (!distribuicao) return;
    setSaving(true);
    try {
      await onSave(distribuicao.id, {
        quantidade,
        periodo,
        horario_inicio: horarioInicio || null,
        medico_id: medicoId,
        dia_semana: diaSemana,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Distribuição</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Médico</Label>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o médico" />
              </SelectTrigger>
              <SelectContent>
                {medicos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dia da Semana</Label>
            <Select value={String(diaSemana)} onValueChange={(v) => setDiaSemana(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((dia, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {dia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade de Vagas</Label>
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Horário de Início (opcional)</Label>
            <Input
              type="time"
              value={horarioInicio}
              onChange={(e) => setHorarioInicio(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
