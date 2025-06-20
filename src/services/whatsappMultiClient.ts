import { io, Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL } from '@/config/environment';

console.log(`🔗 WhatsApp Service - Conectando ao servidor: ${SERVER_URL}`);

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

  constructor() {
    console.log('🚀 Inicializando WhatsApp Multi-Client Service');
    console.log(`🎯 Servidor fixo: ${SERVER_URL}`);
  }

  // Conectar ao WebSocket
  connectSocket(): Socket {
    if (!this.socket) {
      console.log(`🔌 Conectando ao WebSocket: ${SOCKET_URL}`);
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000
      });

      this.socket.on('connect', () => {
        console.log(`✅ WebSocket conectado: ${SOCKET_URL}`);
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

  // Testar conexão com o servidor
  async testServerConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testando conexão com servidor WhatsApp...');
      const response = await fetch(`${API_BASE_URL}/clients`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error(`❌ Servidor resposta: ${response.status} - ${response.statusText}`);
        return false;
      }
      
      const data = await response.json();
      console.log('✅ Servidor respondendo corretamente:', data);
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar servidor:', error);
      return false;
    }
  }

  // Diagnóstico completo do cliente
  async diagnoseClient(clientId: string): Promise<any> {
    try {
      console.log(`🔍 Executando diagnóstico completo para ${clientId}...`);
      
      // 1. Testar conexão com servidor
      const serverOk = await this.testServerConnection();
      
      // 2. Verificar status do cliente
      const clientStatus = await this.getClientStatus(clientId);
      
      // 3. Verificar health do servidor
      const serverHealth = await this.checkServerHealth();
      
      return {
        serverConnected: serverOk,
        clientStatus,
        serverHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      return {
        serverConnected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // API Calls
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log(`📡 GET ${API_BASE_URL}/clients`);
      
      const response = await fetch(`${API_BASE_URL}/clients`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
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
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/status`);
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
      console.log('📤 Enviando mensagem:', { clientId, to, message: message.substring(0, 50), hasFile: !!file });
      
      if (file) {
        // Envio de arquivo
        const formData = new FormData();
        formData.append('to', to);
        formData.append('file', file);
        if (message) {
          formData.append('caption', message);
        }

        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-media`, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar arquivo');
        }
        
        console.log('✅ Arquivo enviado com sucesso');
        return data;
      } else {
        // Envio de mensagem de texto
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, message, mediaUrl })
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
      console.log(`📡 GET ${API_BASE_URL}/clients/${clientId}/chats (tentativa ${retryCount + 1})`);
      
      // Antes de tentar buscar chats, fazer diagnóstico
      if (retryCount === 0) {
        const diagnosis = await this.diagnoseClient(clientId);
        console.log('📊 Diagnóstico do cliente:', diagnosis);
        
        if (!diagnosis.serverConnected) {
          throw new Error('Servidor WhatsApp não está respondendo. Verifique se o servidor está funcionando.');
        }
        
        if (diagnosis.clientStatus?.status !== 'connected') {
          throw new Error(`WhatsApp não está conectado (status: ${diagnosis.clientStatus?.status}). Conecte primeiro na aba "Conexão".`);
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats`, {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000 // 30 segundos timeout
      });
      
      console.log(`📡 Resposta do servidor: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro do servidor: ${errorText}`);
        throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('❌ API retornou erro:', data.error);
        throw new Error(data.error || 'Erro ao buscar chats');
      }
      
      console.log(`✅ ${data.chats.length} chats carregados com sucesso`);
      return data.chats;
      
    } catch (error: any) {
      console.error(`❌ Erro ao buscar chats (tentativa ${retryCount + 1}):`, error);
      
      // Se é erro de rede/timeout e ainda há tentativas
      if (retryCount < 2 && (error.name === 'TypeError' || error.message.includes('timeout'))) {
        console.log(`🔄 Tentando novamente em 3 segundos... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.getChats(clientId, retryCount + 1);
      }
      
      throw error;
    }
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats/${chatId}/messages?limit=${limit}`);
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

  async checkServerHealth(): Promise<any> {
    try {
      const healthURL = `${SERVER_URL}/health`;
      console.log(`🔍 Health check: ${healthURL}`);
      
      const response = await fetch(healthURL, {
        headers: { 'Content-Type': 'application/json' }
      });
      
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

  async testConnection(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton
export const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
