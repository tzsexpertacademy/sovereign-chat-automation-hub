
import { io, Socket } from 'socket.io-client';

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

interface QueueStats {
  pending: number;
  total: number;
}

class WhatsAppService {
  private baseURL: string;
  private socket: Socket | null = null;

  constructor() {
    // Use environment configuration
    if (typeof window !== 'undefined' && window.location.hostname.includes('lovableproject.com')) {
      this.baseURL = 'https://146.59.227.248';
    } else {
      this.baseURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
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

  // Check server connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  // Check server health
  async checkServerHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server health check failed: ${response.status}`);
    }
    
    return response.json();
  }

  // Get all clients
  async getAllClients(): Promise<any[]> {
    const response = await fetch(`${this.baseURL}/api/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get clients: ${response.status}`);
    }
    
    return response.json();
  }

  // Connect client
  async connectClient(clientId: string): Promise<any> {
    const response = await fetch(`${this.baseURL}/api/client/${clientId}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to connect client: ${response.status}`);
    }
    
    return response.json();
  }

  // Disconnect client
  async disconnectClient(clientId: string): Promise<any> {
    const response = await fetch(`${this.baseURL}/api/client/${clientId}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to disconnect client: ${response.status}`);
    }
    
    return response.json();
  }

  // Listen for clients updates
  onClientsUpdate(callback: (clients: any[]) => void) {
    if (this.socket) {
      this.socket.on('clientsUpdate', callback);
      console.log('👂 Listening for clients updates');
    }
  }

  // Listen for client status updates
  onClientStatus(clientId: string, callback: (clientData: any) => void) {
    if (this.socket) {
      this.socket.on(`clientStatus_${clientId}`, callback);
      console.log(`👂 Listening for client status: ${clientId}`);
    }
  }

  sendMessage(clientId: string, chatId: string, message: string): Promise<any> {
    return fetch(`${this.baseURL}/api/client/${clientId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId,
        message,
      }),
    }).then(res => res.json());
  }

  sendMedia(clientId: string, chatId: string, media: File, caption?: string): Promise<any> {
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

  sendAudio(clientId: string, chatId: string, audio: Blob): Promise<any> {
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('audio', audio);

    return fetch(`${this.baseURL}/api/client/${clientId}/sendAudio`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  }

  getChats(clientId: string): Promise<ChatData[]> {
    return fetch(`${this.baseURL}/api/client/${clientId}/chats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    return fetch(`${this.baseURL}/api/client/${clientId}/messages?chatId=${chatId}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  getClientStatus(clientId: string): Promise<any> {
    return fetch(`${this.baseURL}/api/client/${clientId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  getQueueStats(clientId: string): Promise<QueueStats> {
    return fetch(`${this.baseURL}/api/client/${clientId}/queueStats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  diagnoseClient(clientId: string): Promise<any> {
    return fetch(`${this.baseURL}/api/client/${clientId}/diagnose`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
  }

  async sendReaction(clientId: string, chatId: string, messageId: string, emoji: string) {
    try {
      const response = await fetch(`${this.baseURL}/api/client/${clientId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          messageId,
          emoji
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reaction');
      }

      console.log(`😀 Reação enviada: ${emoji} para mensagem ${messageId}`);
      return await response.json();
    } catch (error) {
      console.error('Error sending reaction:', error);
      throw error;
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

  onQuotedMessage(clientId: string, callback: (data: { 
    chatId: string, 
    messageId: string, 
    quotedMessage: any, 
    newMessage: string 
  }) => void) {
    if (this.socket) {
      this.socket.on(`quoted_message_${clientId}`, callback);
      console.log(`👂 Listening for quoted messages for client: ${clientId}`);
    }
  }

  removeQuotedMessageListener(clientId: string) {
    if (this.socket) {
      this.socket.off(`quoted_message_${clientId}`);
    }
  }

  onPresenceUpdate(clientId: string, callback: (data: { chatId: string, isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.on(`presence_${clientId}`, callback);
      console.log(`👂 Listening for presence updates for client: ${clientId}`);
    }
  }

  removePresenceListener(clientId: string) {
    if (this.socket) {
      this.socket.off(`presence_${clientId}`);
    }
  }
}

export const whatsappService = new WhatsAppService();
