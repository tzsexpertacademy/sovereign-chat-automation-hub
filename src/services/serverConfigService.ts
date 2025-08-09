
// Dynamic Server Configuration Service
interface ServerConfig {
  // Primary Backend Configuration - CodeChat API v2.2.1
  serverUrl: string;
  host: string;
  port: number;
  protocol: 'https' | 'http';
  basePath: string;
  apiVersion: string;
  
  // Authentication & Security - v2.2.1
  adminToken: string;
  globalApiKey: string;
  jwtSecret: string;
  sessionSecret: string;
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
  
  // Frontend Integration
  lovableDomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  corsOrigins: string[];
  rateLimitRequests: number;
  rateLimitWindow: number;
  
  // Administrative Webhooks - v2.2.1
  adminWebhooks: {
    qrCodeWebhook: {
      enabled: boolean;
      url: string;
      events: string[];
      headers: Record<string, string>;
      retryAttempts: number;
      timeout: number;
    };
    messageWebhook: {
      enabled: boolean;
      url: string;
      events: string[];
      authentication: 'bearer' | 'apikey' | 'none';
      secret: string;
    };
    statusWebhook: {
      enabled: boolean;
      url: string;
      events: string[];
    };
  };
  
  // Metadata
  lastUpdated: string;
  version: string;
  configVersion: number; // NEW: Para controle de migração
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
  private backupConfig: ServerConfig | null = null;
  private readonly CURRENT_CONFIG_VERSION = 2; // Versão atual da configuração

  private constructor() {
    this.config = this.getDefaultConfig();
    this.status = {
      isOnline: false,
      latency: 0,
      lastCheck: new Date().toISOString()
    };
    this.loadConfigWithMigration();
  }

  static getInstance(): ServerConfigService {
    if (!ServerConfigService.instance) {
      ServerConfigService.instance = new ServerConfigService();
    }
    return ServerConfigService.instance;
  }

  private getDefaultConfig(): ServerConfig {
    return {
      // Primary Backend - CodeChat API v2.2.1 - VERSÃO CORRETA DO SERVIDOR
      serverUrl: 'https://api.yumer.com.br',
      host: 'api.yumer.com.br',
      port: 443,
      protocol: 'https',
      basePath: '/api/v2',
      apiVersion: 'v2.2.1',
      
      // Authentication - CodeChat API v2.2.1 - TOKENS OFICIAIS DO SERVIDOR
      adminToken: 'qTtC8k3M%9zAPfXw7vKmDrLzNqW@ea45JgyZhXpULBvydM67s3TuWKC!$RMo1FnB',
      globalApiKey: 'qTtC8k3M%9zAPfXw7vKmDrLzNqW@ea45JgyZhXpULBvydM67s3TuWKC!$RMo1FnB',
      jwtSecret: 'eZf#9vPpGq^3x@ZbWcNvJskH*mL74DwYcFgxKwUaTrpQgzVe',
      sessionSecret: 'M^r6Z!Lp9vAqTrXc@kYwFh#D2zGjTbUq',
      requestTimeout: 15000,
      retryAttempts: 3,
      
      // Advanced
      webSocketEnabled: true,
      corsEnabled: true,
      sslRequired: true,
      environment: 'production',
      
      // Backup
      offlineMode: false,
      configCache: true,
      
      // Frontend Integration - CORS corrigido para ambos domínios Lovable
      lovableDomain: 'https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app',
      supabaseUrl: 'https://ymygyagbvbsdfkduxmgu.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI',
      corsOrigins: [
        'https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app',
        'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
        'https://ymygyagbvbsdfkduxmgu.supabase.co',
        'http://localhost:3000',
        'http://localhost:8080'
      ],
      rateLimitRequests: 100,
      rateLimitWindow: 60,
      
      // Administrative Webhooks - CodeChat API v2.2.1 - ENDPOINTS CORRETOS
      adminWebhooks: {
        qrCodeWebhook: {
          enabled: true,
          url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook',
          events: ['qrcodeUpdated', 'qr.updated', 'QR_CODE_UPDATED'],
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI'
          },
          retryAttempts: 3,
          timeout: 15000
        },
        messageWebhook: {
          enabled: true,
          url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/message-processor',
          events: ['messagesUpsert', 'sendMessage', 'messages.upsert'],
          authentication: 'bearer',
          secret: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI'
        },
        statusWebhook: {
          enabled: true,
          url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook',
          events: ['connectionUpdated', 'statusInstance', 'connection.update']
        }
      },
      
      // Metadata - ATUALIZADO PARA v2.2.1
      lastUpdated: new Date().toISOString(),
      version: 'v2.2.1',
      configVersion: 2
    };
  }

  private loadConfigWithMigration(): void {
    try {
      const stored = localStorage.getItem('yumer_server_config');
      
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Verificar se é uma configuração antiga que precisa ser migrada
        if (this.needsMigration(parsed)) {
          console.log('🔄 Detectada configuração antiga. Iniciando migração automática para CodeChat v2.2.1...');
          this.migrateOldConfig(parsed);
        } else {
          this.config = { ...this.getDefaultConfig(), ...parsed };
          console.log('✅ Configuração CodeChat v2.2.1 carregada:', this.config);
        }
      } else {
        console.log('🆕 Primeira execução - aplicando configuração padrão CodeChat v2.2.1');
        this.config = this.getDefaultConfig();
        this.saveConfig();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configuração, aplicando padrões:', error);
      this.forceResetToDefaults();
    }
  }

  private needsMigration(config: any): boolean {
    const oldIndicators = [
      config.serverUrl?.includes('yumer.yumerflow.app'),
      config.host?.includes('yumer.yumerflow.app'),
      config.port === 8083,
      config.basePath === '',
      !config.configVersion || config.configVersion < this.CURRENT_CONFIG_VERSION
    ];
    
    return oldIndicators.some(indicator => indicator);
  }

  private migrateOldConfig(oldConfig: any): void {
    console.log('🔧 Migrando configuração antiga para CodeChat API v2.2.1...');
    
    // Preservar apenas configurações customizadas válidas (não relacionadas ao servidor)
    const preservableSettings = {
      environment: oldConfig.environment,
      requestTimeout: oldConfig.requestTimeout,
      retryAttempts: oldConfig.retryAttempts,
      webSocketEnabled: oldConfig.webSocketEnabled,
      corsEnabled: oldConfig.corsEnabled,
      sslRequired: oldConfig.sslRequired,
      offlineMode: oldConfig.offlineMode,
      configCache: oldConfig.configCache,
      // Preservar integrações frontend se não forem padrão
      ...(oldConfig.lovableDomain && !oldConfig.lovableDomain.includes('lovableproject.com') && {
        lovableDomain: oldConfig.lovableDomain
      }),
      ...(oldConfig.supabaseUrl && !oldConfig.supabaseUrl.includes('supabase.co') && {
        supabaseUrl: oldConfig.supabaseUrl
      })
    };
    
    // Aplicar novos padrões + configurações preservadas
    this.config = {
      ...this.getDefaultConfig(),
      ...preservableSettings,
      configVersion: this.CURRENT_CONFIG_VERSION
    };
    
    // Salvar configuração migrada
    this.saveConfig();
    
    console.log('✅ Migração concluída para CodeChat API v2.2.1:', {
      serverUrl: this.config.serverUrl,
      host: this.config.host,
      port: this.config.port,
      basePath: this.config.basePath,
      version: this.config.version
    });
  }

  private forceResetToDefaults(): void {
    console.log('🔄 Forçando reset completo para configurações padrão CodeChat v2.2.1...');
    
    // Limpar localStorage
    localStorage.removeItem('yumer_server_config');
    localStorage.removeItem('yumer_server_config_backup');
    
    // Aplicar configuração padrão
    this.config = this.getDefaultConfig();
    this.saveConfig();
    
    console.log('✅ Reset concluído - CodeChat API v2.2.1 configurado');
  }

  private saveConfig(): void {
    try {
      this.config.lastUpdated = new Date().toISOString();
      this.config.configVersion = this.CURRENT_CONFIG_VERSION;
      localStorage.setItem('yumer_server_config', JSON.stringify(this.config));
      console.log('💾 Configuração CodeChat v2.2.1 salva:', {
        serverUrl: this.config.serverUrl,
        host: this.config.host,
        port: this.config.port,
        basePath: this.config.basePath
      });
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
    }
  }

  private createBackup(): void {
    this.backupConfig = { ...this.config };
    localStorage.setItem('yumer_server_config_backup', JSON.stringify(this.backupConfig));
    console.log('🗂️ Backup da configuração criado');
  }

  // Public API - Updated for v2.2.1
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ServerConfig>): void {
    this.createBackup();
    this.config = { ...this.config, ...updates, configVersion: this.CURRENT_CONFIG_VERSION };
    this.saveConfig();
  }

  saveConfigExplicitly(): boolean {
    try {
      this.saveConfig();
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar configuração explicitamente:', error);
      return false;
    }
  }

  rollbackConfig(): boolean {
    try {
      if (this.backupConfig) {
        this.config = { ...this.backupConfig };
        this.saveConfig();
        console.log('↩️ Configuração restaurada do backup');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      return false;
    }
  }

  async testConnection(): Promise<ServerStatus> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Testando conexão com CodeChat API v2.2.1: ${this.config.serverUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
      
      // Test Swagger docs endpoint - endpoint que sabemos que existe
      const response = await fetch(`${this.config.serverUrl}/docs`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'text/html'
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
      
      console.log(`✅ Teste de conexão CodeChat API v2.2.1 concluído:`, this.status);
      
    } catch (error: any) {
      this.status = {
        isOnline: false,
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message || 'Connection failed'
      };
      
      console.error('❌ Teste de conexão CodeChat API v2.2.1 falhou:', this.status);
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
      this.createBackup();
      this.config = { 
        ...this.getDefaultConfig(), 
        ...imported, 
        configVersion: this.CURRENT_CONFIG_VERSION 
      };
      this.saveConfig();
      return true;
    } catch (error) {
      console.error('❌ Erro ao importar configuração:', error);
      return false;
    }
  }

  resetToDefaults(): void {
    this.createBackup();
    this.forceResetToDefaults();
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
    if (!this.config.adminToken.trim()) {
      errors.push('Token de administrador é obrigatório');
    }
    
    // Validate Lovable domain
    try {
      new URL(this.config.lovableDomain);
    } catch {
      errors.push('Domínio Lovable inválido');
    }
    
    // Validate Supabase URL
    try {
      new URL(this.config.supabaseUrl);
    } catch {
      errors.push('URL Supabase inválida');
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

  // Generate URLs based on current config - CodeChat API v2.2.1
  getApiUrl(): string {
    return `${this.config.serverUrl}${this.config.basePath}`;
  }

  getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.adminToken}`
    };
  }

  getBusinessHeaders(businessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    };
  }

  getInstanceHeaders(instanceJWT: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${instanceJWT}`
    };
  }

  // WebSocket URL Generation - CORRIGIDO PARA NOVA INFRAESTRUTURA
  getWebSocketUrl(): string {
    const protocol = this.config.protocol === 'https' ? 'wss' : 'ws';
    const port = this.config.webSocketPort || (this.config.protocol === 'https' ? 443 : 80);
    return `${protocol}://${this.config.host}:${port}${this.config.basePath}/ws`;
  }

  // Headers utility
  getHeaders(): Record<string, string> {
    return this.getAdminHeaders();
  }

  // Get frontend integration info
  getFrontendIntegrationInfo(): {
    lovableDomain: string;
    supabaseUrl: string;
    corsOrigins: string[];
    webhookUrls: {
      qrCode: string;
      message: string;
      status: string;
    };
    rateLimits: {
      requests: number;
      window: number;
    };
    serverInfo: {
      apiUrl: string;
      swaggerDocs: string;
      version: string;
      environment: string;
    };
  } {
    return {
      lovableDomain: this.config.lovableDomain,
      supabaseUrl: this.config.supabaseUrl,
      corsOrigins: this.config.corsOrigins,
      webhookUrls: {
        qrCode: this.config.adminWebhooks.qrCodeWebhook.url,
        message: this.config.adminWebhooks.messageWebhook.url,
        status: this.config.adminWebhooks.statusWebhook.url
      },
      rateLimits: {
        requests: this.config.rateLimitRequests,
        window: this.config.rateLimitWindow
      },
      serverInfo: {
        apiUrl: this.getApiUrl(),
        swaggerDocs: `${this.config.serverUrl}/docs`,
        version: this.config.apiVersion,
        environment: this.config.environment
      }
    };
  }

  // Método público para forçar migração manual
  forceMigration(): void {
    console.log('🔄 Forçando migração manual da configuração...');
    this.forceResetToDefaults();
  }
}

export const serverConfigService = ServerConfigService.getInstance();
export type { ServerConfig, ServerStatus };
