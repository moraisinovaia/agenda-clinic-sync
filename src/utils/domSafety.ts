/**
 * Utilitários para operações DOM seguras
 */

export const safeRemoveChild = (parent: Node, child: Node): boolean => {
  try {
    if (parent && child && parent.contains(child) && document.contains(parent)) {
      parent.removeChild(child);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('⚠️ Erro ao remover elemento DOM:', error);
    return false;
  }
};

export const safeAppendChild = (parent: Node, child: Node): boolean => {
  try {
    if (parent && child && document.contains(parent)) {
      parent.appendChild(child);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('⚠️ Erro ao adicionar elemento DOM:', error);
    return false;
  }
};

export const isElementInDOM = (element: Node | null): boolean => {
  if (!element) return false;
  return document.contains(element);
};

export const waitForElement = (selector: string, timeout = 5000): Promise<Element | null> => {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
};

/**
 * Hook para cleanup seguro de event listeners
 */
export const createSafeEventListener = (
  element: Element | Document | Window,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
) => {
  if (!element || !handler) return () => {};

  element.addEventListener(event, handler, options);
  
  return () => {
    try {
      if (element && 'removeEventListener' in element) {
        element.removeEventListener(event, handler, options);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao remover event listener:', error);
    }
  };
};