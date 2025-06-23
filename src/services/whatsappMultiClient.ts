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

  // Atualizar presença (status online)
  async updatePresence(clientId: string, presence: 'available' | 'unavailable' | 'composing' | 'recording'): Promise<any> {
    try {
      console.log(`👤 Atualizando presença para ${clientId}: ${presence}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presence })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao atualizar presença');
      }
      
      console.log(`✅ Presença atualizada: ${presence}`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao atualizar presença ${clientId}:`, error);
      throw error;
    }
  }

  // Indicador de digitação
  async setTyping(clientId: string, chatId: string, isTyping: boolean): Promise<any> {
    try {
      console.log(`⌨️ ${isTyping ? 'Iniciando' : 'Parando'} indicador de digitação para ${chatId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/set-typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isTyping })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao definir status de digitação');
      }
      
      console.log(`✅ Status de digitação atualizado: ${isTyping}`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao definir digitação:`, error);
      // Não fazer throw para não quebrar o fluxo
      return { success: false, error: error.message };
    }
  }

  // Indicador de gravação
  async setRecording(clientId: string, chatId: string, isRecording: boolean): Promise<any> {
    try {
      console.log(`🎤 ${isRecording ? 'Iniciando' : 'Parando'} indicador de gravação para ${chatId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/set-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isRecording })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao definir status de gravação');
      }
      
      console.log(`✅ Status de gravação atualizado: ${isRecording}`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao definir gravação:`, error);
      // Não fazer throw para não quebrar o fluxo
      return { success: false, error: error.message };
    }
  }

  // Marcar mensagem como lida
  async markAsRead(clientId: string, chatId: string, messageId: string): Promise<any> {
    try {
      console.log(`✓ Marcando mensagem como lida: ${messageId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/mark-as-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, messageId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao marcar como lida');
      }
      
      console.log(`✅ Mensagem marcada como lida`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao marcar como lida:`, error);
      // Não fazer throw para não quebrar o fluxo
      return { success: false, error: error.message };
    }
  }

  // Enviar reação a uma mensagem
  async sendReaction(clientId: string, chatId: string, messageId: string, emoji: string): Promise<any> {
    try {
      console.log(`🎭 Enviando reação ${emoji} para mensagem ${messageId} em ${chatId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId, 
          messageId, 
          emoji 
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao enviar reação');
      }
      
      console.log(`✅ Reação ${emoji} enviada com sucesso`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao enviar reação:`, error);
      throw error;
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

  // Validar e formatar Chat ID corretamente
  private formatChatId(chatId: string): string {
    console.log('📋 Formatando Chat ID:', chatId);
    
    // Remove espaços e caracteres especiais
    let formattedId = chatId.trim();
    
    // Se já tem @c.us ou @g.us, remove para reformatar
    formattedId = formattedId.replace(/@c\.us|@g\.us/g, '');
    
    // Remove caracteres não numéricos (exceto + no início)
    formattedId = formattedId.replace(/[^\d+]/g, '');
    
    // Remove + do início se existir
    if (formattedId.startsWith('+')) {
      formattedId = formattedId.substring(1);
    }
    
    // Validar se é um número válido
    if (!/^\d+$/.test(formattedId)) {
      throw new Error(`ID do chat inválido: ${chatId}. Deve conter apenas números.`);
    }
    
    // Adicionar sufixo @c.us para chat individual
    const finalId = `${formattedId}@c.us`;
    
    console.log(`✅ Chat ID formatado: ${chatId} -> ${finalId}`);
    return finalId;
  }

  // Validar se o cliente está conectado
  private async validateClientConnection(clientId: string): Promise<void> {
    try {
      console.log(`🔍 Validando conexão do cliente: ${clientId}`);
      
      const status = await this.getClientStatus(clientId);
      
      if (status.status !== 'connected') {
        throw new Error(`WhatsApp não está conectado (status: ${status.status}). Reconecte na aba "Conexão".`);
      }
      
      console.log(`✅ Cliente ${clientId} está conectado`);
    } catch (error) {
      console.error(`❌ Erro na validação de conexão:`, error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, mediaUrl?: string, file?: File): Promise<any> {
    try {
      console.log('📤 Iniciando envio de mensagem:', { 
        clientId, 
        to, 
        message: message.substring(0, 50), 
        hasFile: !!file,
        hasMediaUrl: !!mediaUrl 
      });
      
      // 1. Validar conexão do cliente PRIMEIRO
      await this.validateClientConnection(clientId);
      
      // 2. Formatar e validar o Chat ID
      const formattedChatId = this.formatChatId(to);
      
      // 3. Validar mensagem
      if (!message?.trim() && !file && !mediaUrl) {
        throw new Error('Mensagem, arquivo ou URL de mídia é obrigatório');
      }
      
      if (file) {
        // Envio de arquivo
        console.log('📎 Enviando arquivo:', { 
          type: file.type, 
          size: file.size, 
          name: file.name 
        });
        
        const formData = new FormData();
        formData.append('to', formattedChatId.replace('@c.us', '')); // Servidor espera sem @c.us
        formData.append('file', file);
        
        if (message && message.trim()) {
          formData.append('caption', message.trim());
        }

        // Determinar endpoint baseado no tipo de arquivo
        let endpoint = 'send-document';
        if (file.type.startsWith('image/')) {
          endpoint = 'send-image';
        } else if (file.type.startsWith('video/')) {
          endpoint = 'send-video';
        } else if (file.type.startsWith('audio/')) {
          endpoint = 'send-audio';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos para arquivos

        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/${endpoint}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro do servidor (${response.status}):`, errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
          }
          throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar arquivo');
        }
        
        console.log('✅ Arquivo enviado com sucesso');
        return data;
        
      } else if (mediaUrl) {
        // Envio com URL de mídia
        console.log('🌐 Enviando mídia por URL:', mediaUrl);
        
        const payload = {
          to: formattedChatId.replace('@c.us', ''), // Servidor espera sem @c.us
          message: message?.trim() || '',
          mediaUrl: mediaUrl.trim()
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-media-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro do servidor (${response.status}):`, errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
          }
          throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro ao enviar mídia');
        }
        
        console.log('✅ Mídia enviada com sucesso');
        return data;
        
      } else {
        // Envio de mensagem de texto
        console.log('💬 Enviando mensagem de texto');
        
        const payload = { 
          to: formattedChatId.replace('@c.us', ''), // Servidor espera sem @c.us
          message: message.trim()
        };

        console.log('📤 Payload da mensagem:', payload);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos para texto

        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📡 Resposta do servidor: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro do servidor (${response.status}):`, errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
          }
          
          // Tratar erros específicos do WhatsApp
          if (errorData.error?.includes('wid error: invalid wid')) {
            throw new Error(`Número de telefone inválido: ${to}. Verifique o formato.`);
          }
          
          throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          console.error('❌ API retornou erro:', data.error);
          
          // Tratar erros específicos do WhatsApp
          if (data.error?.includes('wid error: invalid wid')) {
            throw new Error(`Número de telefone inválido: ${to}. Verifique se está no formato correto (ex: 5511999999999).`);
          }
          
          throw new Error(data.error || 'Erro ao enviar mensagem');
        }
        
        console.log('✅ Mensagem enviada com sucesso');
        return data;
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      // Melhorar mensagens de erro específicas
      if (error.message.includes('wid error: invalid wid')) {
        throw new Error(`Número de telefone inválido: ${to}. Verifique se está no formato correto (ex: 5511999999999).`);
      } else if (error.message.includes('getChat')) {
        throw new Error('Erro interno do WhatsApp. Tente reconectar a instância.');
      } else if (error.message.includes('timeout') || error.name === 'AbortError') {
        throw new Error('Timeout ao enviar mensagem. Verifique a conexão.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Erro de conexão com o servidor WhatsApp.');
      } else if (error.message.includes('não está conectado')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw error;
    }
  }

  async getChats(clientId: string, retryCount = 0): Promise<ChatData[]> {
    try {
      console.log(`📡 GET ${API_BASE_URL}/clients/${clientId}/chats (tentativa ${retryCount + 1})`);
      
      // Verificar estado do cliente antes de buscar chats
      if (retryCount === 0) {
        try {
          const status = await this.getClientStatus(clientId);
          console.log('📊 Status do cliente:', status);
          
          if (status.status !== 'connected') {
            throw new Error(`WhatsApp não está conectado (status: ${status.status}). Conecte-se primeiro na aba "Conexão".`);
          }
        } catch (statusError) {
          console.warn('⚠️ Não foi possível verificar status, tentando buscar chats mesmo assim');
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats`, {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Resposta do servidor: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro do servidor: ${errorText}`);
        
        let errorObj;
        try {
          errorObj = JSON.parse(errorText);
        } catch {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        // Se for erro de estado, aguardar um pouco e tentar novamente
        if (errorObj.error && errorObj.error.includes('Estado atual:') && retryCount < 2) {
          console.log('🔄 Cliente ainda não está pronto, aguardando...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.getChats(clientId, retryCount + 1);
        }
        
        throw new Error(errorObj.error || `Erro ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('❌ API retornou erro:', data.error);
        
        // Se for erro de serialização, aguardar e tentar novamente
        if (data.error && data.error.includes('_serialized') && retryCount < 3) {
          console.log('🔄 Erro de serialização, aguardando e tentando novamente...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          return this.getChats(clientId, retryCount + 1);
        }
        
        throw new Error(data.error || 'Erro ao buscar chats');
      }
      
      console.log(`✅ ${data.chats.length} chats carregados com sucesso`);
      return data.chats || [];
      
    } catch (error: any) {
      console.error(`❌ Erro ao buscar chats (tentativa ${retryCount + 1}):`, error);
      
      // Tentar novamente para erros de rede/timeout
      if (retryCount < 3 && (
        error.name === 'TypeError' || 
        error.name === 'AbortError' || 
        error.message.includes('timeout') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('_serialized')
      )) {
        console.log(`🔄 Tentando novamente em 5 segundos... (${retryCount + 1}/4)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
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
