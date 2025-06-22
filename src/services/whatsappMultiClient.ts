
import io, { Socket } from 'socket.io-client';

export interface WhatsAppClient {
  id: string;
  clientId: string;
  socket: Socket;
  isConnected: boolean;
  phoneNumber?: string;
  status: string;
  hasQrCode: boolean;
  qrCode?: string;
}

export interface MessageData {
  id: string;
  from: string;
  to?: string;
  body: string;
  timestamp: number;
  type: string;
  fromMe: boolean;
  chatId: string;
  sender?: string;
  notifyName?: string;
  content?: string;
  message_type?: string;
  media_url?: string;
  mediaUrl?: string;
}

class WhatsAppMultiClientService {
  private clients: Map<string, WhatsAppClient> = new Map();
  private baseURL = 'https://146.59.227.248';
  private socket: Socket | null = null;

  // Conectar socket principal
  connectSocket(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(this.baseURL, {
      transports: ['websocket'],
      timeout: 10000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket conectado ao servidor WhatsApp');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket desconectado do servidor WhatsApp');
    });

    return this.socket;
  }

  // Desconectar socket principal
  disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Entrar na sala de um cliente
  joinClientRoom(clientId: string) {
    const socket = this.connectSocket();
    socket.emit('join-room', clientId);
    console.log(`🏠 Entrando na sala do cliente: ${clientId}`);
  }

  // Testar conexão com servidor
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      return response.ok;
    } catch (error) {
      console.error('❌ Erro ao testar conexão:', error);
      return false;
    }
  }

  // Buscar todos os clientes
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/clients`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.clients || [];
    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      return [];
    }
  }

  // Conectar cliente específico
  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🚀 Conectando cliente: ${clientId}`);
      
      const response = await fetch(`${this.baseURL}/api/clients/${clientId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Cliente conectado:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao conectar cliente:', error);
      throw error;
    }
  }

  // Desconectar cliente específico
  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      
      const response = await fetch(`${this.baseURL}/api/clients/${clientId}/disconnect`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Cliente desconectado:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao desconectar cliente:', error);
      throw error;
    }
  }

  // Buscar status de cliente específico
  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      const response = await fetch(`${this.baseURL}/api/clients/${clientId}/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        id: clientId,
        clientId: clientId,
        socket: {} as Socket,
        isConnected: data.status === 'connected',
        phoneNumber: data.phoneNumber,
        status: data.status,
        hasQrCode: data.hasQrCode || false,
        qrCode: data.qrCode
      };
    } catch (error) {
      console.error('❌ Erro ao buscar status do cliente:', error);
      throw error;
    }
  }

  // Verificar saúde do servidor
  async checkServerHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao verificar saúde do servidor:', error);
      throw error;
    }
  }

  // Listeners para eventos em tempo real
  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void): void {
    const socket = this.connectSocket();
    socket.on('clients-update', callback);
  }

  onClientStatus(clientId: string, callback: (client: WhatsAppClient) => void): void {
    const socket = this.connectSocket();
    socket.on(`client-status-${clientId}`, callback);
  }

  // Buscar status de uma instância
  async getInstanceStatus(instanceId: string): Promise<any> {
    try {
      console.log('📱 Buscando status da instância:', instanceId);
      
      const response = await fetch(`${this.baseURL}/api/clients/${instanceId}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Status da instância:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar status da instância:', error);
      throw error;
    }
  }

  // Criar nova instância
  async createInstance(clientId: string): Promise<any> {
    try {
      console.log('🆕 Criando nova instância para cliente:', clientId);
      
      const response = await fetch(`${this.baseURL}/api/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Instância criada:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar instância:', error);
      throw error;
    }
  }

  // Enviar mensagem usando instanceId correto
  async sendMessage(clientId: string, to: string, message: string, hasFile = false, mediaUrl?: string): Promise<any> {
    try {
      console.log('📤 Enviando mensagem:', {
        clientId,
        to,
        message,
        hasFile,
        hasMediaUrl: !!mediaUrl
      });

      // Buscar o instanceId real do banco
      const { data: client, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('clients')
        .select('instance_id')
        .eq('id', clientId)
        .single();

      if (error || !client?.instance_id) {
        throw new Error('Cliente não encontrado ou sem instância ativa');
      }

      const instanceId = client.instance_id;
      console.log('🔍 Usando instanceId:', instanceId);

      // Verificar se a instância está ativa
      const status = await this.getInstanceStatus(instanceId);
      if (!status.success || status.status !== 'connected') {
        throw new Error('Instância não está conectada');
      }

      const payload = {
        to,
        message,
        hasFile,
        mediaUrl
      };

      const response = await fetch(`${this.baseURL}/api/clients/${instanceId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Mensagem enviada com sucesso:', result);
      
      return result;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  // Métodos adicionais para compatibilidade
  async sendReaction(clientId: string, messageId: string, reaction: string): Promise<any> {
    console.log('🎭 Enviando reação:', { clientId, messageId, reaction });
    // Implementação futura
    return { success: true };
  }

  async setTyping(clientId: string, chatId: string, isTyping: boolean): Promise<any> {
    console.log('⌨️ Definindo status de digitação:', { clientId, chatId, isTyping });
    // Implementação futura
    return { success: true };
  }

  async setRecording(clientId: string, chatId: string, isRecording: boolean): Promise<any> {
    console.log('🎙️ Definindo status de gravação:', { clientId, chatId, isRecording });
    // Implementação futura
    return { success: true };
  }

  async markAsRead(clientId: string, messageId: string): Promise<any> {
    console.log('👁️ Marcando como lida:', { clientId, messageId });
    // Implementação futura
    return { success: true };
  }

  onClientMessage(instanceId: string, callback: (message: MessageData) => void): void {
    console.log('👂 Registrando listener para mensagens:', instanceId);
    // Implementação futura para escutar mensagens
  }

  removeListener(event: string, callback: Function): void {
    console.log('🔇 Removendo listener:', event);
    // Implementação futura
  }

  // Buscar QR Code de uma instância
  async getQRCode(instanceId: string): Promise<string | null> {
    try {
      const status = await this.getInstanceStatus(instanceId);
      return status.qrCode || null;
    } catch (error) {
      console.error('❌ Erro ao buscar QR Code:', error);
      return null;
    }
  }

  // Reconectar instância
  async reconnectInstance(instanceId: string): Promise<any> {
    try {
      console.log('🔄 Reconectando instância:', instanceId);
      
      const response = await fetch(`${this.baseURL}/api/clients/${instanceId}/reconnect`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Instância reconectada:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao reconectar instância:', error);
      throw error;
    }
  }

  // Buscar conversas de uma instância
  async getConversations(instanceId: string): Promise<any[]> {
    try {
      console.log('💬 Buscando conversas da instância:', instanceId);
      
      const response = await fetch(`${this.baseURL}/api/clients/${instanceId}/conversations`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Conversas encontradas:', data?.conversations?.length || 0);
      
      return data.conversations || [];
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      return [];
    }
  }

  // Buscar mensagens de um chat
  async getChatMessages(instanceId: string, chatId: string): Promise<any[]> {
    try {
      console.log('📨 Buscando mensagens do chat:', { instanceId, chatId });
      
      const response = await fetch(`${this.baseURL}/api/clients/${instanceId}/chats/${encodeURIComponent(chatId)}/messages`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Mensagens encontradas:', data?.messages?.length || 0);
      
      return data.messages || [];
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens do chat:', error);
      return [];
    }
  }
}

export const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
