import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';

export class CodechatQRService {
  private baseURL = API_BASE_URL;

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const apiKey = getYumerGlobalApiKey();
    if (!apiKey) {
      throw new Error('API Key não configurada');
    }

    console.log(`🔍 [CODECHAT-QR] Request: ${options.method || 'GET'} ${endpoint}`);
    
    // CORREÇÃO CRÍTICA: Usar APENAS apikey header para todos endpoints de instância
    // NUNCA usar Authorization Bearer com API KEY
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': apiKey, // Sempre usar apikey para endpoints de instância
      ...options.headers
    };

    console.log(`🔑 [CODECHAT-QR] Headers:`, { 
      'Content-Type': headers['Content-Type'],
      'Accept': headers['Accept'],
      'apikey': `${apiKey.substring(0, 8)}***` 
    });

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });

      console.log(`📊 [CODECHAT-QR] Response: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [CODECHAT-QR] Error ${response.status}:`, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error || errorData.message || 'Request failed'}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-QR] Success:`, data);
      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-QR] Request failed:`, error);
      throw error;
    }
  }

  async createInstance(instanceName: string, description?: string) {
    console.log(`🚀 [CODECHAT-QR] Criando instância: ${instanceName}`);
    
    return this.makeRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        description: description || `Created via QR Service: ${instanceName}`
      })
    });
  }

  async getInstanceStatus(instanceName: string) {
    console.log(`📊 [CODECHAT-QR] Buscando status via /instance/connectionState/${instanceName}`);
    console.log(`🌐 [CODECHAT-QR] GET ${this.baseURL}/instance/connectionState/${instanceName}`);
    
    return this.makeRequest(`/instance/connectionState/${instanceName}`);
  }

  async getInstanceDetails(instanceName: string) {
    console.log(`📋 [CODECHAT-QR] Buscando detalhes via /instance/fetchInstance/${instanceName}`);
    
    return this.makeRequest(`/instance/fetchInstance/${instanceName}`);
  }

  async connectInstance(instanceName: string) {
    console.log(`🔌 [CODECHAT-QR] Conectando instância: ${instanceName}`);
    
    return this.makeRequest(`/instance/connect/${instanceName}`);
  }

  async disconnectInstance(instanceName: string) {
    console.log(`🔌 [CODECHAT-QR] Desconectando instância: ${instanceName}`);
    
    try {
      const response = await this.makeRequest(`/instance/logout/${instanceName}`, {
        method: 'DELETE'
      });
      return { success: true, data: response };
    } catch (error: any) {
      console.error(`❌ [CODECHAT-QR] Erro ao desconectar:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteInstance(instanceName: string) {
    console.log(`🗑️ [CODECHAT-QR] Deletando instância: ${instanceName}`);
    
    return this.makeRequest(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    });
  }

  async getQRCode(instanceName: string) {
    console.log(`📱 [CODECHAT-QR] Buscando QR Code: ${instanceName}`);
    
    try {
      // Primeiro tentar via connect
      const connectResult = await this.connectInstance(instanceName);
      
      if (connectResult.base64 || connectResult.qrCode) {
        console.log(`✅ [CODECHAT-QR] QR Code obtido via connect`);
        return {
          success: true,
          qrCode: connectResult.base64 || connectResult.qrCode,
          count: connectResult.count
        };
      }

      // Fallback: tentar via detalhes da instância
      const details = await this.getInstanceDetails(instanceName);
      
      if (details.qrCode || (details.Whatsapp?.qr)) {
        console.log(`✅ [CODECHAT-QR] QR Code obtido via fetchInstance`);
        return {
          success: true,
          qrCode: details.qrCode || details.Whatsapp.qr
        };
      }

      console.log(`⚠️ [CODECHAT-QR] QR Code não encontrado`);
      return { success: false, error: 'QR Code não disponível' };

    } catch (error: any) {
      console.error(`❌ [CODECHAT-QR] Erro ao buscar QR Code:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const codechatQRService = new CodechatQRService();
