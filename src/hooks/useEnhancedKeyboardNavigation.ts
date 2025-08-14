import { useEffect, useRef, useState } from 'react';
import { ViewMode } from '@/hooks/useViewMode';

interface KeyboardNavigationConfig {
  onViewChange: (viewMode: ViewMode) => void;
  onDoctorSelect?: (doctorId: string) => void;
  onGlobalSearch?: () => void;
  onQuickActions?: () => void;
  doctors?: Array<{ id: string; nome: string }>;
}

interface NavigationState {
  activeElement: string | null;
  focusedSection: 'header' | 'sidebar' | 'main' | 'actions' | null;
  isNavigating: boolean;
}

export const useEnhancedKeyboardNavigation = (config: KeyboardNavigationConfig) => {
  const [navState, setNavState] = useState<NavigationState>({
    activeElement: null,
    focusedSection: null,
    isNavigating: false,
  });

  const navigationHistory = useRef<string[]>([]);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  // Enhanced keyboard shortcuts
  const shortcuts = [
    // Navigation shortcuts
    {
      key: 'Tab',
      action: () => handleTabNavigation(),
      description: 'Tab - Navegar entre elementos'
    },
    {
      key: 'ArrowUp',
      action: () => handleArrowNavigation('up'),
      description: '↑ - Navegar para cima'
    },
    {
      key: 'ArrowDown',
      action: () => handleArrowNavigation('down'),
      description: '↓ - Navegar para baixo'
    },
    {
      key: 'ArrowLeft',
      action: () => handleArrowNavigation('left'),
      description: '← - Navegar para esquerda'
    },
    {
      key: 'ArrowRight',
      action: () => handleArrowNavigation('right'),
      description: '→ - Navegar para direita'
    },
    
    // Action shortcuts
    {
      key: 'Enter',
      action: () => handleEnterAction(),
      description: 'Enter - Ativar elemento'
    },
    {
      key: ' ',
      action: () => handleSpaceAction(),
      description: 'Space - Selecionar/Ativar'
    },
    
    // Global shortcuts
    {
      key: 'k',
      ctrlKey: true,
      action: () => config.onGlobalSearch?.(),
      description: 'Ctrl+K - Busca global'
    },
    {
      key: 'q',
      ctrlKey: true,
      action: () => config.onQuickActions?.(),
      description: 'Ctrl+Q - Ações rápidas'
    },
    
    // View shortcuts
    {
      key: 'n',
      ctrlKey: true,
      action: () => config.onViewChange('new-appointment'),
      description: 'Ctrl+N - Novo agendamento'
    },
    {
      key: 'm',
      ctrlKey: true,
      action: () => config.onViewChange('multiple-appointment'),
      description: 'Ctrl+M - Agendamento múltiplo'
    },
    {
      key: 'l',
      ctrlKey: true,
      action: () => config.onViewChange('appointments-list'),
      description: 'Ctrl+L - Lista de agendamentos'
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => config.onViewChange('doctors'),
      description: 'Ctrl+D - Dashboard/Médicos'
    },
    {
      key: 'a',
      ctrlKey: true,
      action: () => config.onViewChange('alertas'),
      description: 'Ctrl+A - Alertas'
    },
    {
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      action: () => config.onViewChange('fila-espera'),
      description: 'Ctrl+Shift+F - Fila de espera'
    },
    {
      key: 'p',
      action: () => config.onViewChange('preparos'),
      description: 'P - Preparos'
    },
    
    // Quick doctor selection (1-9)
    {
      key: '1',
      altKey: true,
      action: () => selectDoctorByIndex(0),
      description: 'Alt+1 - Selecionar médico 1'
    },
    {
      key: '2',
      altKey: true,
      action: () => selectDoctorByIndex(1),
      description: 'Alt+2 - Selecionar médico 2'
    },
    {
      key: '3',
      altKey: true,
      action: () => selectDoctorByIndex(2),
      description: 'Alt+3 - Selecionar médico 3'
    },
    {
      key: '4',
      altKey: true,
      action: () => selectDoctorByIndex(3),
      description: 'Alt+4 - Selecionar médico 4'
    },
    {
      key: '5',
      altKey: true,
      action: () => selectDoctorByIndex(4),
      description: 'Alt+5 - Selecionar médico 5'
    },
    
    // Help
    {
      key: '?',
      shiftKey: true,
      action: () => showKeyboardHelp(),
      description: '? - Mostrar ajuda de teclado'
    },
    
    // Escape actions
    {
      key: 'Escape',
      action: () => handleEscapeAction(),
      description: 'Esc - Voltar/Cancelar'
    }
  ];

  const selectDoctorByIndex = (index: number) => {
    if (config.doctors && config.doctors[index] && config.onDoctorSelect) {
      config.onDoctorSelect(config.doctors[index].id);
    }
  };

  const handleTabNavigation = () => {
    // Enhanced tab navigation logic
    const focusableElements = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    
    (focusableElements[nextIndex] as HTMLElement).focus();
  };

  const handleArrowNavigation = (direction: 'up' | 'down' | 'left' | 'right') => {
    // Smart arrow navigation based on current context
    const activeElement = document.activeElement;
    
    if (!activeElement) return;
    
    // Grid navigation for doctor cards
    if (activeElement.closest('[data-doctor-grid]')) {
      handleGridNavigation(direction);
      return;
    }
    
    // List navigation for appointments
    if (activeElement.closest('[data-appointment-list]')) {
      handleListNavigation(direction);
      return;
    }
    
    // Form navigation
    if (activeElement.closest('form')) {
      handleFormNavigation(direction);
      return;
    }
  };

  const handleGridNavigation = (direction: 'up' | 'down' | 'left' | 'right') => {
    const grid = document.querySelector('[data-doctor-grid]');
    if (!grid) return;
    
    const items = Array.from(grid.querySelectorAll('[data-doctor-card]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex === -1) return;
    
    const cols = Math.floor(grid.clientWidth / 300); // Approximate card width
    let nextIndex = currentIndex;
    
    switch (direction) {
      case 'left':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'right':
        nextIndex = Math.min(items.length - 1, currentIndex + 1);
        break;
      case 'up':
        nextIndex = Math.max(0, currentIndex - cols);
        break;
      case 'down':
        nextIndex = Math.min(items.length - 1, currentIndex + cols);
        break;
    }
    
    if (nextIndex !== currentIndex) {
      (items[nextIndex] as HTMLElement).focus();
    }
  };

  const handleListNavigation = (direction: 'up' | 'down' | 'left' | 'right') => {
    const list = document.querySelector('[data-appointment-list]');
    if (!list) return;
    
    const items = Array.from(list.querySelectorAll('[data-appointment-item]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    
    if (direction === 'up') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'down') {
      nextIndex = Math.min(items.length - 1, currentIndex + 1);
    }
    
    if (nextIndex !== currentIndex) {
      (items[nextIndex] as HTMLElement).focus();
    }
  };

  const handleFormNavigation = (direction: 'up' | 'down' | 'left' | 'right') => {
    const form = document.activeElement?.closest('form');
    if (!form) return;
    
    const formElements = Array.from(form.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    ));
    
    const currentIndex = formElements.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    
    if (direction === 'up' || direction === 'left') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'down' || direction === 'right') {
      nextIndex = Math.min(formElements.length - 1, currentIndex + 1);
    }
    
    if (nextIndex !== currentIndex) {
      (formElements[nextIndex] as HTMLElement).focus();
    }
  };

  const handleEnterAction = () => {
    const activeElement = document.activeElement as HTMLElement;
    
    if (activeElement?.tagName === 'BUTTON' || activeElement?.getAttribute('role') === 'button') {
      activeElement.click();
    }
  };

  const handleSpaceAction = () => {
    const activeElement = document.activeElement as HTMLElement;
    
    if (activeElement?.tagName === 'BUTTON' || activeElement?.getAttribute('role') === 'button') {
      activeElement.click();
    }
  };

  const handleEscapeAction = () => {
    // Close modals, go back, or cancel current action
    const modal = document.querySelector('[role="dialog"]:not([hidden])');
    if (modal) {
      const closeButton = modal.querySelector('[data-close]') as HTMLElement;
      closeButton?.click();
      return;
    }
    
    // If no modal, trigger back navigation
    // This would need to be connected to the actual navigation system
  };

  const showKeyboardHelp = () => {
    // This would trigger showing the keyboard shortcuts help dialog
    console.log('Keyboard shortcuts:', shortcuts.map(s => s.description));
  };

  // Set up event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with inputs unless it's a global shortcut
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (event.target as HTMLElement).tagName
      );
      
      const matchedShortcut = shortcuts.find(shortcut => {
        if (!event.key || !shortcut.key) return false;
        
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!event.ctrlKey === !!shortcut.ctrlKey;
        const altMatches = !!event.altKey === !!shortcut.altKey;
        const shiftMatches = !!event.shiftKey === !!shortcut.shiftKey;
        
        return keyMatches && ctrlMatches && altMatches && shiftMatches;
      });

      if (matchedShortcut) {
        // Allow global shortcuts even when input is focused
        const isGlobalShortcut = matchedShortcut.ctrlKey || matchedShortcut.altKey;
        
        if (!isInputFocused || isGlobalShortcut) {
          event.preventDefault();
          matchedShortcut.action();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config, shortcuts]);

  // Track focus changes
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement as HTMLElement;
      
      if (activeElement && activeElement !== document.body) {
        lastFocusedElement.current = activeElement;
        
        // Update navigation state based on focused element
        const section = activeElement.closest('[data-section]')?.getAttribute('data-section');
        setNavState(prev => ({
          ...prev,
          activeElement: activeElement.id || activeElement.className,
          focusedSection: section as NavigationState['focusedSection'],
          isNavigating: true,
        }));
      }
    };

    document.addEventListener('focusin', handleFocusChange);
    return () => document.removeEventListener('focusin', handleFocusChange);
  }, []);

  return {
    navState,
    shortcuts: shortcuts.map(s => s.description),
    focusElement: (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      element?.focus();
    },
    restoreLastFocus: () => {
      lastFocusedElement.current?.focus();
    },
  };
};