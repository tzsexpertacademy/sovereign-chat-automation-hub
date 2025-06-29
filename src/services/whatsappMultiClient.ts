
import { io, Socket } from 'socket.io-client';
import { getServerConfig, getAlternativeServerConfig, resetConnectionCache, getServerConfigSync, API_BASE_URL } from '@/config/environment';

console.log(`🔗 WhatsApp Service - Iniciando com detecção inteligente`);

export interface WhatsAppClient {
  clientId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'error' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
}

export interface ChatData {
  id: string;
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage?: {
    body: string;
    type: string;
    timestamp: number;
    fromMe: boolean;
  };
}

export interface MessageData {
  id: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  from: string;
  to: string;
}

class WhatsAppMultiClientService {
  private socket: Socket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private currentConfig: any = null;

  constructor() {
    console.log('🚀 Inicializando WhatsApp Multi-Client Service com fallback inteligente');
    this.currentConfig = getServerConfigSync();
    console.log(`🎯 Configuração inicial: ${this.currentConfig.serverUrl}`);
  }

  // Função para obter configuração atual
  private async getCurrentConfig() {
    if (!this.currentConfig) {
      this.currentConfig = await getServerConfig();
    }
    return this.currentConfig;
  }

  // Conectar ao WebSocket com fallback
  async connectSocket(): Promise<Socket> {
    if (!this.socket) {
      const config = await this.getCurrentConfig();
      console.log(`🔌 Conectando ao WebSocket: ${config.serverUrl}`);
      
      this.socket = io(config.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000
      });

      this.socket.on('connect', () => {
        console.log(`✅ WebSocket conectado: ${config.serverUrl}`);
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket:', error);
        this.reconnectAttempts++;
      });
    }

    return this.socket;
  }

  // Reconectar
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    setTimeout(() => {
      this.connectSocket();
    }, 1000);
  }

  // Desconectar
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Entrar no room de um cliente
  joinClientRoom(clientId: string) {
    if (this.socket) {
      this.socket.emit('join_client', clientId);
      console.log(`📱 Room do cliente: ${clientId}`);
    }
  }

  // Listeners
  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`client_status_${clientId}`, callback);
    }
  }

  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
    }
  }

  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  removeListener(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Fazer requisição com fallback automático
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const config = await this.getCurrentConfig();
    const url = `${config.serverUrl}${endpoint}`;
    
    console.log(`📡 ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: AbortSignal.timeout(15000) // 15 segundos timeout
      });
      
      console.log(`📡 Resposta: ${response.status} ${response.statusText}`);
      return response;
      
    } catch (error: any) {
      console.error(`❌ Erro na requisição para ${url}:`, error);
      
      // Se erro SSL/HTTPS, tentar configuração alternativa
      if (error.message.includes('SSL') || error.message.includes('certificate') || error.message.includes('ERR_SSL')) {
        console.log('🔄 Erro SSL detectado, tentando configuração alternativa...');
        
        const altConfig = getAlternativeServerConfig();
        if (altConfig) {
          const altUrl = `${altConfig.serverUrl}${endpoint}`;
          console.log(`🔄 Tentando URL alternativa: ${altUrl}`);
          
          try {
            const altResponse = await fetch(altUrl, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                ...options.headers
              },
              signal: AbortSignal.timeout(15000)
            });
            
            if (altResponse.ok) {
              console.log(`✅ URL alternativa funcionou: ${altUrl}`);
              // Atualizar configuração atual
              this.currentConfig = altConfig;
              return altResponse;
            }
          } catch (altError) {
            console.error(`❌ URL alternativa também falhou:`, altError);
          }
        }
      }
      
      throw error;
    }
  }

  async checkServerHealth(): Promise<any> {
    try {
      console.log('🔍 Verificando saúde do servidor...');
      
      const response = await this.makeRequest('/health');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Servidor saudável:', data);
      return data;
    } catch (error) {
      console.error('❌ Health check falhou:', error);
      throw error;
    }
  }

  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📡 Buscando todos os clientes...');
      
      const response = await this.makeRequest('/api/clients');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar clientes');
      }
      
      console.log(`✅ ${data.clients.length} clientes encontrados`);
      return data.clients;
    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente: ${clientId}`);
      
      const response = await this.makeRequest(`/api/clients/${clientId}/connect`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} conectado`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao conectar ${clientId}:`, error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      
      const response = await this.makeRequest(`/api/clients/${clientId}/disconnect`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao desconectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} desconectado`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao desconectar ${clientId}:`, error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      const response = await this.makeRequest(`/api/clients/${clientId}/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar status');
      }
      
      return {
        clientId: data.clientId,
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: !!data.qrCode,
        qrCode: data.qrCode
      };
    } catch (error) {
      console.error(`❌ Erro status ${clientId}:`, error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, mediaUrl?: string, file?: File): Promise<any> {
    try {
      console.log('📤 Enviando mensagem:', { 
        clientId, 
        to, 
        message: message.substring(0, 50), 
        hasFile: !!file,
        hasMediaUrl: !!mediaUrl,
        fileType: file?.type,
        fileSize: file?.size 
      });
      
      if (file) {
        // Envio de arquivo com validação melhorada
        const formData = new FormData();
        formData.append('to', to);
        formData.append('file', file);
        
        if (message && message.trim()) {
          formData.append('caption', message);
        }

        // Determinar endpoint baseado no tipo de arquivo
        let endpoint = 'send-media';
        if (file.type.startsWith('image/')) {
          endpoint = 'send-image';
        } else if (file.type.startsWith('video/')) {
          endpoint = 'send-video';
        } else if (file.type.startsWith('audio/')) {
          endpoint = 'send-audio';
        } else {
          endpoint = 'send-document';
        }

        const config = await this.getCurrentConfig();
        const response = await fetch(`${config.serverUrl}/api/clients/${clientId}/${endpoint}`, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar arquivo');
        }
        
        console.log('✅ Arquivo enviado com sucesso:', data);
        return data;
        
      } else if (mediaUrl) {
        // Envio com URL de mídia
        const response = await this.makeRequest(`/api/clients/${clientId}/send-media-url`, {
          method: 'POST',
          body: JSON.stringify({ to, message, mediaUrl })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar mídia');
        }
        
        console.log('✅ Mídia enviada com sucesso');
        return data;
        
      } else {
        // Envio de mensagem de texto
        const response = await this.makeRequest(`/api/clients/${clientId}/send-message`, {
          method: 'POST',
          body: JSON.stringify({ to, message })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar mensagem');
        }
        
        console.log('✅ Mensagem enviada com sucesso');
        return data;
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async getChats(clientId: string, retryCount = 0): Promise<ChatData[]> {
    try {
      console.log(`📡 Buscando chats para ${clientId} (tentativa ${retryCount + 1})`);
      
      const response = await this.makeRequest(`/api/clients/${clientId}/chats`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar chats');
      }
      
      console.log(`✅ ${data.chats.length} chats carregados`);
      return data.chats || [];
    } catch (error) {
      console.error('❌ Erro ao buscar chats:', error);
      throw error;
    }
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    try {
      const response = await this.makeRequest(`/api/clients/${clientId}/chats/${chatId}/messages?limit=${limit}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar mensagens');
      }
      
      return data.messages;
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error) {
      return false;
    }
  }

  async refreshServerConfig() {
    console.log('🔄 Forçando nova detecção de servidor...');
    resetConnectionCache();
    this.currentConfig = null;
    this.currentConfig = await getServerConfig();
    console.log(`🎯 Nova configuração: ${this.currentConfig.serverUrl}`);
  }
}

// Singleton
export const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
