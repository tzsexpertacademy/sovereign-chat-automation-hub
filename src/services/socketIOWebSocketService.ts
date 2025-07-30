import { io, Socket } from 'socket.io-client';
import { businessTokenService } from './businessTokenService';
import { webSocketConfigService } from './webSocketConfigService';

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

  /**
   * Conecta usando Socket.IO conforme documentação oficial da API
   * FASE 1 & 2: JWT + Configuração da API
   */
  async connect(config: SocketIOConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 [SOCKET.IO] INICIANDO PLANO DE CORREÇÃO COMPLETA...', {
        instanceId: config.instanceId,
        clientId: config.clientId
      });

      this.config = config;
      
      // 🎯 FASE 1: REGENERAR JWT TOKEN
      console.log('🔑 [FASE-1] Regenerando JWT para instância:', config.instanceId);
      
      // Forçar regeneração do token
      const tokenResult = await businessTokenService.ensureValidToken(config.clientId);
      if (!tokenResult.success || !tokenResult.token) {
        console.error('❌ [FASE-1] FALHA CRÍTICA: Token JWT não regenerado', tokenResult.error);
        this.updateStatus({ error: `JWT CRÍTICO: ${tokenResult.error}` });
        return false;
      }
      
      console.log('✅ [FASE-1] JWT regenerado com sucesso');

      // 🎯 FASE 2: CONFIGURAR WEBSOCKET NA API
      console.log('🔧 [FASE-2] Configurando WebSocket na API...');
      
      const configured = await webSocketConfigService.ensureWebSocketConfigured(config.instanceId);
      if (!configured) {
        console.error('❌ [FASE-2] FALHA CRÍTICA: WebSocket não configurado na API');
        this.updateStatus({ error: 'CONFIGURAÇÃO CRÍTICA: WebSocket não habilitado' });
        return false;
      }
      
      console.log('✅ [FASE-2] WebSocket configurado na API');

      // 🎯 FASE 3: TESTE MÚLTIPLAS URLs
      console.log('🌐 [FASE-3] Testando URLs de conexão...');
      
      const urls = [
        'wss://api.yumer.com.br',
        'https://api.yumer.com.br',
        'ws://api.yumer.com.br'
      ];
      
      let connected = false;
      for (const url of urls) {
        console.log(`🔗 [FASE-3] Testando URL: ${url}`);
        
        try {
          this.socket = io(url, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: false,
            auth: {
              token: `Bearer ${tokenResult.token}`,
              instanceId: config.instanceId,
              clientId: config.clientId
            },
            extraHeaders: {
              'Authorization': `Bearer ${tokenResult.token}`,
              'X-Instance-Id': config.instanceId,
              'X-Client-Id': config.clientId
            }
          });

          this.setupEventListeners();
          
          const connectionResult = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn(`⏰ [FASE-3] Timeout para URL: ${url}`);
              resolve(false);
            }, 10000);

            this.socket!.on('connect', () => {
              clearTimeout(timeout);
              console.log(`✅ [FASE-3] CONECTADO COM SUCESSO em: ${url}`);
              resolve(true);
            });

            this.socket!.on('connect_error', (error) => {
              clearTimeout(timeout);
              console.warn(`❌ [FASE-3] Erro em ${url}:`, error.message);
              resolve(false);
            });
          });
          
          if (connectionResult) {
            connected = true;
            break;
          } else {
            this.socket?.disconnect();
            this.socket = null;
          }
          
        } catch (error: any) {
          console.warn(`❌ [FASE-3] Exceção em ${url}:`, error.message);
          continue;
        }
      }
      
      if (!connected) {
        console.error('❌ [FASE-3] FALHA CRÍTICA: Nenhuma URL funcionou');
        this.updateStatus({ error: 'CONEXÃO CRÍTICA: Todas as URLs falharam' });
        return false;
      }

      this.updateStatus({
        connected: true,
        authenticated: true,
        configured: true,
        reconnectAttempts: 0,
        error: undefined
      });
      
      this.startHeartbeat();
      
      console.log('🎉 [SOCKET.IO] PLANO DE CORREÇÃO EXECUTADO COM SUCESSO!');
      return true;

    } catch (error: any) {
      console.error('❌ [SOCKET.IO] Erro ao conectar:', error);
      this.updateStatus({ error: error.message });
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Eventos de conexão
    this.socket.on('disconnect', (reason) => {
      console.warn('🚫 [SOCKET.IO] Desconectado:', reason);
      this.updateStatus({ connected: false, authenticated: false });
      this.stopHeartbeat();
      
      // Tentar reconectar se não foi desconexão manual
      if (reason !== 'io client disconnect' && this.status.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    // Fase 3: Mapear eventos conforme documentação
    // Evento principal: messages.upsert (conforme docs)
    this.socket.on('messages.upsert', (data) => {
      console.log('📨 [SOCKET.IO] Nova mensagem recebida via messages.upsert:', data);
      this.processMessage(data);
    });

    // QR Code updates
    this.socket.on('qrcode.update', (data) => {
      console.log('🔲 [SOCKET.IO] QR Code atualizado:', data);
      this.config?.onQRUpdate?.(data);
    });

    // Connection updates  
    this.socket.on('connection.update', (data) => {
      console.log('🔄 [SOCKET.IO] Status de conexão atualizado:', data);
      this.config?.onConnectionUpdate?.(data);
    });

    // Presence updates
    this.socket.on('presence.update', (data) => {
      console.log('👤 [SOCKET.IO] Presença atualizada:', data);
      this.config?.onPresenceUpdate?.(data);
    });

    // Auth errors
    this.socket.on('auth.error', (data) => {
      console.error('🔐 [SOCKET.IO] Erro de autenticação:', data);
      this.updateStatus({ error: 'Erro de autenticação', authenticated: false });
    });

    // Heartbeat response (conforme docs: ping/pong)
    this.socket.on('pong.server', (data) => {
      console.log('🏓 [SOCKET.IO] Pong recebido:', data);
      this.updateStatus({ lastHeartbeat: new Date() });
    });
  }

  /**
   * 🎯 FASE 3: MAPEAR EVENTOS CORRETOS
   * Processa mensagens conforme estrutura real dos logs do servidor
   */
  private processMessage(data: any): void {
    try {
      console.log('📨 [SOCKET.IO] FASE-3: Processando mensagem conforme logs reais:', data);

      // 🔍 ESTRUTURA REAL DOS LOGS DO SERVIDOR:
      // {
      //   messageId: '01K1E3A4KXBCVF30H2Y47VHSMT',
      //   keyId: '3EB0D2B3BDE6384A245209',
      //   keyFromMe: false,
      //   keyRemoteJid: '554796451886@s.whatsapp.net',
      //   pushName: 'Thalis Zulianello Silva',
      //   contentType: 'text',
      //   isGroup: false,
      //   content: { text: 'cade você' },
      //   source: 'web',
      //   messageTimestamp: 1753893638,
      //   instanceInstanceId: '01K11NBE1QB0GVFMME8NA4YPCB'
      // }

      // ✅ VALIDAÇÃO RIGOROSA
      if (!data || !data.messageId || !data.instanceInstanceId) {
        console.warn('⚠️ [SOCKET.IO] FASE-3: Mensagem inválida - campos obrigatórios ausentes:', {
          hasData: !!data,
          hasMessageId: !!data?.messageId,
          hasInstanceId: !!data?.instanceInstanceId
        });
        return;
      }

      // ✅ VERIFICAR INSTÂNCIA CORRETA
      if (this.config && data.instanceInstanceId !== this.config.instanceId) {
        console.log('📋 [SOCKET.IO] FASE-3: Mensagem de outra instância ignorada:', {
          mensagemDe: data.instanceInstanceId,
          esperado: this.config.instanceId
        });
        return;
      }

      // ✅ ESTRUTURA NORMALIZADA CONFORME LOGS
      const normalizedMessage = {
        messageId: data.messageId,
        keyId: data.keyId,
        keyFromMe: data.keyFromMe || false,
        keyRemoteJid: data.keyRemoteJid,
        pushName: data.pushName || 'Cliente',
        contentType: data.contentType || 'text',
        isGroup: data.isGroup || false,
        content: data.content || {},
        source: data.source || 'web',
        messageTimestamp: data.messageTimestamp,
        instanceInstanceId: data.instanceInstanceId,
        createdAt: data.createdAt || new Date().toISOString()
      };

      console.log('✅ [SOCKET.IO] FASE-3: Mensagem normalizada com sucesso:', {
        messageId: normalizedMessage.messageId,
        from: normalizedMessage.keyRemoteJid,
        contentType: normalizedMessage.contentType,
        isFromMe: normalizedMessage.keyFromMe,
        text: normalizedMessage.content?.text?.substring(0, 50) || 'sem texto'
      });

      // 🎯 ENVIAR PARA CALLBACK
      if (this.config?.onMessage) {
        this.config.onMessage(normalizedMessage);
      } else {
        console.warn('⚠️ [SOCKET.IO] FASE-3: Callback onMessage não definido');
      }

    } catch (error) {
      console.error('❌ [SOCKET.IO] FASE-3: ERRO CRÍTICO ao processar mensagem:', error);
    }
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