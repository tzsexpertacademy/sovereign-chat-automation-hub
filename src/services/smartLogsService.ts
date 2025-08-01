/**
 * SISTEMA DE LOGS INTELIGENTE - VERSÃO CLEAN
 * 
 * Sistema de logs por níveis com controle de ambiente
 * - PRODUÇÃO: apenas errors críticos
 * - DESENVOLVIMENTO: logs detalhados  
 * - Performance otimizada com buffer assíncrono
 */

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export type LogComponent = 'AUDIO' | 'MESSAGE' | 'REALTIME' | 'API' | 'MEDIA' | 'SYSTEM' | 'UI';

export interface SmartLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  component: LogComponent;
  message: string;
  data?: any;
  context?: {
    ticketId?: string;
    messageId?: string;
    instanceId?: string;
    clientId?: string;
  };
}

class SmartLogsService {
  private isDevelopment = import.meta.env.DEV;
  private logs: SmartLogEntry[] = [];
  private buffer: SmartLogEntry[] = [];
  private maxLogs = this.isDevelopment ? 500 : 50;
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startAsyncFlush();
  }

  /**
   * LOG CRÍTICO - SEMPRE VISÍVEL EM PRODUÇÃO E DESENVOLVIMENTO
   */
  error(component: LogComponent, message: string, data?: any, context?: SmartLogEntry['context']) {
    this.addLog('ERROR', component, message, data, context);
    
    // Em produção, errors são enviados imediatamente ao console
    if (!this.isDevelopment) {
      console.error(`[${component}] ${message}`, data);
    }
  }

  /**
   * LOG DE AVISO - APENAS EM DESENVOLVIMENTO
   */
  warn(component: LogComponent, message: string, data?: any, context?: SmartLogEntry['context']) {
    if (this.isDevelopment) {
      this.addLog('WARN', component, message, data, context);
    }
  }

  /**
   * LOG INFORMATIVO - APENAS EM DESENVOLVIMENTO
   */
  info(component: LogComponent, message: string, data?: any, context?: SmartLogEntry['context']) {
    if (this.isDevelopment) {
      this.addLog('INFO', component, message, data, context);
    }
  }

  /**
   * LOG DE DEBUG - APENAS EM DESENVOLVIMENTO
   */
  debug(component: LogComponent, message: string, data?: any, context?: SmartLogEntry['context']) {
    if (this.isDevelopment) {
      this.addLog('DEBUG', component, message, data, context);
    }
  }

  /**
   * ADICIONAR LOG AO BUFFER (ASSÍNCRONO)
   */
  private addLog(level: LogLevel, component: LogComponent, message: string, data?: any, context?: SmartLogEntry['context']) {
    const logEntry: SmartLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      component,
      message,
      data,
      context
    };

    // Buffer assíncrono para não bloquear UI
    this.buffer.push(logEntry);
  }

  /**
   * FLUSH ASSÍNCRONO DO BUFFER
   */
  private startAsyncFlush() {
    this.flushInterval = setInterval(() => {
      if (this.buffer.length > 0) {
        // Mover buffer para logs principais
        this.logs.unshift(...this.buffer);
        this.buffer = [];

        // Limitar tamanho dos logs
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(0, this.maxLogs);
        }
      }
    }, 1000); // Flush a cada 1 segundo
  }

  /**
   * OBTER LOGS FILTRADOS
   */
  getLogs(filters?: {
    level?: LogLevel;
    component?: LogComponent;
    search?: string;
    startTime?: number;
    endTime?: number;
  }): SmartLogEntry[] {
    let filtered = [...this.logs];

    if (filters) {
      if (filters.level) {
        filtered = filtered.filter(log => log.level === filters.level);
      }
      
      if (filters.component) {
        filtered = filtered.filter(log => log.component === filters.component);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(log => 
          log.message.toLowerCase().includes(search) ||
          log.component.toLowerCase().includes(search)
        );
      }
      
      if (filters.startTime) {
        filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
      }
      
      if (filters.endTime) {
        filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
      }
    }

    return filtered;
  }

  /**
   * ESTATÍSTICAS DOS LOGS
   */
  getStats() {
    return {
      total: this.logs.length,
      errors: this.logs.filter(l => l.level === 'ERROR').length,
      warnings: this.logs.filter(l => l.level === 'WARN').length,
      info: this.logs.filter(l => l.level === 'INFO').length,
      debug: this.logs.filter(l => l.level === 'DEBUG').length,
      isDevelopment: this.isDevelopment
    };
  }

  /**
   * EXPORTAR LOGS PARA DEBUG
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.getLogs();
    
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }
    
    // CSV
    const headers = ['Timestamp', 'Level', 'Component', 'Message', 'Context'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.component,
      log.message,
      JSON.stringify(log.context || {})
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * LIMPAR LOGS
   */
  clear() {
    this.logs = [];
    this.buffer = [];
  }

  /**
   * CLEANUP DO SERVIÇO
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

export const smartLogs = new SmartLogsService();