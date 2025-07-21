
import { supabase } from "@/integrations/supabase/client";
import { yumerWhatsappService } from "./yumerWhatsappService";

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success" | "debug";
  component: string;
  instanceId?: string;
  message: string;
  details?: string;
  metadata?: Record<string, any>;
  source: "frontend" | "supabase" | "yumer" | "system";
}

class SystemLogsService {
  private logs: SystemLogEntry[] = [];
  private logBuffer: SystemLogEntry[] = [];
  private listeners: ((logs: SystemLogEntry[]) => void)[] = [];

  constructor() {
    this.initializeConsoleInterceptor();
    this.startLogCollection();
  }

  // Interceptar logs do console para capturar logs do frontend
  private initializeConsoleInterceptor() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    console.log = (...args) => {
      this.addLog({
        level: "info",
        component: "Frontend Console",
        message: args.join(" "),
        source: "frontend"
      });
      originalConsole.log(...args);
    };

    console.info = (...args) => {
      this.addLog({
        level: "info",
        component: "Frontend Console",
        message: args.join(" "),
        source: "frontend"
      });
      originalConsole.info(...args);
    };

    console.warn = (...args) => {
      this.addLog({
        level: "warning",
        component: "Frontend Console",
        message: args.join(" "),
        source: "frontend"
      });
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.addLog({
        level: "error",
        component: "Frontend Console",
        message: args.join(" "),
        source: "frontend"
      });
      originalConsole.error(...args);
    };

    console.debug = (...args) => {
      this.addLog({
        level: "debug",
        component: "Frontend Console",
        message: args.join(" "),
        source: "frontend"
      });
      originalConsole.debug(...args);
    };
  }

  // Adicionar log ao sistema
  private addLog(logData: Partial<SystemLogEntry>) {
    const log: SystemLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: logData.level || "info",
      component: logData.component || "Unknown",
      instanceId: logData.instanceId,
      message: logData.message || "",
      details: logData.details,
      metadata: logData.metadata,
      source: logData.source || "system"
    };

    this.logs.unshift(log);
    this.logBuffer.unshift(log);

    // Limitar logs em memória para performance
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }

    // Notificar listeners
    this.notifyListeners();
  }

  // Coletar logs do YUMER
  private async collectYumerLogs() {
    try {
      // Simular busca de logs do YUMER - em produção seria uma chamada real
      const mockYumerLogs = [
        {
          level: "info" as const,
          component: "YUMER Instance",
          message: "Instância conectada com sucesso",
          details: "Session estabelecida no servidor yumer.yumerflow.app:8083",
          source: "yumer" as const,
          instanceId: "instance_001"
        },
        {
          level: "success" as const,
          component: "YUMER Message",
          message: "Mensagem enviada com sucesso",
          details: "Destino: +5511999999999, Tipo: text",
          source: "yumer" as const,
          instanceId: "instance_002"
        },
        {
          level: "warning" as const,
          component: "YUMER QR",
          message: "QR Code prestes a expirar",
          details: "Tempo restante: 2 minutos",
          source: "yumer" as const,
          instanceId: "instance_003"
        },
        {
          level: "error" as const,
          component: "YUMER Connection",
          message: "Falha na conexão com WhatsApp",
          details: "WebSocket error: Connection refused",
          source: "yumer" as const,
          instanceId: "instance_004"
        }
      ];

      mockYumerLogs.forEach(log => this.addLog(log));
    } catch (error) {
      this.addLog({
        level: "error",
        component: "YUMER Service",
        message: "Erro ao coletar logs do YUMER",
        details: error instanceof Error ? error.message : String(error),
        source: "system"
      });
    }
  }

  // Coletar logs do Supabase
  private async collectSupabaseLogs() {
    try {
      // Simular logs do Supabase baseados em atividade real
      const activities = [
        {
          level: "info" as const,
          component: "Supabase Auth",
          message: "Usuário autenticado com sucesso",
          details: "Session estabelecida",
          source: "supabase" as const
        },
        {
          level: "info" as const,
          component: "Supabase Database",
          message: "Query executada com sucesso",
          details: "SELECT * FROM whatsapp_instances",
          source: "supabase" as const
        },
        {
          level: "success" as const,
          component: "Supabase Edge Function",
          message: "Function executada com sucesso",
          details: "yumer-webhook processado",
          source: "supabase" as const
        }
      ];

      activities.forEach(log => this.addLog(log));
    } catch (error) {
      this.addLog({
        level: "error",
        component: "Supabase Service",
        message: "Erro ao coletar logs do Supabase",
        details: error instanceof Error ? error.message : String(error),
        source: "system"
      });
    }
  }

  // Iniciar coleta automática de logs
  private startLogCollection() {
    // Coletar logs iniciais
    this.collectYumerLogs();
    this.collectSupabaseLogs();

    // Configurar coleta periódica
    setInterval(() => {
      this.collectYumerLogs();
      this.collectSupabaseLogs();
    }, 30000); // A cada 30 segundos
  }

  // Registrar listener para mudanças
  public onLogsUpdate(callback: (logs: SystemLogEntry[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Notificar listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  // Obter logs filtrados
  public getLogs(filters?: {
    level?: string;
    component?: string;
    source?: string;
    instanceId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): SystemLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.level && filters.level !== "all") {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level);
      }

      if (filters.component && filters.component !== "all") {
        filteredLogs = filteredLogs.filter(log => log.component === filters.component);
      }

      if (filters.source && filters.source !== "all") {
        filteredLogs = filteredLogs.filter(log => log.source === filters.source);
      }

      if (filters.instanceId) {
        filteredLogs = filteredLogs.filter(log => log.instanceId === filters.instanceId);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          log.component.toLowerCase().includes(searchLower) ||
          log.details?.toLowerCase().includes(searchLower)
        );
      }

      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filters.startDate!
        );
      }

      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= filters.endDate!
        );
      }
    }

    return filteredLogs;
  }

  // Obter estatísticas dos logs
  public getLogStats(): {
    total: number;
    errors: number;
    warnings: number;
    success: number;
    info: number;
    debug: number;
  } {
    return {
      total: this.logs.length,
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warning').length,
      success: this.logs.filter(l => l.level === 'success').length,
      info: this.logs.filter(l => l.level === 'info').length,
      debug: this.logs.filter(l => l.level === 'debug').length
    };
  }

  // Exportar logs
  public exportLogs(format: 'csv' | 'json' = 'csv', filters?: any): string {
    const logs = this.getLogs(filters);
    
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'Level', 'Component', 'Source', 'Instance', 'Message', 'Details'];
    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp,
        log.level,
        log.component,
        log.source,
        log.instanceId || '',
        `"${log.message.replace(/"/g, '""')}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  // Limpar logs
  public clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }
}

export const systemLogsService = new SystemLogsService();
