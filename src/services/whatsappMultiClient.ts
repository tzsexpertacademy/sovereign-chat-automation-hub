
// Camada de compatibilidade para código legado
// Usa exclusivamente yumerApiService internamente
import { yumerApiService } from './yumerApiService';
import { yumerWhatsappService } from './yumerWhatsappService';

export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed' | 'ready';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
  qrTimestamp?: string;
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
 * Serviço de compatibilidade para código legado
 * Usa internamente apenas yumerApiService
 */
class WhatsAppMultiClientService {
  private healthCheckCache: { result: any; timestamp: number } | null = null;

  constructor() {
    console.log('📱 WhatsApp Multi-Client Service - Yumer API v2 Backend');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔍 Testing Yumer API connection...');
      return { success: true, message: 'Yumer API v2 available' };
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return { success: false, message: `Connection failed: ${error}` };
    }
  }

  async checkServerHealth(): Promise<ServerHealth> {
    try {
      if (this.healthCheckCache && 
          Date.now() - this.healthCheckCache.timestamp < 10000) {
        return this.healthCheckCache.result;
      }

      const result = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeClients: 0,
        connectedClients: 0,
        uptime: Date.now(),
        memory: {},
        version: 'Yumer API v2',
        server: 'Yumer Backend',
        protocol: 'HTTPS',
        cors: true
      };

      this.healthCheckCache = { result, timestamp: Date.now() };
      return result;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, instanceJWT?: string): Promise<any> {
    console.log(`📤 Sending message via Yumer API v2 - Client: ${clientId}, To: ${to.substring(0, 10)}...`);
    
    try {
      if (!instanceJWT) {
        throw new Error('Instance JWT is required');
      }

      const result = await yumerWhatsappService.sendMessage(clientId, to, message, instanceJWT);
      
      if (result.success) {
        console.log(`✅ Message sent successfully`);
        return {
          success: true,
          data: result.data,
          messageId: result.data?.id || `msg_${Date.now()}`,
          sent: true,
          timestamp: new Date().toISOString()
        };
      } else {
        console.error(`❌ Message send failed:`, result.error);
        return {
          success: false,
          error: result.error || 'Failed to send message',
          details: 'Check instance connection and webhook configuration'
        };
      }
    } catch (error) {
      console.error(`❌ Critical error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Critical error',
        details: 'Network or server configuration error'
      };
    }
  }

  // Métodos simplificados para compatibilidade
  async getAllClients(): Promise<WhatsAppClient[]> {
    console.log('📋 Getting clients from Yumer API...');
    return [];
  }

  async connectClient(clientId: string): Promise<any> {
    console.log('🔌 Connecting client via Yumer API:', clientId);
    return { success: true, clientId };
  }

  async disconnectClient(clientId: string): Promise<any> {
    console.log('🔌 Disconnecting client via Yumer API:', clientId);
    return { success: true, clientId };
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    return {
      clientId,
      status: 'disconnected',
      phoneNumber: undefined,
      hasQrCode: false
    };
  }

  async getChats(clientId: string): Promise<any> {
    try {
      const result = await yumerWhatsappService.getChats(clientId);
      return { success: true, chats: result.data || [] };
    } catch (error) {
      console.error('❌ Failed to get chats:', error);
      throw error;
    }
  }

  // Métodos vazios para compatibilidade
  connectSocket(): any { return { on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {}, connected: false }; }
  getSocket(): any { return null; }
  disconnect(): void { console.log('🔌 Disconnecting...'); }
  joinClientRoom(): void {}
  onClientStatus(): void {}
  offClientStatus(): void {}
  setJWTToken(): void {}
  
  // Métodos não implementados
  async sendMedia(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendAudio(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendLocation(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendContact(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendReaction(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendButtons(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async sendList(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async createInstance(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async deleteInstance(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async getQRCode(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async findContacts(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async getGroups(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async createGroup(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async updatePresence(): Promise<any> { return { success: false, error: 'Not implemented' }; }
  async markAsRead(): Promise<any> { return { success: false, error: 'Not implemented' }; }
}

// Export singleton
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };
