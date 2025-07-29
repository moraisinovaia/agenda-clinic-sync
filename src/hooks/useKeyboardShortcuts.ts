import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchedShortcut = shortcuts.find(shortcut => {
        // Verificar se event.key e shortcut.key existem antes de usar toLowerCase
        if (!event.key || !shortcut.key) return false;
        
        return (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrlKey &&
          !!event.altKey === !!shortcut.altKey &&
          !!event.shiftKey === !!shortcut.shiftKey
        );
      });

      if (matchedShortcut) {
        event.preventDefault();
        matchedShortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return shortcuts;
};

// Pre-defined shortcuts for common actions
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  {
    key: 'n',
    ctrlKey: true,
    action: () => console.log('New appointment shortcut'),
    description: 'Ctrl+N - Novo agendamento'
  },
  {
    key: 'f',
    ctrlKey: true,
    action: () => console.log('Search shortcut'),
    description: 'Ctrl+F - Buscar'
  },
  {
    key: 'r',
    ctrlKey: true,
    action: () => window.location.reload(),
    description: 'Ctrl+R - Atualizar'
  },
  {
    key: 'Escape',
    action: () => console.log('Close modal shortcut'),
    description: 'Esc - Fechar modal'
  }
];