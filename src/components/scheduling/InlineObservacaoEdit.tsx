// Edição inline da observação de um agendamento.
//
// UX:
//   - Display: texto truncado com ícone "lápis" no hover (1 linha)
//   - Click → vira textarea autoFocus (max 1000 chars, contador)
//   - Salvar: Ctrl+Enter OU blur deliberado
//   - Cancelar: Escape (não chama API)
//   - Optimistic via tanstack mutation; rollback em erro (hook já trata toast)
//
// Bloqueios visuais (sem ícone, sem hover):
//   - disabled prop (passado por DoctorSchedule readOnly)
//   - cargo do user ≠ recepcionista/administrador
//   - status terminal (cancelado/cancelado_bloqueio/excluido)
//
// Backend valida tudo de novo via RPC — frontend só evita UX inválida.

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateObservacao } from '@/hooks/useUpdateObservacao';
import { cn } from '@/lib/utils';

const TERMINAL_STATUSES = ['cancelado', 'cancelado_bloqueio', 'excluido'];
const MAX_LENGTH = 1000;
const ROLES_CAN_EDIT = ['recepcionista', 'administrador'];

export interface InlineObservacaoEditProps {
  agendamentoId: string;
  value: string | null | undefined;
  updatedAt: string;
  status: string;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
}

export function InlineObservacaoEdit({
  agendamentoId,
  value,
  updatedAt,
  status,
  disabled,
  className,
  textClassName,
}: InlineObservacaoEditProps) {
  const { profile } = useAuth();
  const cargo = (profile as any)?.cargo as string | undefined;
  const canEdit =
    !disabled &&
    cargo !== undefined &&
    ROLES_CAN_EDIT.includes(cargo) &&
    !TERMINAL_STATUSES.includes(status);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useUpdateObservacao();

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const startEdit = () => {
    if (!canEdit || mutation.isPending) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  const commit = async () => {
    const normalized = draft.trim();
    const current = (value ?? '').trim();
    if (normalized === current) {
      setEditing(false);
      return;
    }
    try {
      await mutation.mutateAsync({
        agendamentoId,
        observacao: normalized,
        expectedUpdatedAt: updatedAt,
      });
      setEditing(false);
    } catch {
      // hook já mostra toast; mantém modo edit pra user retentar
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void commit();
    }
  };

  if (editing) {
    return (
      <div className={cn('mt-1', className)}>
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          onBlur={() => void commit()}
          disabled={mutation.isPending}
          maxLength={MAX_LENGTH}
          rows={2}
          aria-label="Editar observação do agendamento"
          aria-describedby={`obs-hint-${agendamentoId}`}
          className="text-xs min-h-[48px] py-1 px-2"
          placeholder="Observação..."
        />
        <div
          id={`obs-hint-${agendamentoId}`}
          className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5"
          aria-live="polite"
        >
          <span>
            {mutation.isPending ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando...
              </span>
            ) : (
              <span>Ctrl+Enter salva · Esc cancela</span>
            )}
          </span>
          <span>{draft.length}/{MAX_LENGTH}</span>
        </div>
      </div>
    );
  }

  const hasContent = !!(value && value.trim().length > 0);

  if (!hasContent && !canEdit) return null;

  return (
    <div
      className={cn(
        'group/obs flex items-start gap-1 mt-1 rounded-sm px-1 -mx-1',
        canEdit && 'cursor-pointer hover:bg-muted/40 transition-colors',
        className
      )}
      onClick={canEdit ? startEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          startEdit();
        }
      }}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={canEdit ? 'Clique para editar observação' : undefined}
      title={canEdit ? 'Clique para editar observação' : undefined}
    >
      <span
        className={cn(
          'text-xs text-muted-foreground truncate flex-1',
          !hasContent && 'italic opacity-60',
          textClassName
        )}
      >
        {hasContent ? value : canEdit ? 'Adicionar observação' : ''}
      </span>
      {canEdit && (
        <Pencil
          className="h-3 w-3 shrink-0 text-muted-foreground opacity-40 group-hover/obs:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
