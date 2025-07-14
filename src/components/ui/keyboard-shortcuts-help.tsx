import { useState } from 'react';
import { Keyboard, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Shortcut {
  key: string;
  description: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const SHORTCUTS: Shortcut[] = [
  { key: 'N', ctrlKey: true, description: 'Novo agendamento' },
  { key: 'F', ctrlKey: true, description: 'Buscar agendamentos' },
  { key: 'R', ctrlKey: true, description: 'Atualizar página' },
  { key: 'Esc', description: 'Fechar modal ou cancelar ação' },
  { key: '/', description: 'Focar na busca' },
  { key: 'Enter', description: 'Confirmar ação' },
  { key: 'Space', description: 'Expandir/colapsar filtros' },
  { key: '?', shiftKey: true, description: 'Mostrar atalhos' },
];

export const KeyboardShortcutsHelp = () => {
  const [open, setOpen] = useState(false);

  const formatKey = (shortcut: Shortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    parts.push(shortcut.key);
    return parts.join(' + ');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Atalhos do teclado">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos do Teclado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {formatKey(shortcut)}
              </Badge>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Pressione <Badge variant="outline" className="mx-1">?</Badge> a qualquer momento para ver esta ajuda
        </div>
      </DialogContent>
    </Dialog>
  );
};