
// Sistema de gestão de conexão com heartbeat e reconexão automática

import { getConfig, reloadConfig } from '@/config/environment';

export interface ConnectionStatus {
  isConnected: boolean;
  serverUrl: string;
  protocol: string;
  lastHeartbeat: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

class ConnectionManager {
  private status: ConnectionStatus = {
    isConnected: false,
    serverUrl: '',
    protocol: 'http',
    lastHeartbeat: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
  };

  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Array<(status: ConnectionStatus) => void> = [];

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      const config = await getConfig();
      this.status.serverUrl = config.serverUrl;
      this.status.protocol = config.protocol;
      
      await this.testConnection();
      this.startHeartbeat();
    } catch (error) {
      console.error('❌ Erro ao inicializar conexão:', error);
      this.handleConnectionError();
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${this.status.serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        this.status.isConnected = true;
        this.status.lastHeartbeat = Date.now();
        this.status.reconnectAttempts = 0;
        this.notifyListeners();
        console.log('✅ Conexão estabelecida com sucesso');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Teste de conexão falhou:', error);
      this.status.isConnected = false;
      this.notifyListeners();
      return false;
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      const isConnected = await this.testConnection();
      
      if (!isConnected) {
        console.warn('⚠️ Heartbeat falhou, iniciando reconexão...');
        this.handleConnectionError();
      }
    }, 30000); // Heartbeat a cada 30 segundos
  }

  private async handleConnectionError() {
    if (this.status.reconnectAttempts >= this.status.maxReconnectAttempts) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
      return;
    }

    this.status.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.status.reconnectAttempts), 30000);
    
    console.log(`🔄 Tentativa de reconexão ${this.status.reconnectAttempts}/${this.status.maxReconnectAttempts} em ${delay}ms`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Recarregar configuração para tentar servidor alternativo
        await reloadConfig();
        const newConfig = await getConfig();
        
        if (newConfig.serverUrl !== this.status.serverUrl) {
          console.log(`🔄 Tentando servidor alternativo: ${newConfig.serverUrl}`);
          this.status.serverUrl = newConfig.serverUrl;
          this.status.protocol = newConfig.protocol;
        }
        
        const connected = await this.testConnection();
        if (connected) {
          console.log('✅ Reconexão bem-sucedida');
          this.startHeartbeat();
        } else {
          this.handleConnectionError();
        }
      } catch (error) {
        console.error('❌ Erro na reconexão:', error);
        this.handleConnectionError();
      }
    }, delay);
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.listeners.push(callback);
    // Notificar status atual imediatamente
    callback(this.status);
  }

  public removeListener(callback: (status: ConnectionStatus) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('❌ Erro ao notificar listener:', error);
      }
    });
  }

  public getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  public async forceReconnect() {
    console.log('🔄 Forçando reconexão...');
    this.status.reconnectAttempts = 0;
    await this.handleConnectionError();
  }

  public destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.listeners = [];
  }
}

// Singleton
export const connectionManager = new ConnectionManager();
