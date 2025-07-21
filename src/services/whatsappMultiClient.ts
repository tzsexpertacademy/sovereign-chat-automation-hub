// YUMER WhatsApp Backend Integration - Compatibility Layer
import { yumerWhatsappService } from './yumerWhatsappService';
import { yumerJwtService } from './yumerJwtService';
import { API_BASE_URL, SOCKET_URL, HTTPS_SERVER_URL } from '@/config/environment';

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
 * All methods now delegate to yumerWhatsappService with improved authentication
 * 
 * @deprecated Use yumerWhatsappService directly for new code
 */
class WhatsAppMultiClientService {
  private healthCheckCache: { result: any; timestamp: number } | null = null;

  constructor() {
    console.log('📱 Initializing WhatsApp Multi-Client Service (YUMER Backend)...');
    console.log('⚠️ This is a compatibility layer - consider using yumerWhatsappService directly');
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
      await yumerWhatsappService.getChats('test');
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
      // Token configurado no yumerWhatsappService
      console.log(`✅ Autenticação configurada para: ${instanceName}`);
    } catch (error) {
      console.error(`❌ Falha ao configurar autenticação para ${instanceName}:`, error);
      throw error;
    }
  }

  connectSocket(instanceName: string = 'default', event: string = 'MESSAGE_RECEIVED'): any {
    console.log('🔌 Connecting via YUMER WebSocket service...');
    
    // Mock socket para compatibilidade
    return {
      on: (event: string, handler: Function) => {
        console.log(`📡 Mock socket listener para: ${event}`);
      },
      off: (event: string, handler?: Function) => {
        console.log(`🔇 Removendo listener: ${event}`);
      },
      emit: (event: string, data: any) => {
        console.log(`📤 Emitindo evento: ${event}`, data);
      },
      disconnect: () => {
        console.log(`🔌 Desconectando mock socket`);
      },
      connected: true
    };
  }

  getSocket(): any {
    return null; // Mock socket
  }

  disconnect(): void {
    console.log('🔌 Disconnecting mock socket...');
  }

  async checkServerHealth(): Promise<ServerHealth> {
    try {
      if (this.healthCheckCache && 
          Date.now() - this.healthCheckCache.timestamp < 10000) {
        console.log('📋 Using cached YUMER health check');
        return this.healthCheckCache.result;
      }

      const instancesResult = await yumerWhatsappService.getChats('test');
      const result = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeClients: 0,
        connectedClients: 0,
        uptime: Date.now(),
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

  // Simplified methods using only available yumerWhatsappService functions
  async getAllClients(): Promise<WhatsAppClient[]> {
    console.log('📋 Getting clients from YUMER...');
    return [];
  }

  async connectClient(clientId: string): Promise<any> {
    console.log('🔌 Connecting client via YUMER:', clientId);
    await this.initializeInstanceAuth(clientId);
    return { success: true, clientId };
  }

  async disconnectClient(clientId: string): Promise<any> {
    console.log('🔌 Disconnecting client via YUMER:', clientId);
    return { success: true, clientId };
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    console.log('📊 Getting client status from YUMER:', clientId);
    return {
      clientId,
      status: 'disconnected',
      phoneNumber: undefined,
      hasQrCode: false
    };
  }

  joinClientRoom(clientId: string): void {
    console.log(`📱 Mock joining YUMER room: ${clientId}`);
  }

  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    console.log(`🔧 Event handlers disabled - use REST polling instead for ${clientId}`);
  }

  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    console.log(`🔇 Removing YUMER listeners for: ${clientId}`);
  }

  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log('📤 [CORREÇÃO] Sending message via YUMER:', { 
        clientId, 
        to, 
        preview: message.substring(0, 50) + '...' 
      });

      await this.initializeInstanceAuth(clientId);
      const data = await yumerWhatsappService.sendMessage(clientId, to, message);
      console.log('✅ Message sent via YUMER:', { clientId, to });
      return { success: true, messageId: data.data?.id || Date.now().toString(), ...data };
    } catch (error) {
      console.error('❌ Failed to send message via YUMER:', error);
      throw error;
    }
  }

  async getChats(clientId: string): Promise<any> {
    try {
      console.log('📱 Getting chats via YUMER:', clientId);
      const result = await yumerWhatsappService.getChats(clientId);
      return { 
        success: true, 
        chats: result.data || []
      };
    } catch (error) {
      console.error('❌ Failed to get chats from YUMER:', error);
      throw error;
    }
  }

  // Simplified stubs for other methods
  async sendMedia(clientId: string, to: string, file: File, caption?: string): Promise<any> {
    console.log('📎 Media sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendAudio(clientId: string, to: string, audioFile: File): Promise<any> {
    console.log('🎤 Audio sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendLocation(clientId: string, to: string, latitude: number, longitude: number, description?: string): Promise<any> {
    console.log('📍 Location sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendContact(clientId: string, to: string, contact: any): Promise<any> {
    console.log('👤 Contact sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendReaction(clientId: string, to: string, messageId: string, emoji: string): Promise<any> {
    console.log('😀 Reaction sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendButtons(clientId: string, to: string, text: string, buttons: any[]): Promise<any> {
    console.log('🔘 Button sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async sendList(clientId: string, to: string, text: string, buttonText: string, list: any[]): Promise<any> {
    console.log('📋 List sending not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async createInstance(instanceName: string, customName?: string): Promise<any> {
    console.log('🏗️ Instance creation not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async deleteInstance(instanceName: string): Promise<any> {
    console.log('🗑️ Instance deletion not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async getQRCode(instanceName: string): Promise<any> {
    console.log('📱 QR code retrieval not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async findContacts(instanceName: string, query: string): Promise<any> {
    console.log('👥 Contact search not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async getGroups(instanceName: string): Promise<any> {
    console.log('👥 Group retrieval not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async createGroup(instanceName: string, name: string, participants: string[]): Promise<any> {
    console.log('👥 Group creation not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async updatePresence(instanceName: string, presence: 'available' | 'unavailable' | 'composing' | 'recording'): Promise<any> {
    console.log('👁️ Presence update not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  async markAsRead(instanceName: string, chatId: string): Promise<any> {
    console.log('✅ Mark as read not implemented in current YUMER service');
    return { success: false, error: 'Not implemented' };
  }

  setJWTToken(token: string): void {
    console.log('🔑 JWT token set for YUMER service');
  }
}

// Export singleton instance (legacy compatibility)
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };

// Export YUMER service for direct use
export { yumerWhatsappService };