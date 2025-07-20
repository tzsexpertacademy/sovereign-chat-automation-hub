
// Dynamic Server Configuration Service
interface ServerConfig {
  // Primary Backend Configuration
  serverUrl: string;
  host: string;
  port: number;
  protocol: 'https' | 'http';
  basePath: string;
  
  // Authentication & Security
  globalApiKey: string;
  jwtSecret: string;
  requestTimeout: number;
  retryAttempts: number;
  
  // Advanced Configuration
  webSocketEnabled: boolean;
  webSocketPort?: number;
  corsEnabled: boolean;
  sslRequired: boolean;
  environment: 'development' | 'production' | 'staging';
  
  // Backup/Fallback Configuration
  fallbackServerUrl?: string;
  offlineMode: boolean;
  configCache: boolean;
  
  // Metadata
  lastUpdated: string;
  version: string;
}

interface ServerStatus {
  isOnline: boolean;
  latency: number;
  lastCheck: string;
  error?: string;
}

class ServerConfigService {
  private static instance: ServerConfigService;
  private config: ServerConfig;
  private status: ServerStatus;
  private listeners: Array<(config: ServerConfig) => void> = [];

  private constructor() {
    this.config = this.getDefaultConfig();
    this.status = {
      isOnline: false,
      latency: 0,
      lastCheck: new Date().toISOString()
    };
    this.loadConfig();
  }

  static getInstance(): ServerConfigService {
    if (!ServerConfigService.instance) {
      ServerConfigService.instance = new ServerConfigService();
    }
    return ServerConfigService.instance;
  }

  private getDefaultConfig(): ServerConfig {
    return {
      // Primary Backend
      serverUrl: 'https://yumer.yumerflow.app:8083',
      host: 'yumer.yumerflow.app',
      port: 8083,
      protocol: 'https',
      basePath: '',
      
      // Authentication
      globalApiKey: 'df1afd525fs5f15',
      jwtSecret: 'sfdgs8152g5s1s5',
      requestTimeout: 10000,
      retryAttempts: 3,
      
      // Advanced
      webSocketEnabled: true,
      corsEnabled: true,
      sslRequired: true,
      environment: 'production',
      
      // Backup
      offlineMode: false,
      configCache: true,
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('yumer_server_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...this.getDefaultConfig(), ...parsed };
        console.log('🔧 Configuração do servidor carregada:', this.config);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configuração:', error);
      this.config = this.getDefaultConfig();
    }
  }

  private saveConfig(): void {
    try {
      this.config.lastUpdated = new Date().toISOString();
      localStorage.setItem('yumer_server_config', JSON.stringify(this.config));
      console.log('💾 Configuração salva:', this.config);
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
    }
  }

  // Public API
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  async testConnection(): Promise<ServerStatus> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Testando conexão com: ${this.config.serverUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
      
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-API-Key': this.config.globalApiKey
        }
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      this.status = {
        isOnline: response.ok,
        latency,
        lastCheck: new Date().toISOString(),
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
      
      console.log(`✅ Teste de conexão concluído:`, this.status);
      
    } catch (error: any) {
      this.status = {
        isOnline: false,
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message || 'Connection failed'
      };
      
      console.error('❌ Teste de conexão falhou:', this.status);
    }
    
    return this.status;
  }

  getStatus(): ServerStatus {
    return { ...this.status };
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson);
      this.config = { ...this.getDefaultConfig(), ...imported };
      this.saveConfig();
      return true;
    } catch (error) {
      console.error('❌ Erro ao importar configuração:', error);
      return false;
    }
  }

  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  // Event listeners
  subscribe(listener: (config: ServerConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('❌ Erro no listener de configuração:', error);
      }
    });
  }

  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Validate URL format
    try {
      new URL(this.config.serverUrl);
    } catch {
      errors.push('URL do servidor inválida');
    }
    
    // Validate port
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Porta deve estar entre 1 e 65535');
    }
    
    // Validate API key
    if (!this.config.globalApiKey.trim()) {
      errors.push('Chave API global é obrigatória');
    }
    
    // Test connection
    await this.testConnection();
    if (!this.status.isOnline) {
      errors.push(`Conexão falhou: ${this.status.error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Generate URLs based on current config
  getApiUrl(): string {
    return `${this.config.serverUrl}${this.config.basePath}`;
  }

  getWebSocketUrl(): string {
    const protocol = this.config.protocol === 'https' ? 'wss' : 'ws';
    const port = this.config.webSocketPort || this.config.port;
    return `${protocol}://${this.config.host}:${port}${this.config.basePath}`;
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': this.config.globalApiKey
    };
  }
}

export const serverConfigService = ServerConfigService.getInstance();
export type { ServerConfig, ServerStatus };
