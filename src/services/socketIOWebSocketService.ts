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

  /**
   * PLANO DE CORREÇÃO FINAL - Baseado nos logs reais do servidor
   * FASE 1: Autenticação correta com Authorization header
   * FASE 2: URL correta do WebSocket  
   * FASE 3: Configuração da API antes da conexão
   */
  async connect(config: SocketIOConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 [SOCKET.IO] *** INICIANDO PLANO DE CORREÇÃO FINAL ***', {
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

      // 🎯 FASE 2: CONFIGURAR WEBSOCKET VIA API REST (obrigatório conforme documentação)
      console.log('🔧 [FASE-2] Configurando WebSocket via API REST...');
      
      const configured = await this.configureWebSocketAPI(config.instanceId, jwt);
      if (!configured) {
        console.error('❌ [FASE-2] FALHA CRÍTICA: WebSocket não configurado via API');
        this.updateStatus({ error: 'CONFIGURAÇÃO CRÍTICA: API WebSocket não configurada' });
        return false;
      }
      
      console.log('✅ [FASE-2] WebSocket configurado via API');

      // 🎯 FASE 3: CONECTAR SOCKET.IO APÓS CONFIGURAÇÃO
      console.log('🌐 [FASE-3] Conectando Socket.IO após configuração...');
      
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
      console.error('❌ [SOCKET.IO] Erro crítico no plano de correção:', error);
      this.updateStatus({ error: error.message });
      return false;
    }
  }

  /**
   * FASE 1: Obter business_token diretamente do Supabase (sem verificação de expiração)
   */
  private async getInstanceJWT(instanceId: string, clientId: string): Promise<string | null> {
    try {
      console.log('✅ [FASE-1] Buscando business_token no Supabase (mesmo dos outros serviços)...');
      
      // Buscar o business_token diretamente do cliente no Supabase
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', clientId)
        .single();

      if (clientError) {
        console.error('❌ [FASE-1] Erro ao buscar cliente:', clientError);
        return null;
      }

      if (!clientData?.business_token) {
        console.error('❌ [FASE-1] Business token não encontrado para o cliente');
        return null;
      }

      const jwt = clientData.business_token;

      // Verificar se o token tem formato válido
      if (!jwt || jwt.split('.').length !== 3) {
        console.error('❌ [FASE-1] JWT inválido:', jwt);
        return null;
      }

      console.log('✅ [FASE-1] Business token obtido (usando mesmo token dos outros serviços)');
      return jwt;
    } catch (error) {
      console.error('❌ [FASE-1] Erro ao obter business token:', error);
      return null;
    }
  }

  /**
   * FASE 2A: Verificar se já existe WebSocket configurado
   */
  private async checkExistingWebSocket(instanceId: string, jwt: string): Promise<{ exists: boolean; working: boolean }> {
    try {
      console.log('🔍 [FASE-2A] Verificando WebSocket existente...');

      const response = await fetch(`${this.baseUrl}/api/v2/instance/${instanceId}/socket`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const socketData = await response.json();
        console.log('✅ [FASE-2A] WebSocket já existe:', socketData);
        return { exists: true, working: true };
      } else if (response.status === 404) {
        console.log('📝 [FASE-2A] Nenhum WebSocket encontrado (404)');
        return { exists: false, working: false };
      } else {
        console.log('⚠️ [FASE-2A] WebSocket existe mas com problemas:', response.status);
        return { exists: true, working: false };
      }

    } catch (error) {
      console.error('❌ [FASE-2A] Erro ao verificar WebSocket existente:', error);
      return { exists: false, working: false };
    }
  }

  /**
   * FASE 2B: Limpar WebSocket existente se necessário
   */
  private async cleanupExistingWebSocket(instanceId: string, jwt: string): Promise<boolean> {
    try {
      console.log('🧹 [FASE-2B] Limpando WebSocket existente...');

      const response = await fetch(`${this.baseUrl}/api/v2/instance/${instanceId}/socket`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log('✅ [FASE-2B] WebSocket existente removido');
        return true;
      } else {
        console.warn('⚠️ [FASE-2B] Falha ao remover WebSocket:', response.status);
        return false;
      }

    } catch (error) {
      console.error('❌ [FASE-2B] Erro ao limpar WebSocket:', error);
      return false;
    }
  }

  /**
   * FASE 2C: Configurar WebSocket via API com verificação inteligente
   */
  private async configureWebSocketAPI(instanceId: string, jwt: string): Promise<boolean> {
    try {
      console.log('🔧 [FASE-2C] Configurando WebSocket com verificação inteligente...');

      // Primeiro, verificar se já existe um WebSocket
      const { exists, working } = await this.checkExistingWebSocket(instanceId, jwt);

      if (exists && working) {
        console.log('✅ [FASE-2C] WebSocket existente funcionando, reutilizando...');
        return true;
      }

      if (exists && !working) {
        console.log('🧹 [FASE-2C] WebSocket existe mas com problemas, limpando...');
        await this.cleanupExistingWebSocket(instanceId, jwt);
        // Aguardar um pouco após limpeza
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Agora criar um novo WebSocket
      console.log('🔧 [FASE-2C] Criando novo WebSocket...');

      const config = {
        enabled: true,
        events: {
          qrcodeUpdate: true,
          stateInstance: false,
          messagesSet: false,
          messagesUpsert: true,
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
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [FASE-2C] Erro na configuração API: ${response.status}`);
        console.error(`❌ [FASE-2C] Detalhes do erro:`, errorText);
        return false;
      }

      const result = await response.json();
      console.log('✅ [FASE-2C] WebSocket configurado com sucesso:', result);
      
      return true;
    } catch (error) {
      console.error('❌ [FASE-2C] Erro ao configurar WebSocket via API:', error);
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
        extraHeaders: {
          'Authorization': `Bearer ${jwt}`
        },
        query: {
          instanceId: instanceId
        },
        transports: ['websocket'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupEventListeners();
      
      // Aguardar conexão
      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⏰ [FASE-3] Timeout na conexão Socket.IO');
          resolve(false);
        }, 15000);

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
   * 🚀 ENVIAR MENSAGEM VIA WEBSOCKET - CRÍTICO PARA UNIFICAÇÃO
   */
  async sendMessage(chatId: string, message: string, options?: {
    messageType?: 'text' | 'audio' | 'image' | 'video' | 'document';
    delay?: number;
    presence?: 'composing' | 'recording' | 'available';
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.isConnected()) {
        console.error('❌ [SOCKET.IO-SEND] WebSocket não conectado');
        return { success: false, error: 'WebSocket não conectado' };
      }

      if (!this.socket) {
        console.error('❌ [SOCKET.IO-SEND] Socket não disponível');
        return { success: false, error: 'Socket não disponível' };
      }

      // Usar estrutura compatível com REST API Yumer
      const messageData = {
        recipient: chatId,
        textMessage: {
          text: message
        },
        options: {
          delay: options?.delay || 0,
          presence: options?.presence || 'composing'
        }
      };

      console.log('📤 [SOCKET.IO-SEND] *** ENVIANDO VIA WEBSOCKET COM ESTRUTURA CORRETA ***', {
        chatId,
        messagePreview: message.substring(0, 50) + '...',
        evento: 'send.text',
        estrutura: 'REST-compatible'
      });

      // Tentar múltiplos eventos conhecidos
      const eventos = ['send.text', 'sendText', 'send.message', 'message.send'];
      let response: any = null;
      let eventoUsado = '';

      for (const evento of eventos) {
        try {
          console.log(`🔄 [SOCKET.IO-SEND] Testando evento: ${evento}`);
          
          response = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Timeout no evento ${evento}`));
            }, 5000); // Reduzido para 5s

            this.socket!.emit(evento, messageData, (response: any) => {
              clearTimeout(timeout);
              resolve(response);
            });
          });

          if (response) {
            eventoUsado = evento;
            console.log(`✅ [SOCKET.IO-SEND] Evento funcionou: ${evento}`, response);
            break;
          }
        } catch (error) {
          console.log(`⚠️ [SOCKET.IO-SEND] Evento ${evento} falhou:`, error);
          continue;
        }
      }

      if (!response && !eventoUsado) {
        console.error('❌ [SOCKET.IO-SEND] Nenhum evento WebSocket funcionou - todos os eventos falharam');
        return {
          success: false,
          error: 'Nenhum evento WebSocket reconhecido pelo servidor'
        };
      }

      if (response?.success) {
        console.log(`✅ [SOCKET.IO-SEND] Mensagem enviada com sucesso via WebSocket usando evento: ${eventoUsado}`, response);
        return {
          success: true,
          messageId: response.messageId || `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        console.error(`❌ [SOCKET.IO-SEND] Falha no envio via WebSocket com evento ${eventoUsado}:`, response);
        return {
          success: false,
          error: response?.error || 'Erro desconhecido no WebSocket'
        };
      }

    } catch (error: any) {
      console.error('❌ [SOCKET.IO-SEND] Erro crítico no envio via WebSocket:', error);
      return {
        success: false,
        error: error.message || 'Erro crítico no WebSocket'
      };
    }
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