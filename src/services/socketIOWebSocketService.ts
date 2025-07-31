import { io, Socket } from 'socket.io-client';
import { businessTokenService } from './businessTokenService';
import { webSocketConfigService } from './webSocketConfigService';
import { supabase } from '@/integrations/supabase/client';

interface SocketIOConnectionConfig {
  instanceId: string;
  clientId: string;
  onMessage?: (message: any) => void;
  onQRUpdate?: (qr: any) => void;
  onConnectionUpdate?: (status: any) => void;
  onPresenceUpdate?: (presence: any) => void;
}

interface SocketIOStatus {
  connected: boolean;
  authenticated: boolean;
  configured: boolean;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  error?: string;
}

class SocketIOWebSocketService {
  private socket: Socket | null = null;
  private config: SocketIOConnectionConfig | null = null;
  private status: SocketIOStatus = {
    connected: false,
    authenticated: false,
    configured: false,
    reconnectAttempts: 0
  };
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private baseUrl = 'https://api.yumer.com.br';
  
  // Circuit breaker para detectar servidor indisponível
  private circuitBreaker = {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    blockedUntil: 0,
    isBlocked: false
  };

  /**
   * ESTRATÉGIA HÍBRIDA: WebSocket para RECEBER + REST para ENVIAR
   * - Circuit breaker para detectar servidor 500
   * - Fallback rápido quando servidor indisponível
   * - Timeout otimizado para falha rápida
   */
  async connect(config: SocketIOConnectionConfig): Promise<boolean> {
    try {
      // Verificar circuit breaker
      if (this.isCircuitBreakerBlocked()) {
        console.warn('🚫 [SOCKET.IO] *** CIRCUIT BREAKER ATIVO - SERVIDOR INDISPONÍVEL ***');
        return false;
      }

      console.log('🔌 [SOCKET.IO] *** INICIANDO ESTRATÉGIA HÍBRIDA ***', {
        instanceId: config.instanceId,
        clientId: config.clientId
      });

      this.config = config;
      
      // 🎯 FASE 1: OBTER JWT DA INSTÂNCIA (correção crítica)
      console.log('🔑 [FASE-1] Obtendo JWT da instância:', config.instanceId);
      
      const jwt = await this.getInstanceJWT(config.instanceId, config.clientId);
      if (!jwt) {
        console.error('❌ [FASE-1] FALHA CRÍTICA: JWT da instância não obtido');
        this.updateStatus({ error: 'JWT CRÍTICO: Não foi possível obter JWT da instância' });
        return false;
      }
      
      console.log('✅ [FASE-1] JWT da instância obtido com sucesso');

      // 🎯 FASE 2: CONFIGURAR WEBSOCKET VIA API (correção crítica)
      console.log('🔧 [FASE-2] Configurando WebSocket via API com autenticação...');
      
      const configured = await this.configureWebSocketAPI(config.instanceId, jwt);
      if (!configured) {
        console.error('❌ [FASE-2] FALHA CRÍTICA: WebSocket não configurado via API');
        this.updateStatus({ error: 'CONFIGURAÇÃO CRÍTICA: API WebSocket não configurada' });
        return false;
      }
      
      console.log('✅ [FASE-2] WebSocket configurado via API');

      // 🎯 FASE 3: CONECTAR SOCKET.IO COM URL CORRETA
      console.log('🌐 [FASE-3] Conectando Socket.IO na URL correta...');
      
      const socketConnected = await this.connectSocketIO(config.instanceId, jwt);
      if (!socketConnected) {
        console.error('❌ [FASE-3] FALHA CRÍTICA: Socket.IO não conectou');
        this.updateStatus({ error: 'CONEXÃO CRÍTICA: Socket.IO falhou' });
        return false;
      }
      
      console.log('✅ [FASE-3] Socket.IO conectado');

      this.updateStatus({
        connected: true,
        authenticated: true,
        configured: true,
        reconnectAttempts: 0,
        error: undefined
      });
      
      this.startHeartbeat();
      
      console.log('🎉 [SOCKET.IO] *** PLANO DE CORREÇÃO FINAL EXECUTADO COM SUCESSO! ***');
      return true;

    } catch (error: any) {
      console.error('❌ [SOCKET.IO] Erro crítico na estratégia híbrida:', error);
      
      // Ativar circuit breaker em caso de erro de rede
      if (error.name === 'AbortError' || error.code === 'ECONNREFUSED') {
        this.activateCircuitBreaker();
        console.error('🚫 [CIRCUIT-BREAKER] Erro de conexão - Bloqueando por 5 minutos');
      }
      
      this.updateStatus({ error: error.message });
      return false;
    }
  }

  /**
   * FASE 1: Obter JWT da instância corretamente
   */
  private async getInstanceJWT(instanceId: string, clientId: string): Promise<string | null> {
    try {
      // 🔑 CORREÇÃO CRÍTICA: Usar Supabase diretamente ao invés do endpoint inexistente
      console.log('🔍 [FASE-1] Consultando JWT da instância no Supabase...');
      
      // Primeiro verificar se existe JWT no whatsapp_instances
      const { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('client_id', clientId)
        .single();

      // Se não encontrou na instância, buscar o business_token no cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', clientId)
        .single();

      if (instanceError) {
        console.warn('⚠️ [FASE-1] Erro ao consultar instância:', instanceError.message);
      }

      if (clientError) {
        console.warn('⚠️ [FASE-1] Erro ao consultar cliente:', clientError.message);
      }

      // Usar business_token do cliente
      const businessToken = clientData?.business_token;
      
      if (businessToken) {
        console.log('✅ [FASE-1] JWT obtido da base de dados Supabase (cliente)');
        
        // Verificar se o token não está expirado
        try {
          const payload = JSON.parse(atob(businessToken.split('.')[1]));
          const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
          
          if (isExpired) {
            console.warn('⚠️ [FASE-1] JWT expirado, regenerando...');
          } else {
            return businessToken;
          }
        } catch (e) {
          console.warn('⚠️ [FASE-1] Erro ao verificar JWT, regenerando...');
        }
      }

      // Se não existe, regenerar via business token service
      console.log('🔄 [FASE-1] Regenerando JWT via business token service...');
      const tokenResult = await businessTokenService.ensureValidToken(clientId);
      
      if (tokenResult.success && tokenResult.token) {
        return tokenResult.token;
      }

      return null;
    } catch (error) {
      console.error('❌ [FASE-1] Erro ao obter JWT:', error);
      return null;
    }
  }

  /**
   * FASE 2: Configurar WebSocket via API com autenticação correta
   */
  private async configureWebSocketAPI(instanceId: string, jwt: string): Promise<boolean> {
    try {
      console.log('🔧 [FASE-2] Configurando WebSocket com Authorization header...');
      
      // Configuração WebSocket conforme documentação
      const config = {
        enabled: true,
        events: {
          qrcodeUpdate: true,
          stateInstance: false,
          messagesSet: false,
          messagesUpsert: true, // CRÍTICO - evento principal
          messagesUpdate: true,
          sendMessage: true,
          contactsSet: false,
          contactsUpsert: false,
          contactsUpdate: false,
          presenceUpdate: true,
          chatsSet: false,
          chatsUpdate: false,
          chatsUpsert: false,
          groupsUpsert: false,
          groupUpdate: false,
          groupParticipantsUpdate: false,
          connectionUpdate: true,
          callUpsert: false
        }
      };

      const response = await fetch(`${this.baseUrl}/api/v2/instance/${instanceId}/socket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(3000) // Timeout rápido para detectar problema do servidor
      });

      if (!response.ok) {
        console.error('❌ [FASE-2] Erro na configuração API:', response.status, response.statusText);
        
        // Tratar erro 400 "Socket já registrado"
        if (response.status === 400) {
          const errorData = await response.json().catch(() => null);
          
          if (errorData?.message) {
            const errorMessage = Array.isArray(errorData.message) 
              ? errorData.message.join(' ') 
              : errorData.message;
            
            if (errorMessage.includes('socket registered') || errorMessage.includes('socket already registered')) {
              console.warn('⚠️ [FASE-2] ERRO 400: Socket já existe no servidor - ATIVANDO CIRCUIT BREAKER');
              
              // Ativar circuit breaker por 30 minutos para este erro específico
              this.circuitBreaker = {
                consecutiveFailures: 999,
                lastFailureTime: Date.now(),
                blockedUntil: Date.now() + (30 * 60 * 1000), // 30 minutos
                isBlocked: true
              };
              
              console.error('🚫 [CIRCUIT-BREAKER] Socket já registrado - Sistema funcionará via Supabase por 30 minutos');
              return false;
            }
          }
        }
        
        // Detectar erro 500 do servidor
        if (response.status === 500) {
          this.activateCircuitBreaker();
          console.error('🚫 [CIRCUIT-BREAKER] Servidor retornou 500 - Bloqueando por 5 minutos');
        }
        
        const errorText = await response.text();
        console.error('❌ [FASE-2] Detalhes do erro:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('✅ [FASE-2] WebSocket configurado com sucesso:', result);
      
      return true;
    } catch (error) {
      console.error('❌ [FASE-2] Erro ao configurar WebSocket via API:', error);
      return false;
    }
  }

  /**
   * FASE 3: Conectar Socket.IO com configuração correta
   */
  private async connectSocketIO(instanceId: string, jwt: string): Promise<boolean> {
    try {
      // URL correta baseada nos logs do servidor: wss://api.yumer.com.br
      const socketUrl = 'wss://api.yumer.com.br';
      
      console.log(`🔌 [FASE-3] Conectando Socket.IO em: ${socketUrl}`);

      this.socket = io(socketUrl, {
        transports: ['websocket'],
        timeout: 3000, // Timeout rápido para falha rápida
        reconnection: false,
        auth: {
          token: jwt,
          instanceId: instanceId
        },
        extraHeaders: {
          'Authorization': `Bearer ${jwt}`
        }
      });

      this.setupEventListeners();
      
      // Aguardar conexão com timeout otimizado
      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⏰ [FASE-3] Timeout na conexão Socket.IO (3s)');
          resolve(false);
        }, 3000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ [FASE-3] Socket.IO conectado com sucesso!');
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ [FASE-3] Erro na conexão Socket.IO:', error);
          resolve(false);
        });
      });
      
      if (!connected) {
        this.socket?.disconnect();
        this.socket = null;
        return false;
      }

      return true;
      
    } catch (error) {
      console.error('❌ [FASE-3] Erro ao conectar Socket.IO:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    console.log('🎧 [SOCKET.IO] Configurando event listeners...');

    // Eventos de conexão
    this.socket.on('connect', () => {
      console.log('✅ [SOCKET.IO] Conectado ao servidor');
      this.updateStatus({ connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('🚫 [SOCKET.IO] Desconectado:', reason);
      this.updateStatus({ connected: false, authenticated: false });
      this.stopHeartbeat();
      
      // Tentar reconectar se não foi desconexão manual
      if (reason !== 'io client disconnect' && this.status.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [SOCKET.IO] Erro de conexão:', error);
      this.updateStatus({ error: error.message });
    });

    // EVENTOS CRÍTICOS - conforme documentação e logs reais
    this.socket.on('messages.upsert', (data) => {
      console.log('📨 [SOCKET.IO] *** MENSAGEM RECEBIDA VIA WEBSOCKET ***:', data);
      this.processMessage(data);
    });

    this.socket.on('qrcode.update', (data) => {
      console.log('🔲 [SOCKET.IO] QR Code atualizado:', data);
      this.config?.onQRUpdate?.(data);
    });

    this.socket.on('connection.update', (data) => {
      console.log('🔄 [SOCKET.IO] Status de conexão atualizado:', data);
      this.config?.onConnectionUpdate?.(data);
    });

    this.socket.on('presence.update', (data) => {
      console.log('👤 [SOCKET.IO] Presença atualizada:', data);
      this.config?.onPresenceUpdate?.(data);
    });

    this.socket.on('auth.error', (data) => {
      console.error('🔐 [SOCKET.IO] Erro de autenticação:', data);
      this.updateStatus({ error: 'Erro de autenticação', authenticated: false });
    });

    this.socket.on('auth.success', () => {
      console.log('✅ [SOCKET.IO] Autenticado com sucesso');
      this.updateStatus({ authenticated: true });
    });

    // Heartbeat response
    this.socket.on('pong.server', (data) => {
      console.log('🏓 [SOCKET.IO] Pong recebido:', data);
      this.updateStatus({ lastHeartbeat: new Date() });
    });

    console.log('✅ [SOCKET.IO] Event listeners configurados');
  }

  /**
   * PROCESSAMENTO DE MENSAGENS - baseado na estrutura real dos logs do servidor
   */
  private processMessage(data: any): void {
    try {
      console.log('📨 [SOCKET.IO] *** PROCESSANDO MENSAGEM WEBSOCKET ***:', data);

      if (!this.config?.onMessage) {
        console.warn('⚠️ [SOCKET.IO] Callback onMessage não configurado');
        return;
      }

      // Processar como array ou objeto único (conforme documentação)
      const messages = Array.isArray(data) ? data : [data];

      for (const msgData of messages) {
        // Estrutura baseada nos logs reais do servidor
        const normalizedMessage = {
          messageId: msgData.key?.id || msgData.messageId || `ws_${Date.now()}`,
          keyFromMe: msgData.key?.fromMe || msgData.keyFromMe || false,
          keyRemoteJid: msgData.key?.remoteJid || msgData.keyRemoteJid,
          pushName: msgData.pushName || msgData.verifiedBizName || 'Cliente',
          contentType: this.getMessageType(msgData),
          content: this.extractContent(msgData),
          messageTimestamp: msgData.messageTimestamp || Date.now(),
          instanceInstanceId: this.config.instanceId,
          source: 'websocket-realtime'
        };

        console.log('✅ [SOCKET.IO] *** MENSAGEM NORMALIZADA ***:', {
          messageId: normalizedMessage.messageId,
          fromMe: normalizedMessage.keyFromMe,
          content: normalizedMessage.content?.substring(0, 50) || 'sem conteúdo',
          from: normalizedMessage.keyRemoteJid
        });

        // Enviar para callback
        this.config.onMessage(normalizedMessage);
      }

    } catch (error) {
      console.error('❌ [SOCKET.IO] Erro crítico ao processar mensagem:', error);
    }
  }

  private getMessageType(msgData: any): string {
    if (msgData.message?.conversation) return 'text';
    if (msgData.message?.extendedTextMessage) return 'text';
    if (msgData.message?.imageMessage) return 'image';
    if (msgData.message?.audioMessage) return 'audio';
    if (msgData.message?.videoMessage) return 'video';
    if (msgData.message?.documentMessage) return 'document';
    if (msgData.contentType) return msgData.contentType;
    return 'text';
  }

  private extractContent(msgData: any): string {
    // Tentar extrair conteúdo de várias fontes possíveis
    if (msgData.message?.conversation) return msgData.message.conversation;
    if (msgData.message?.extendedTextMessage?.text) return msgData.message.extendedTextMessage.text;
    if (msgData.content?.text) return msgData.content.text;
    if (msgData.body) return msgData.body;
    if (msgData.text) return msgData.text;
    
    // Se não encontrou texto, retornar tipo de mídia
    const type = this.getMessageType(msgData);
    return type !== 'text' ? `[${type.toUpperCase()}]` : '';
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        console.log('💓 [SOCKET.IO] Enviando ping...');
        this.socket.emit('ping.server', 'ping');
      }
    }, 30000); // 30 segundos
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.status.reconnectAttempts), 30000);
    console.log(`⏰ [SOCKET.IO] Reagendando reconexão em ${delay}ms...`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.config) {
        this.connect(this.config);
      }
    }, delay);
  }

  private updateStatus(updates: Partial<SocketIOStatus>): void {
    this.status = { ...this.status, ...updates };
  }

  disconnect(): void {
    console.log('🔌 [SOCKET.IO] Desconectando...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.updateStatus({
      connected: false,
      authenticated: false,
      configured: false,
      reconnectAttempts: 0,
      error: undefined
    });
  }

  getStatus(): SocketIOStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected && this.socket?.connected === true;
  }

  /**
   * Circuit breaker para detectar servidor indisponível
   */
  private isCircuitBreakerBlocked(): boolean {
    if (this.circuitBreaker.isBlocked && Date.now() < this.circuitBreaker.blockedUntil) {
      return true;
    }
    
    if (this.circuitBreaker.isBlocked && Date.now() >= this.circuitBreaker.blockedUntil) {
      console.log('✅ [CIRCUIT-BREAKER] Desbloqueando - Tentando novamente');
      this.resetCircuitBreaker();
    }
    
    return false;
  }

  private activateCircuitBreaker(): void {
    this.circuitBreaker.consecutiveFailures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.consecutiveFailures >= 3) {
      this.circuitBreaker.isBlocked = true;
      this.circuitBreaker.blockedUntil = Date.now() + (5 * 60 * 1000); // 5 minutos
      
      console.warn('🚫 [CIRCUIT-BREAKER] *** SERVIDOR WEBSOCKET INDISPONÍVEL ***');
      console.warn('🔄 [CIRCUIT-BREAKER] Próxima tentativa em 5 minutos');
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.consecutiveFailures = 0;
    this.circuitBreaker.isBlocked = false;
    this.circuitBreaker.blockedUntil = 0;
  }

  getCircuitBreakerStatus() {
    return {
      blocked: this.circuitBreaker.isBlocked,
      failures: this.circuitBreaker.consecutiveFailures,
      unblockTime: this.circuitBreaker.blockedUntil
    };
  }

  /**
   * Testa a conectividade Socket.IO
   */
  async testConnection(instanceId: string, clientId: string): Promise<boolean> {
    const testConfig: SocketIOConnectionConfig = {
      instanceId,
      clientId,
      onMessage: (msg) => console.log('🧪 [TEST] Mensagem de teste:', msg)
    };

    const connected = await this.connect(testConfig);
    
    if (connected) {
      // Aguardar um pouco para testar a conexão
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.disconnect();
    }
    
    return connected;
  }
}

export const socketIOWebSocketService = new SocketIOWebSocketService();