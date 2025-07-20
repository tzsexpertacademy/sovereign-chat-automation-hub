// YUMER WhatsApp Backend Integration - Compatibility Layer
import { yumerWhatsAppService, YumerInstance, YumerMessage, YumerChat } from './yumerWhatsappService';
import { yumerJwtService } from './yumerJwtService';
import { API_BASE_URL, SOCKET_URL, HTTPS_SERVER_URL } from '@/config/environment';
import { Socket } from 'socket.io-client';

// Backward compatibility interfaces
export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed' | 'ready';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
  qrTimestamp?: string;
}

export interface QueuedMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
}

export interface ServerHealth {
  status: string;
  timestamp: string;
  activeClients: number;
  connectedClients: number;
  uptime: number;
  memory: any;
  version: string;
  server: string;
  protocol?: string;
  cors?: any;
}

/**
 * LEGACY COMPATIBILITY SERVICE
 * This service maintains backward compatibility while internally using YUMER Backend
 * All methods now delegate to yumerWhatsAppService with improved authentication
 * 
 * @deprecated Use yumerWhatsAppService directly for new code
 */
class WhatsAppMultiClientService {
  private healthCheckCache: { result: any; timestamp: number } | null = null;

  constructor() {
    console.log('📱 Initializing WhatsApp Multi-Client Service (YUMER Backend)...');
    console.log('⚠️ This is a compatibility layer - consider using yumerWhatsAppService directly');
    console.log('Configuration:', {
      API_BASE_URL,
      SOCKET_URL,
      HTTPS_SERVER_URL,
      backend: 'YUMER'
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔍 Testing connection to YUMER backend...');
      
      // Try to fetch instances to test connection
      await yumerWhatsAppService.fetchAllInstances();
      return {
        success: true,
        message: 'YUMER Backend connection successful'
      };
    } catch (error) {
      console.error('❌ YUMER Backend connection failed:', error);
      return {
        success: false,
        message: `Connection failed: ${error}`
      };
    }
  }

  async initializeInstanceAuth(instanceName: string): Promise<void> {
    try {
      console.log(`🔐 Inicializando autenticação para instância: ${instanceName}`);
      const token = await yumerJwtService.generateLocalJWT(instanceName);
      yumerWhatsAppService.setInstanceToken(instanceName, token);
      console.log(`✅ Autenticação configurada para: ${instanceName}`);
    } catch (error) {
      console.error(`❌ Falha ao configurar autenticação para ${instanceName}:`, error);
      throw error;
    }
  }

  connectSocket(instanceName: string = 'default', event: string = 'MESSAGE_RECEIVED'): any {
    console.log('🔌 Connecting via YUMER WebSocket service...');
    
    // Conectar assincronamente no background
    yumerWhatsAppService.connectWebSocket().catch(error => {
      console.error('❌ Erro na conexão WebSocket:', error);
    });
    
    // Retornar um objeto compatível com a interface Socket.IO
    return {
      on: (event: string, handler: Function) => {
        if (event === 'connect') {
          yumerWhatsAppService.onReady();
        } else if (event === 'disconnect') {
          yumerWhatsAppService.onDisconnected();
        } else if (event === 'message') {
          yumerWhatsAppService.onMessageReceived();
        }
      },
      off: (event: string, handler?: Function) => {
        // YUMER service não suporta remoção individual de listeners
        console.log(`🔇 Removendo listener: ${event}`);
      },
      emit: (event: string, data: any) => {
        console.log(`📤 Emitindo evento: ${event}`, data);
      },
      disconnect: () => {
        yumerWhatsAppService.disconnectWebSocket();
      },
      connected: yumerWhatsAppService.isWebSocketConnected()
    };
  }

  getSocket(): any {
    return yumerWhatsAppService.getSocket();
  }

  disconnect(): void {
    console.log('🔌 Disconnecting YUMER WebSocket...');
    yumerWhatsAppService.disconnectWebSocket();
  }

  async checkServerHealth(): Promise<ServerHealth> {
    try {
      if (this.healthCheckCache && 
          Date.now() - this.healthCheckCache.timestamp < 10000) {
        console.log('📋 Using cached YUMER health check');
        return this.healthCheckCache.result;
      }

      const instances = await yumerWhatsAppService.fetchAllInstances();
      const result = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeClients: instances.length,
        connectedClients: instances.filter(i => i.status === 'connected' || i.status === 'ready').length,
        uptime: Date.now(), // Mock uptime
        memory: {},
        version: 'YUMER 2.0',
        server: 'YUMER Backend',
        protocol: 'HTTPS',
        cors: true
      };

      this.healthCheckCache = {
        result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      console.error('❌ YUMER health check failed:', error);
      this.healthCheckCache = null;
      throw error;
    }
  }

  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Getting clients from YUMER...');
      const instances = await yumerWhatsAppService.fetchAllInstances();
      const clients = instances.map(instance => ({
        clientId: instance.instanceName,
        status: instance.status as any,
        phoneNumber: instance.phoneNumber,
        hasQrCode: instance.hasQrCode,
        qrCode: instance.qrCode,
        timestamp: instance.timestamp,
        qrTimestamp: instance.timestamp
      }));
      console.log(`✅ Found ${clients.length} clients from YUMER`);
      return clients;
    } catch (error) {
      console.error('❌ Failed to get clients from YUMER:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      console.log('🔌 Connecting client via YUMER:', clientId);
      
      // Inicializar autenticação para a instância
      await this.initializeInstanceAuth(clientId);
      
      const data = await yumerWhatsAppService.connectInstance(clientId);
      console.log('✅ Client connection initiated:', clientId);
      return data;
    } catch (error) {
      console.error('❌ Failed to connect client via YUMER:', error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log('🔌 Disconnecting client via YUMER:', clientId);
      const data = await yumerWhatsAppService.logoutInstance(clientId);
      console.log('✅ Client disconnected:', clientId);
      return data;
    } catch (error) {
      console.error('❌ Failed to disconnect client via YUMER:', error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      console.log('📊 Getting client status from YUMER:', clientId);
      const instance = await yumerWhatsAppService.getInstanceConnectionState(clientId);
      return {
        clientId: instance.instanceName,
        status: instance.status as any,
        phoneNumber: instance.phoneNumber,
        hasQrCode: instance.hasQrCode,
        qrCode: instance.qrCode,
        timestamp: instance.timestamp,
        qrTimestamp: instance.timestamp
      };
    } catch (error) {
      console.error('❌ Failed to get client status from YUMER:', error);
      throw error;
    }
  }

  joinClientRoom(clientId: string): void {
    const socket = yumerWhatsAppService.getSocket();
    if (socket?.connected) {
      console.log(`📱 Joining YUMER room: ${clientId}`);
      socket.emit('join_instance', clientId);
    } else {
      console.warn('⚠️ YUMER WebSocket not connected');
    }
  }

  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    // REST-only mode - event handlers disabled
    console.log(`🔧 Event handlers disabled - use REST polling instead for ${clientId}`);
  }

  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    console.log(`🔇 Removing YUMER listeners for: ${clientId}`);
    // Note: YUMER service doesn't have individual listener removal
    // This is a limitation of the compatibility layer
  }

  // Send text message with improved authentication
  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log('📤 [CORREÇÃO] Sending message via YUMER:', { 
        clientId, 
        to, 
        preview: message.substring(0, 50) + '...' 
      });

      console.log(`📤 [CORREÇÃO] Usando clientId COMPLETO: ${clientId}`);
      
      // Verificar se já temos token para esta instância
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        console.log(`🔐 Configurando autenticação para instância: ${clientId}`);
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendTextMessage(clientId, to, message);
      console.log('✅ Message sent via YUMER:', { clientId, to });
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send message via YUMER:', error);
      throw error;
    }
  }

  async getChats(clientId: string): Promise<any> {
    try {
      console.log('📱 Getting chats via YUMER:', clientId);
      const chats = await yumerWhatsAppService.findChats(clientId);
      return { 
        success: true, 
        chats: chats.map(chat => ({
          id: chat.id,
          name: chat.name,
          isGroup: chat.isGroup,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          unreadCount: chat.unreadCount
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get chats from YUMER:', error);
      throw error;
    }
  }

  async sendMedia(clientId: string, to: string, file: File, caption?: string): Promise<any> {
    try {
      console.log('📎 Sending media via YUMER:', { 
        clientId, 
        to, 
        fileName: file.name, 
        fileSize: file.size,
        caption: caption?.substring(0, 50) 
      });

      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }

      const data = await yumerWhatsAppService.sendMediaMessage(clientId, to, file, caption);
      console.log('✅ Media sent successfully via YUMER');
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send media via YUMER:', error);
      throw error;
    }
  }

  async sendAudio(clientId: string, to: string, audioFile: File): Promise<any> {
    try {
      console.log('🎤 Sending audio via YUMER:', { 
        clientId, 
        to, 
        fileName: audioFile.name, 
        fileSize: audioFile.size 
      });

      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }

      const data = await yumerWhatsAppService.sendAudioMessage(clientId, to, audioFile);
      console.log('✅ Audio sent successfully via YUMER');
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send audio via YUMER:', error);
      throw error;
    }
  }

  async sendLocation(clientId: string, to: string, latitude: number, longitude: number, description?: string): Promise<any> {
    try {
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendLocation(clientId, to, latitude, longitude, description);
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send location via YUMER:', error);
      throw error;
    }
  }

  async sendContact(clientId: string, to: string, contact: any): Promise<any> {
    try {
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendContact(clientId, to, contact);
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send contact via YUMER:', error);
      throw error;
    }
  }

  async sendReaction(clientId: string, to: string, messageId: string, emoji: string): Promise<any> {
    try {
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendReaction(clientId, to, messageId, emoji);
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Failed to send reaction via YUMER:', error);
      throw error;
    }
  }

  async sendButtons(clientId: string, to: string, text: string, buttons: any[]): Promise<any> {
    try {
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendButtons(clientId, to, text, buttons);
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send buttons via YUMER:', error);
      throw error;
    }
  }

  async sendList(clientId: string, to: string, text: string, buttonText: string, list: any[]): Promise<any> {
    try {
      if (!yumerWhatsAppService.getInstanceToken(clientId)) {
        await this.initializeInstanceAuth(clientId);
      }
      
      const data = await yumerWhatsAppService.sendList(clientId, to, text, buttonText, list);
      return { success: true, messageId: data.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send list via YUMER:', error);
      throw error;
    }
  }

  async createInstance(instanceName: string, customName?: string): Promise<any> {
    try {
      const data = await yumerWhatsAppService.createInstance(instanceName, customName);
      
      // Configurar autenticação para a nova instância
      await this.initializeInstanceAuth(instanceName);
      
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Failed to create instance via YUMER:', error);
      throw error;
    }
  }

  async deleteInstance(instanceName: string): Promise<any> {
    try {
      const data = await yumerWhatsAppService.deleteInstance(instanceName);
      return data;
    } catch (error) {
      console.error('❌ Failed to delete instance via YUMER:', error);
      throw error;
    }
  }

  async getQRCode(instanceName: string): Promise<any> {
    try {
      const data = await yumerWhatsAppService.getQRCode(instanceName);
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Failed to get QR code via YUMER:', error);
      throw error;
    }
  }

  async findContacts(instanceName: string, query: string): Promise<any> {
    try {
      const contacts = await yumerWhatsAppService.findContacts(instanceName, query);
      return { success: true, contacts };
    } catch (error) {
      console.error('❌ Failed to find contacts via YUMER:', error);
      throw error;
    }
  }

  async getGroups(instanceName: string): Promise<any> {
    try {
      const groups = await yumerWhatsAppService.findAllGroups(instanceName);
      return { success: true, groups };
    } catch (error) {
      console.error('❌ Failed to get groups via YUMER:', error);
      throw error;
    }
  }

  async createGroup(instanceName: string, name: string, participants: string[]): Promise<any> {
    try {
      const data = await yumerWhatsAppService.createGroup(instanceName, name, participants);
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Failed to create group via YUMER:', error);
      throw error;
    }
  }

  async updatePresence(instanceName: string, presence: 'available' | 'unavailable' | 'composing' | 'recording'): Promise<any> {
    try {
      const data = await yumerWhatsAppService.updatePresence(instanceName, presence);
      return data;
    } catch (error) {
      console.error('❌ Failed to update presence via YUMER:', error);
      throw error;
    }
  }

  async markAsRead(instanceName: string, chatId: string): Promise<any> {
    try {
      const data = await yumerWhatsAppService.markChatAsRead(instanceName, chatId);
      return data;
    } catch (error) {
      console.error('❌ Failed to mark as read via YUMER:', error);
      throw error;
    }
  }

  setJWTToken(token: string): void {
    yumerWhatsAppService.setJWTToken(token);
  }
}

// Export singleton instance (legacy compatibility)
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };

// Export YUMER service for direct use
export { yumerWhatsAppService };
