/**
 * Utilitários para detecção de navegador e problemas específicos
 */

export interface BrowserInfo {
  name: string;
  version: string;
  isChrome: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isMobile: boolean;
  hasKnownIssues: boolean;
  knownIssues: string[];
}

export const detectBrowser = (): BrowserInfo => {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor;
  
  let name = 'Unknown';
  let version = 'Unknown';
  let isChrome = false;
  let isFirefox = false;
  let isSafari = false;
  let isEdge = false;
  
  // Chrome
  if (userAgent.includes('Chrome') && vendor.includes('Google')) {
    isChrome = true;
    name = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Firefox
  else if (userAgent.includes('Firefox')) {
    isFirefox = true;
    name = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Safari
  else if (userAgent.includes('Safari') && vendor.includes('Apple')) {
    isSafari = true;
    name = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Edge
  else if (userAgent.includes('Edg')) {
    isEdge = true;
    name = 'Edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Problemas conhecidos por navegador
  const knownIssues: string[] = [];
  let hasKnownIssues = false;
  
  if (isChrome) {
    // Chrome tem problemas conhecidos com removeChild em certas versões
    const chromeVersion = parseInt(version);
    if (chromeVersion >= 120) {
      knownIssues.push('Erro "removeChild" em algumas extensões');
      knownIssues.push('Problemas com cache agressivo');
      hasKnownIssues = true;
    }
  }
  
  if (isSafari) {
    knownIssues.push('Limitações com localStorage em modo privado');
    hasKnownIssues = true;
  }
  
  return {
    name,
    version,
    isChrome,
    isFirefox,
    isSafari,
    isEdge,
    isMobile,
    hasKnownIssues,
    knownIssues
  };
};

export const getBrowserSpecificSolutions = (browserInfo: BrowserInfo): string[] => {
  const solutions: string[] = [];
  
  if (browserInfo.isChrome) {
    solutions.push('Desative extensões temporariamente');
    solutions.push('Use uma aba anônima para testar');
    solutions.push('Limpe o cache e dados do site');
    solutions.push('Atualize o Chrome para a versão mais recente');
  }
  
  if (browserInfo.isFirefox) {
    solutions.push('Desative add-ons temporariamente');
    solutions.push('Use uma janela privada para testar');
    solutions.push('Limpe cookies e cache');
  }
  
  if (browserInfo.isSafari) {
    solutions.push('Verifique se não está em modo privado');
    solutions.push('Limpe dados do website');
    solutions.push('Atualize o Safari');
  }
  
  if (browserInfo.isEdge) {
    solutions.push('Desative extensões');
    solutions.push('Use uma janela InPrivate');
    solutions.push('Limpe dados de navegação');
  }
  
  // Soluções gerais
  solutions.push('Tente outro navegador (Chrome, Firefox, Safari)');
  solutions.push('Reinicie o navegador completamente');
  
  return solutions;
};

export const isProblematicBrowserVersion = (browserInfo: BrowserInfo): boolean => {
  if (browserInfo.isChrome) {
    const version = parseInt(browserInfo.version);
    // Versões do Chrome com problemas conhecidos de DOM
    return version >= 120 && version <= 130;
  }
  
  return false;
};

export const logBrowserInfo = (): void => {
  const browserInfo = detectBrowser();
  
  console.log('🌐 Informações do Navegador:', {
    nome: browserInfo.name,
    versao: browserInfo.version,
    mobile: browserInfo.isMobile,
    problemasConhecidos: browserInfo.hasKnownIssues,
    issues: browserInfo.knownIssues,
    userAgent: navigator.userAgent.substring(0, 100) + '...'
  });
};