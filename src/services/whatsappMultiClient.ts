import { io, Socket } from 'socket.io-client';

// Configuração inteligente para produção e desenvolvimento
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Se estamos em localhost ou ambiente de desenvolvimento Lovable
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('lovable')) {
      return `${protocol}//${hostname}:4000`;
    }
    
    // Para produção - usar o mesmo hostname/IP do frontend mas porta 4000
    return `${protocol}//${hostname}:4000`;
  }
  
  // Fallback para desenvolvimento
  return 'http://localhost:4000';
};

const API_BASE_URL = `${getBaseURL()}/api`;
const SOCKET_URL = getBaseURL();

console.log(`🔗 Conectando ao servidor: ${SOCKET_URL}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);

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
    console.log(`🌐 Ambiente detectado: ${window.location.hostname}`);
    console.log(`🔗 Servidor alvo: ${getBaseURL()}`);
  }

  // Conectar ao WebSocket com retry automático
  connectSocket(): Socket {
    if (!this.socket) {
      console.log(`🔌 Conectando ao WebSocket: ${SOCKET_URL}`);
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 30000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000
      });

      this.socket.on('connect', () => {
        console.log('✅ Conectado ao servidor WhatsApp Multi-Cliente');
        console.log(`📍 URL: ${SOCKET_URL}`);
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Desconectado do servidor WhatsApp:', reason);
        if (reason === 'io server disconnect') {
          // Reconectar automaticamente se o servidor desconectou
          setTimeout(() => this.reconnect(), 5000);
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('💥 Máximo de tentativas de reconexão atingido');
        }
      });

      this.socket.on('error', (error) => {
        console.error('❌ Erro no WebSocket:', error);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconectado após ${attemptNumber} tentativas`);
      });
    }

    return this.socket;
  }

  // Método de reconexão manual
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    setTimeout(() => {
      this.connectSocket();
    }, 1000);
  }

  // Desconectar WebSocket
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Entrar no room de um cliente específico
  joinClientRoom(clientId: string) {
    if (this.socket) {
      this.socket.emit('join_client', clientId);
      console.log(`📱 Entrou no room do cliente: ${clientId}`);
    }
  }

  // Ouvir atualizações de status de um cliente
  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`client_status_${clientId}`, callback);
    }
  }

  // Ouvir mensagens de um cliente
  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
    }
  }

  // Ouvir atualizações de todos os clientes
  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  // Remover listeners
  removeListener(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // API Calls com timeout e retry
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log(`📡 Buscando clientes: ${API_BASE_URL}/clients`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clients`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
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
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} conectado com sucesso`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao desconectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} desconectado com sucesso`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar status do cliente');
      }
      
      return {
        clientId: data.clientId,
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: !!data.qrCode,
        qrCode: data.qrCode
      };
    } catch (error) {
      console.error(`Erro ao buscar status do cliente ${clientId}:`, error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, mediaUrl?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          message,
          mediaUrl
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
      
      return data;
    } catch (error) {
      console.error(`Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  async getChats(clientId: string): Promise<ChatData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar chats');
      }
      
      return data.chats;
    } catch (error) {
      console.error(`Erro ao buscar chats:`, error);
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
      console.error(`Erro ao buscar mensagens:`, error);
      throw error;
    }
  }

  async checkServerHealth(): Promise<any> {
    try {
      const healthURL = `${getBaseURL()}/health`;
      console.log(`🔍 Verificando saúde do servidor: ${healthURL}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(healthURL, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Servidor saudável:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao verificar saúde do servidor:', error);
      throw error;
    }
  }

  // Método para testar conectividade com retry
  async testConnection(): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await this.checkServerHealth();
        return true;
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`🔄 Tentativa ${attempts}/${maxAttempts} falhou, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    return false;
  }
}

// Singleton instance
export const whatsappService = new WhatsAppMultiClientService();

export default whatsappService;
