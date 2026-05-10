// Modal de override profissional pra agendamentos fora da regra.
//
// Quando recepção tenta agendar dia/horário que viola distribuição de
// recursos (MAPA/HOLTER/ECG), este modal aparece em vez do erro vermelho:
//   - Mostra o motivo do conflito (ex: "Dr. Heverson não atende MAPA na
//     segunda-feira")
//   - Pede categoria (encaixe / emergência / paciente VIP / outro)
//   - Pede justificativa (obrigatória quando categoria=outro)
//   - Recepção confirma → agendamento criado COM trilha de auditoria
//
// Trilha LGPD: o backend grava forced_at, forced_by_user_id, categoria e
// motivo no agendamento + audit_logs (via trigger).

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

export type ForceCategoria = 'encaixe' | 'emergencia' | 'paciente_vip' | 'outro';

const CATEGORIA_LABELS: Record<ForceCategoria, string> = {
  encaixe:       '🩹 Encaixe — paciente normal sem dia regular',
  emergencia:    '🚨 Emergência — caso clínico urgente',
  paciente_vip:  '⭐ Paciente VIP — exceção autorizada',
  outro:         '📝 Outro — exige justificativa',
};

export interface ForceAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Motivo do bloqueio retornado pelo backend (ex: "MAPA não disponível pra JOANA neste dia da semana") */
  conflictReason: string;
  /** Detalhes opcionais (ex: dias normais) */
  recursoNome?: string;
  medicoNome?: string;
  data?: string;
  /** Callback quando user confirma override. Recebe categoria e reason (ou null). */
  onConfirm: (categoria: ForceCategoria, reason: string | null) => Promise<void>;
}

const MIN_REASON_LENGTH = 5;

export function ForceAppointmentDialog({
  open, onOpenChange, conflictReason, recursoNome, medicoNome, data, onConfirm,
}: ForceAppointmentDialogProps) {
  const [categoria, setCategoria] = useState<ForceCategoria | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonRequired = categoria === 'outro';
  const reasonValid = !reasonRequired || reason.trim().length >= MIN_REASON_LENGTH;
  const canConfirm = categoria !== '' && reasonValid && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(categoria as ForceCategoria, reason.trim() || null);
      // Reset + fecha
      setCategoria('');
      setReason('');
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Erro ao forçar agendamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    setCategoria('');
    setReason('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Forçar agendamento fora da regra
          </DialogTitle>
          <DialogDescription>
            Este agendamento viola a configuração da clínica. Você pode forçá-lo,
            mas deve informar o motivo para auditoria.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertDescription className="space-y-1 text-sm">
            <p className="font-medium text-amber-900">{conflictReason}</p>
            {(recursoNome || medicoNome || data) && (
              <p className="text-amber-800 text-xs">
                {[recursoNome && `Recurso: ${recursoNome}`,
                  medicoNome && `Médico: ${medicoNome}`,
                  data && `Data: ${data}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="categoria-force">
              Motivo do override <span className="text-destructive">*</span>
            </Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as ForceCategoria)}>
              <SelectTrigger id="categoria-force">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORIA_LABELS) as ForceCategoria[]).map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORIA_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason-force">
              Justificativa
              {reasonRequired ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground text-xs"> (opcional)</span>
              )}
            </Label>
            <Textarea
              id="reason-force"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                reasonRequired
                  ? `Mínimo ${MIN_REASON_LENGTH} caracteres — explique o motivo`
                  : 'Detalhes adicionais (opcional)'
              }
              rows={3}
              disabled={submitting}
              className={
                reasonRequired && reason.length > 0 && !reasonValid
                  ? 'border-destructive'
                  : ''
              }
            />
            {reasonRequired && reason.length > 0 && !reasonValid && (
              <p className="text-xs text-destructive">
                Mínimo {MIN_REASON_LENGTH} caracteres ({reason.trim().length}/{MIN_REASON_LENGTH})
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esta ação será registrada com seu usuário, data/hora, categoria e
              motivo. O administrador da clínica pode revisar todos os
              agendamentos forçados.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Forçar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
