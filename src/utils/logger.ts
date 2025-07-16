interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  context?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private sessionId = crypto.randomUUID();

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, userId } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const contextStr = context ? ` [${context}]` : '';
    const userStr = userId ? ` [User: ${userId}]` : '';
    
    return `${prefix}${contextStr}${userStr} ${message}`;
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    data?: any,
    context?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context,
      sessionId: this.sessionId,
      userId: this.getCurrentUserId()
    };
  }

  private getCurrentUserId(): string | undefined {
    // Tentar obter ID do usuário do contexto de autenticação
    try {
      const userString = localStorage.getItem('sb-qxlvzbvzajibdtlzngdy-auth-token');
      if (userString) {
        const userData = JSON.parse(userString);
        return userData?.user?.id;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private async sendToSupabase(entry: LogEntry) {
    if (!this.isDevelopment) {
      try {
        // Em produção, enviar para edge function de logging
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (error) {
        console.warn('Falha ao enviar log para Supabase:', error);
      }
    }
  }

  info(message: string, data?: any, context?: string) {
    const entry = this.createLogEntry('info', message, data, context);
    
    if (this.isDevelopment) {
      console.info(this.formatLog(entry), data || '');
    }
    
    this.sendToSupabase(entry);
  }

  warn(message: string, data?: any, context?: string) {
    const entry = this.createLogEntry('warn', message, data, context);
    
    if (this.isDevelopment) {
      console.warn(this.formatLog(entry), data || '');
    }
    
    this.sendToSupabase(entry);
  }

  error(message: string, error?: Error | any, context?: string) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;
    
    const entry = this.createLogEntry('error', message, errorData, context);
    
    if (this.isDevelopment) {
      console.error(this.formatLog(entry), errorData || '');
    }
    
    this.sendToSupabase(entry);
  }

  debug(message: string, data?: any, context?: string) {
    if (this.isDevelopment) {
      const entry = this.createLogEntry('debug', message, data, context);
      console.debug(this.formatLog(entry), data || '');
    }
  }

  // Métodos específicos para contextos da aplicação
  scheduling = {
    create: (data: any) => this.info('Agendamento criado', data, 'SCHEDULING'),
    update: (data: any) => this.info('Agendamento atualizado', data, 'SCHEDULING'),
    delete: (data: any) => this.info('Agendamento cancelado', data, 'SCHEDULING'),
    error: (error: any, operation: string) => 
      this.error(`Erro em agendamento: ${operation}`, error, 'SCHEDULING')
  };

  auth = {
    login: (userId: string) => this.info('Login realizado', { userId }, 'AUTH'),
    logout: (userId: string) => this.info('Logout realizado', { userId }, 'AUTH'),
    error: (error: any, operation: string) => 
      this.error(`Erro de autenticação: ${operation}`, error, 'AUTH')
  };

  performance = {
    measure: (operation: string, duration: number) => 
      this.info(`Performance: ${operation}`, { duration }, 'PERFORMANCE'),
    slowQuery: (query: string, duration: number) => 
      this.warn(`Query lenta detectada: ${query}`, { duration }, 'PERFORMANCE')
  };
}

export const logger = new Logger();
export default logger;