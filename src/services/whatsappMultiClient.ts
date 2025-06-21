
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '@/config/environment';

export interface ChatData {
  id: string;
  name: string;
  isGroup: boolean;
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
  ticket_id?: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  is_internal_note?: boolean;
  is_ai_response?: boolean;
  processing_status?: 'pending' | 'processing' | 'sent' | 'error';
  message_id?: string;
}

export interface WhatsAppClient {
  clientId: string;
  status: string;
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
}

interface QueueStats {
  pending: number;
  total: number;
}

class WhatsAppService {
  private baseURL: string;
  private socket: Socket | null = null;

  constructor() {
    this.baseURL = SERVER_URL;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
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
        throw new Error('Servidor não está respondendo');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar saúde do servidor:', error);
      throw error;
    }
  }

  connectSocket(): Socket {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(this.baseURL, {
        transports: ['websocket'],
        autoConnect: true,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.log('❌ WebSocket connection error:', err);
      });
    }
    return this.socket;
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('❌ WebSocket disconnected');
    }
  }

  joinClientRoom(clientId: string) {
    if (this.socket) {
      this.socket.emit('joinClientRoom', clientId);
      console.log(`🚪 Joined client room: ${clientId}`);
    }
  }

  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/clients`);
      if (!response.ok) {
        throw new Error('Falha ao buscar clientes');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Falha ao conectar cliente');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao conectar cliente:', error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Falha ao desconectar cliente');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao desconectar cliente:', error);
      throw error;
    }
  }

  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clientsUpdate', callback);
      console.log('👂 Listening for clients updates');
    }
  }

  onClientStatus(clientId: string, callback: (clientData: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`clientStatus_${clientId}`, callback);
      console.log(`👂 Listening for status updates for client: ${clientId}`);
    }
  }

  async sendMessage(clientId: string, chatId: string, message: string, messageId?: string, mediaFile?: File): Promise<any> {
    try {
      if (mediaFile) {
        const formData = new FormData();
        formData.append('chatId', chatId);
        formData.append('media', mediaFile);
        if (message) {
          formData.append('caption', message);
        }

        const response = await fetch(`${this.baseURL}/api/client/${clientId}/sendMedia`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Falha ao enviar mídia');
        }
        return await response.json();
      } else {
        const response = await fetch(`${this.baseURL}/api/client/${clientId}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message,
          }),
        });

        if (!response.ok) {
          throw new Error('Falha ao enviar mensagem');
        }
        return await response.json();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async sendMedia(clientId: string, chatId: string, media: File, caption?: string): Promise<any> {
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('media', media);
    if (caption) {
      formData.append('caption', caption);
    }

    return fetch(`${this.baseURL}/api/client/${clientId}/sendMedia`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  }

  async sendAudio(clientId: string, chatId: string, audio: Blob): Promise<any> {
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('audio', audio);

    return fetch(`${this.baseURL}/api/client/${clientId}/sendAudio`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  }

  async getChats(clientId: string): Promise<ChatData[]> {
    return fetch(`${this.baseURL}/api/client/${clientId}/chats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    return fetch(`${this.baseURL}/api/client/${clientId}/messages?chatId=${chatId}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  async getClientStatus(clientId: string): Promise<any> {
    return fetch(`${this.baseURL}/api/client/${clientId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  async getQueueStats(clientId: string): Promise<QueueStats> {
    return fetch(`${this.baseURL}/api/client/${clientId}/queueStats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  async diagnoseClient(clientId: string): Promise<any> {
    return fetch(`${this.baseURL}/api/client/${clientId}/diagnose`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
      console.log(`👂 Listening for messages for client: ${clientId}`);
    }
  }

  removeListener(event: string) {
    if (this.socket) {
      this.socket.off(event);
      console.log(`👂 Removing listener: ${event}`);
    }
  }

  async sendTypingStatus(clientId: string, chatId: string, isTyping: boolean) {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          isTyping
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send typing status');
      }

      console.log(`📱 Typing status sent to WhatsApp: ${isTyping ? 'typing' : 'stopped'}`);
      return await response.json();
    } catch (error) {
      console.error('Error sending typing status:', error);
      throw error;
    }
  }

  async sendRecordingStatus(clientId: string, chatId: string, isRecording: boolean) {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          isRecording
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send recording status');
      }

      console.log(`🎤 Recording status sent to WhatsApp: ${isRecording ? 'recording' : 'stopped'}`);
      return await response.json();
    } catch (error) {
      console.error('Error sending recording status:', error);
      throw error;
    }
  }

  async markMessageAsRead(clientId: string, chatId: string, messageId: string) {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          messageId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark message as read');
      }

      console.log(`✅ Message marked as read in WhatsApp: ${messageId}`);
      return await response.json();
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  async updatePresence(clientId: string, isOnline: boolean) {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isOnline
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update presence');
      }

      console.log(`👤 Presence updated in WhatsApp: ${isOnline ? 'online' : 'offline'}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating presence:', error);
      throw error;
    }
  }

  onTypingEvent(clientId: string, callback: (data: { chatId: string, isTyping: boolean, contact: string }) => void) {
    if (this.socket) {
      this.socket.on(`typing_${clientId}`, callback);
      console.log(`👂 Listening for typing events for client: ${clientId}`);
    }
  }

  onReadReceiptEvent(clientId: string, callback: (data: { chatId: string, messageId: string, readBy: string, timestamp: string }) => void) {
    if (this.socket) {
      this.socket.on(`read_receipt_${clientId}`, callback);
      console.log(`👂 Listening for read receipt events for client: ${clientId}`);
    }
  }

  removeTypingListener(clientId: string) {
    if (this.socket) {
      this.socket.off(`typing_${clientId}`);
    }
  }

  removeReadReceiptListener(clientId: string) {
    if (this.socket) {
      this.socket.off(`read_receipt_${clientId}`);
    }
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
