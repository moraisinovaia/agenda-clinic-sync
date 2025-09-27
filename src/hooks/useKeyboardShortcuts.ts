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
      try {
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
          // Log debug para rastreamento
          console.log(`🔥 Atalho ativado: ${matchedShortcut.description}`);
          
          // Prevent default apenas para atalhos específicos
          const needsPreventDefault = matchedShortcut.ctrlKey || matchedShortcut.key === 'F12' || matchedShortcut.key === 'Escape';
          if (needsPreventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          
          // Executar ação com tratamento de erro
          try {
            matchedShortcut.action();
            console.log(`✅ Ação do atalho executada com sucesso: ${matchedShortcut.description}`);
          } catch (actionError) {
            console.error(`❌ Erro ao executar ação do atalho ${matchedShortcut.description}:`, actionError);
          }
        }
      } catch (error) {
        console.error('❌ Erro no sistema de atalhos:', error);
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