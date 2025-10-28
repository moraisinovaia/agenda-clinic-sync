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
        // Log de debug para detecção de teclas
        console.log('🔍 Tecla pressionada:', {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey
        });

        // Verificar elemento focado
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.tagName === 'SELECT' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );

        const matchedShortcut = shortcuts.find(shortcut => {
          // Verificar se event.key e shortcut.key existem antes de usar toLowerCase
          if (!event.key || !shortcut.key) return false;
          
          // Para teclas de função (F1-F12), comparar direto sem toLowerCase
          const isFunctionKey = /^F\d+$/i.test(shortcut.key);
          
          return (
            (isFunctionKey 
              ? event.key === shortcut.key 
              : event.key.toLowerCase() === shortcut.key.toLowerCase()
            ) &&
            !!event.ctrlKey === !!shortcut.ctrlKey &&
            !!event.altKey === !!shortcut.altKey &&
            !!event.shiftKey === !!shortcut.shiftKey
          );
        });

        if (matchedShortcut) {
          // Log debug para rastreamento
          console.log(`🔥 Atalho detectado: ${matchedShortcut.description}`, {
            isInputFocused,
            activeElement: activeElement?.tagName,
            key: matchedShortcut.key,
            ctrlKey: matchedShortcut.ctrlKey
          });

          // Permitir Ctrl + N sempre, outros atalhos só quando não há input focado
          const isCtrlN = matchedShortcut.key.toLowerCase() === 'n' && matchedShortcut.ctrlKey;
          const isEscape = matchedShortcut.key === 'Escape';
          
          if (isInputFocused && !isCtrlN && !isEscape) {
            console.log(`⚠️ Atalho ${matchedShortcut.description} ignorado - input focado`);
            return;
          }
          
          // Prevent default IMEDIATAMENTE para atalhos com Ctrl e teclas de função
          const needsPreventDefault = matchedShortcut.ctrlKey || 
                                     /^F\d+$/i.test(matchedShortcut.key) || 
                                     matchedShortcut.key === 'Escape';
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