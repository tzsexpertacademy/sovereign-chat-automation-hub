import { io, Socket } from 'socket.io-client';

export type ChatData = {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: {
    body: string;
    type: string;
    timestamp: number;
    fromMe: boolean;
  };
  timestamp: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
};

export type MessageData = {
  id: string;
  body: string;
  from: string;
  to: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  author?: string;
  // Outros campos relevantes
};

export type WhatsAppClient = {
  clientId: string;
  status: string;
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
};

class WhatsAppMultiClientService {
  private baseURL: string;
  private socket: Socket | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || 'http://localhost:3002';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      return response.ok;
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return false;
    }
  }

  async checkServerHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      if (!response.ok) {
        throw new Error(`Erro no health check: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro no health check:', error);
      throw error;
    }
  }

  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await fetch(`${this.baseURL}/clients`);
      if (!response.ok) {
        throw new Error(`Erro ao obter clientes: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao obter todos os clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Erro ao conectar cliente: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao conectar cliente:', error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Erro ao desconectar cliente: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao desconectar cliente:', error);
      throw error;
    }
  }

  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void): void {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  onClientStatus(clientId: string, callback: (clientData: WhatsAppClient) => void): void {
    if (this.socket) {
      const statusEvent = `client_status_${clientId}`;
      this.socket.on(statusEvent, callback);
    }
  }

  connectSocket(): Socket {
    if (this.socket && this.socket.connected) {
      console.log('Socket já conectado.');
      return this.socket;
    }

    console.log('Conectando ao WebSocket...');
    this.socket = io(this.baseURL, {
      transports: ['websocket'],
      autoConnect: true,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('WebSocket conectado!');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket desconectado:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erro na conexão WebSocket:', error);
    });

    return this.socket;
  }

  disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('WebSocket desconectado.');
    }
  }

  joinClientRoom(clientId: string): void {
    if (this.socket && this.socket.connected) {
      console.log(`Entrando na sala do cliente: ${clientId}`);
      this.socket.emit('join', clientId);
    } else {
      console.warn('Socket não conectado. Impossível entrar na sala.');
    }
  }

  onClientMessage(clientId: string, callback: (message: MessageData) => void): void {
    if (this.socket) {
      const messageEvent = `message_${clientId}`;
      console.log(`Ouvindo evento: ${messageEvent}`);
      this.socket.on(messageEvent, callback);
    } else {
      console.warn('Socket não conectado. Impossível ouvir mensagens.');
    }
  }

  removeListener(event: string): void {
    if (this.socket) {
      this.socket.off(event);
      console.log(`Listener removido: ${event}`);
    }
  }

  async getChats(clientId: string): Promise<ChatData[]> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/chats`);
      if (!response.ok) {
        throw new Error(`Erro ao obter chats: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao obter chats:', error);
      throw error;
    }
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/chat/${chatId}/messages?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter mensagens do chat: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao obter mensagens do chat:', error);
      throw error;
    }
  }

  async sendMessage(clientId: string, chatId: string, message: string): Promise<any> {
    try {
      console.log('Enviando mensagem:', { clientId, chatId, message });
      const response = await fetch(`${this.baseURL}/client/${clientId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, message }),
      });
      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async sendMedia(clientId: string, chatId: string, media: File, message?: string): Promise<any> {
    try {
      console.log('Enviando media:', { clientId, chatId, media: media.name, message });
      
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('media', media);
      if (message) {
        formData.append('message', message);
      }
  
      const response = await fetch(`${this.baseURL}/client/${clientId}/send-media`, {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(`Erro ao enviar mídia: ${response.status}`);
      }
  
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/status`);
      if (!response.ok) {
        throw new Error(`Erro ao obter status do cliente: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao obter status do cliente:', error);
      throw error;
    }
  }

  async diagnoseClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}/diagnose`);
      if (!response.ok) {
        throw new Error(`Erro ao diagnosticar cliente: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao diagnosticar cliente:', error);
      throw error;
    }
  }

  async markAsRead(clientId: string, chatId: string): Promise<boolean> {
    try {
      console.log('👁️ Marcando mensagens como lidas:', { clientId, chatId });
      
      const response = await fetch(`${this.baseURL}/client/${clientId}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });

      if (!response.ok) {
        throw new Error(`Erro ao marcar como lida: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Mensagens marcadas como lidas');
      return result.success;
    } catch (error) {
      console.error('❌ Erro ao marcar mensagens como lidas:', error);
      return false;
    }
  }

  async sendPresence(clientId: string, chatId: string, presence: 'typing' | 'recording' | 'available'): Promise<boolean> {
    try {
      console.log('⌨️ Enviando presença:', { clientId, chatId, presence });
      
      const response = await fetch(`${this.baseURL}/client/${clientId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, presence })
      });

      if (!response.ok) {
        console.warn(`Erro ao enviar presença: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar presença:', error);
      return false;
    }
  }

  // Nova função para detectar quando cliente está respondendo
  onClientTyping(clientId: string, callback: (data: { chatId: string, isTyping: boolean }) => void): void {
    if (this.socket) {
      const typingEvent = `client_typing_${clientId}`;
      console.log(`🎧 Listener configurado para: ${typingEvent}`);
      this.socket.on(typingEvent, callback);
    }
  }

  // Nova função para notificar que cliente marcou conversa para responder
  async notifyClientResponding(clientId: string, chatId: string): Promise<boolean> {
    try {
      console.log('📱 Notificando que cliente vai responder:', { clientId, chatId });
      
      const response = await fetch(`${this.baseURL}/client/${clientId}/client-responding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, responding: true })
      });

      if (!response.ok) {
        console.warn(`Erro ao notificar cliente respondendo: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao notificar cliente respondendo:', error);
      return false;
    }
  }
}

const whatsappService = new WhatsAppMultiClientService();
export { whatsappService };
