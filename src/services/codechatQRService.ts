
import { getYumerGlobalApiKey } from '@/config/environment';
import { serverConfigService } from './serverConfigService';

export class CodechatQRService {
  private config = serverConfigService.getConfig();

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
      const response = await fetch(`${this.config.serverUrl}${endpoint}`, {
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
    console.log(`🌐 [CODECHAT-QR] GET ${this.config.serverUrl}/instance/connectionState/${instanceName}`);
    
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

  // NOVO MÉTODO SIMPLIFICADO - BASEADO NA SUA IMAGEM
  async getQRCodeSimple(instanceName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    console.log(`📱 [CODECHAT-QR] Buscando QR Code SIMPLIFICADO: ${instanceName}`);
    
    try {
      // Usar apenas fetchInstance - como mostrado na sua imagem
      const details = await this.getInstanceDetails(instanceName);
      console.log(`📋 [CODECHAT-QR] Detalhes recebidos:`, details);
      
      // Buscar QR code nos campos possíveis
      let qrCode = null;
      
      if (details.qrCode) {
        qrCode = details.qrCode;
        console.log(`✅ [CODECHAT-QR] QR encontrado em details.qrCode`);
      } else if (details.base64) {
        qrCode = details.base64;
        console.log(`✅ [CODECHAT-QR] QR encontrado em details.base64`);
      } else if (details.Whatsapp?.qr) {
        qrCode = details.Whatsapp.qr;
        console.log(`✅ [CODECHAT-QR] QR encontrado em details.Whatsapp.qr`);
      } else if (details.Whatsapp?.qrCode) {
        qrCode = details.Whatsapp.qrCode;
        console.log(`✅ [CODECHAT-QR] QR encontrado em details.Whatsapp.qrCode`);
      }
      
      if (qrCode) {
        console.log(`🎉 [CODECHAT-QR] QR Code encontrado com sucesso!`);
        return { success: true, qrCode };
      } else {
        console.log(`⚠️ [CODECHAT-QR] QR Code não encontrado nos detalhes`);
        return { success: false, error: 'QR Code não disponível' };
      }
      
    } catch (error: any) {
      console.error(`❌ [CODECHAT-QR] Erro ao buscar QR Code:`, error);
      return { success: false, error: error.message };
    }
  }

  // MÉTODO LEGADO - MANTER COMPATIBILIDADE
  async getQRCode(instanceName: string) {
    return this.getQRCodeSimple(instanceName);
  }

  async checkInstanceExists(instanceName: string) {
    console.log(`🔍 [CODECHAT-QR] Verificando existência: ${instanceName}`);
    
    try {
      const details = await this.getInstanceDetails(instanceName);
      return { exists: true, details };
    } catch (error: any) {
      return { exists: false, error: error.message };
    }
  }

  async getAllInstances() {
    console.log(`📋 [CODECHAT-QR] Buscando todas as instâncias`);
    
    return this.makeRequest('/instance/fetchInstances');
  }
}

export const codechatQRService = new CodechatQRService();
