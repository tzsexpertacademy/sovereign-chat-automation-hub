
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ChatData = {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: {
    body: string;
    type: string;
    timestamp: number;
    fromMe: boolean;
  };
  timestamp: number;
  description?: string;
  profilePictureUrl?: string;
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
  deviceType?: string;
  self?: string;
  ack?: number;
  isForwarded?: boolean;
  isHistoric?: boolean;
  isMedia?: boolean;
  isMMS?: boolean;
  isRoaming?: boolean;
  mediaKey?: string;
  mediaData?: any;
  filename?: string;
  size?: number;
  mimeType?: string;
  height?: number;
  width?: number;
  thumbnail?: string;
  latitude?: number;
  longitude?: number;
  vcardList?: string[];
  isEncrypted?: boolean;
  broadcast?: boolean;
  mentionedJidList?: string[];
  orderId?: string;
  token?: string;
  totalAmount1000?: number;
  totalCurrencyCode?: string;
  itemCount?: number;
  firstEntrypointConversionApp?: string;
  ephemeralDuration?: number;
  ephemeralOffToSelfExpiration?: number;
  bizClientType?: number;
  status?: number;
  pushName?: string;
  chatId?: string;
  instanceId?: string;
};

export type WhatsAppInstanceData = Tables<"whatsapp_instances"> & {
  custom_name?: string;
};

export type WhatsAppClient = {
  clientId: string;
  status: string;
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
};

export class WhatsAppMultiClientService {
  private baseUrl: string;
  private socket: any;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || 'http://localhost:3002';
    this.socket = null;
  }

  connectSocket() {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(this.baseUrl, {
        transports: ['websocket'],
        autoConnect: false
      });
      this.socket.connect();

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Falha na conexão WebSocket:', error);
      });
    }
    return this.socket;
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 WebSocket desconectado manualmente');
    }
  }

  joinClientRoom(clientId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', clientId);
      console.log(`🚪 Entrando na sala do cliente: ${clientId}`);
    } else {
      console.warn('⚠️ WebSocket não conectado, reconectando...');
      this.connectSocket();
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('join', clientId);
          console.log(`🚪 Entrando na sala do cliente: ${clientId}`);
        } else {
          console.error('❌ Não foi possível conectar ao WebSocket após reconectar.');
        }
      }, 1000);
    }
  }

  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
    } else {
      console.error('❌ WebSocket não conectado. Impossível registrar listener de mensagens.');
    }
  }

  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  onClientStatus(clientId: string, callback: (client: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`client_status_${clientId}`, callback);
    }
  }

  removeListener(event: string) {
    if (this.socket) {
      this.socket.off(event);
      console.log(`👂 Listener removido: ${event}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/clients`);
      if (!response.ok) {
        throw new Error(`Erro ao obter clientes: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar cliente: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao conectar cliente:', error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao desconectar cliente: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao desconectar cliente:', error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status/${clientId}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter status do cliente: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter status do cliente:', error);
      throw error;
    }
  }

  async getChats(clientId: string): Promise<ChatData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chats/${clientId}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter chats: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter chats:', error);
      throw error;
    }
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages/${clientId}/${chatId}?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter mensagens: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter mensagens:', error);
      throw error;
    }
  }

  async sendMessage(clientId: string, chatId: string, message: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async sendMedia(clientId: string, chatId: string, media: any, options: any = {}): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sendMedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          media: media,
          options: options
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mídia: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  async sendFile(clientId: string, chatId: string, file: any, options: any = {}): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sendFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          file: file,
          options: options
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar arquivo: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error);
      throw error;
    }
  }

  async uploadMedia(clientId: string, media: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/uploadMedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          media: media
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mídia: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  async downloadMedia(clientId: string, mediaKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/downloadMedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          mediaKey: mediaKey
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mídia: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  async sendContact(clientId: string, chatId: string, contact: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sendContact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          contact: contact
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar contato: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar contato:', error);
      throw error;
    }
  }

  async sendLocation(clientId: string, chatId: string, latitude: number, longitude: number): Promise<any> {
     try {
      const response = await fetch(`${this.baseUrl}/api/sendLocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          latitude: latitude,
          longitude: longitude
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar localização: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar localização:', error);
      throw error;
    }
  }

  async sendLinkPreview(clientId: string, chatId: string, url: string, text: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sendLinkPreview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          url: url,
          text: text
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar link preview: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao enviar link preview:', error);
      throw error;
    }
  }

  async getInstanceQrCode(instanceId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/qrcode/${instanceId}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter QRCode: ${response.status}`);
      }
      const data = await response.json();
      return data.qrcode;
    } catch (error: any) {
      console.error('Erro ao obter QRCode:', error);
      throw error;
    }
  }

  async startInstance(instanceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: instanceId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao iniciar instância: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao iniciar instância:', error);
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: instanceId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao parar instância: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao parar instância:', error);
      throw error;
    }
  }

  async deleteInstance(instanceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: instanceId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao apagar instância: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao apagar instância:', error);
      throw error;
    }
  }

  async getInstanceInfo(instanceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/instanceInfo/${instanceId}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter informações da instância: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter informações da instância:', error);
      throw error;
    }
  }

  async getAllContacts(instanceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/contacts/${instanceId}`);
      if (!response.ok) {
        throw new Error(`Erro ao obter contatos: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao obter contatos:', error);
      throw error;
    }
  }

  async diagnoseClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/diagnose/${clientId}`);
      if (!response.ok) {
        throw new Error(`Erro ao diagnosticar cliente: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao diagnosticar cliente:', error);
      throw error;
    }
  }

  // Enviar indicador de digitação
  async sendTypingIndicator(clientId: string, chatId: string, isTyping: boolean): Promise<void> {
    try {
      console.log(`⌨️ ${isTyping ? 'Iniciando' : 'Parando'} indicador de digitação para ${chatId}`);
      
      const response = await fetch(`${this.baseUrl}/api/sendPresence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          presence: isTyping ? 'composing' : 'paused'
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar indicador de digitação: ${response.status}`);
      }

      console.log(`✅ Indicador de digitação ${isTyping ? 'iniciado' : 'parado'} com sucesso`);
    } catch (error) {
      console.error('❌ Erro ao enviar indicador de digitação:', error);
      throw error;
    }
  }

  // Enviar indicador de gravação de áudio
  async sendRecordingIndicator(clientId: string, chatId: string, isRecording: boolean): Promise<void> {
    try {
      console.log(`🎤 ${isRecording ? 'Iniciando' : 'Parando'} indicador de gravação para ${chatId}`);
      
      const response = await fetch(`${this.baseUrl}/api/sendPresence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          presence: isRecording ? 'recording' : 'paused'
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar indicador de gravação: ${response.status}`);
      }

      console.log(`✅ Indicador de gravação ${isRecording ? 'iniciado' : 'parado'} com sucesso`);
    } catch (error) {
      console.error('❌ Erro ao enviar indicador de gravação:', error);
      throw error;
    }
  }

  // Marcar mensagem como lida
  async markAsRead(clientId: string, chatId: string, messageId: string): Promise<void> {
    try {
      console.log(`👀 Marcando mensagem ${messageId} como lida em ${chatId}`);
      
      const response = await fetch(`${this.baseUrl}/api/readMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: clientId,
          chatId: chatId,
          messageId: messageId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao marcar mensagem como lida: ${response.status}`);
      }

      console.log(`✅ Mensagem ${messageId} marcada como lida com sucesso`);
    } catch (error) {
      console.error('❌ Erro ao marcar mensagem como lida:', error);
      throw error;
    }
  }

  async diagnoseClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/diagnose/${clientId}`);
      if (!response.ok) {
        throw new Error(`Erro ao diagnosticar cliente: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao diagnosticar cliente:', error);
      throw error;
    }
  }
}

export const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
