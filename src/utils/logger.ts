import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  context?: string;
  userId?: string;
  sessionId?: string;
  clienteId?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private sessionId = crypto.randomUUID();
  private clienteIdCache: { value: string | null; timestamp: number } | null = null;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, userId } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const contextStr = context ? ` [${context}]` : '';
    const userStr = userId ? ` [User: ${userId}]` : '';
    
    return `${prefix}${contextStr}${userStr} ${message}`;
  }

  private async getClienteId(): Promise<string | null> {
    const now = Date.now();
    if (this.clienteIdCache && (now - this.clienteIdCache.timestamp) < this.CACHE_TTL) {
      return this.clienteIdCache.value;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('user_id', user.id)
        .single();

      const clienteId = profile?.cliente_id || null;
      this.clienteIdCache = { value: clienteId, timestamp: now };
      return clienteId;
    } catch {
      return null;
    }
  }

  private getCurrentUserId(): string | undefined {
    try {
      const storageKey = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qxlvzbvzajibdtlzngdy'}-auth-token`;
      const userString = localStorage.getItem(storageKey);
      if (userString) {
        const userData = JSON.parse(userString);
        return userData?.user?.id;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private async createLogEntry(
    level: LogEntry['level'],
    message: string,
    data?: any,
    context?: string
  ): Promise<LogEntry> {
    const clienteId = await this.getClienteId();
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context,
      sessionId: this.sessionId,
      userId: this.getCurrentUserId(),
      clienteId: clienteId || undefined,
    };
  }

  private async sendToSupabase(entry: LogEntry) {
    if (!this.isDevelopment) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qxlvzbvzajibdtlzngdy';
        const url = `https://${projectId}.supabase.co/functions/v1/system-logs`;

        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          },
          body: JSON.stringify(entry),
        });
      } catch (error) {
        console.warn('Falha ao enviar log para Supabase:', error);
      }
    }
  }

  info(message: string, data?: any, context?: string) {
    if (this.isDevelopment) {
      const syncEntry = {
        timestamp: new Date().toISOString(),
        level: 'info' as const,
        message,
        data,
        context,
        sessionId: this.sessionId,
        userId: this.getCurrentUserId(),
      };
      console.info(this.formatLog(syncEntry), data || '');
    }

    this.createLogEntry('info', message, data, context).then(entry => this.sendToSupabase(entry));
  }

  warn(message: string, data?: any, context?: string) {
    if (this.isDevelopment) {
      const syncEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn' as const,
        message,
        data,
        context,
        sessionId: this.sessionId,
        userId: this.getCurrentUserId(),
      };
      console.warn(this.formatLog(syncEntry), data || '');
    }

    this.createLogEntry('warn', message, data, context).then(entry => this.sendToSupabase(entry));
  }

  error(message: string, error?: Error | any, context?: string) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    if (this.isDevelopment) {
      const syncEntry = {
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        message,
        data: errorData,
        context,
        sessionId: this.sessionId,
        userId: this.getCurrentUserId(),
      };
      console.error(this.formatLog(syncEntry), errorData || '');
    }

    this.createLogEntry('error', message, errorData, context).then(entry => this.sendToSupabase(entry));
  }

  debug(message: string, data?: any, context?: string) {
    if (this.isDevelopment) {
      const syncEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug' as const,
        message,
        data,
        context,
        sessionId: this.sessionId,
        userId: this.getCurrentUserId(),
      };
      console.debug(this.formatLog(syncEntry), data || '');
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
