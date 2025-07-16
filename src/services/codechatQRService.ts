// REST API fallback para QR Codes do CodeChat
import { SOCKET_URL, getYumerGlobalApiKey } from '@/config/environment';
import { yumerJwtService } from './yumerJwtService';

interface QRCodeResponse {
  success: boolean;
  qrCode?: string | null;
  status?: string;
  error?: string | null;
  instanceName?: string;
  data?: any;
}

class CodeChatQRService {
  private readonly JWT_SECRET = 'sfdgs8152g5s1s5';

  // Construir URL base da API CodeChat
  private getApiBaseUrl(): string {
    return SOCKET_URL.replace(/^wss?:/, 'https:');
  }

  // ============ AUTENTICAÇÃO CENTRALIZADA (SEM CORS) ============
  private async getAuthHeaders(instanceName: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Removido X-API-Key header para evitar CORS
    // Global API Key será enviada via query parameter

    // JWT como backup via Authorization header (permitido por CORS)
    try {
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      headers['Authorization'] = `Bearer ${jwt}`;
      console.log(`🔐 [CODECHAT-AUTH] JWT adicionado via header`);
    } catch (error) {
      console.error(`❌ [CODECHAT-AUTH] Erro ao gerar JWT:`, error);
    }

    return headers;
  }

  // ============ CONSTRUIR URL COM API KEY (CONTORNAR CORS) ============
  private buildUrlWithApiKey(baseUrl: string): string {
    const globalApiKey = getYumerGlobalApiKey();
    
    if (globalApiKey) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const finalUrl = `${baseUrl}${separator}apikey=${globalApiKey}`;
      console.log(`🔑 [CODECHAT-AUTH] URL com API Key: ${baseUrl}${separator}apikey=${globalApiKey.substring(0, 8)}...`);
      return finalUrl;
    } else {
      console.warn(`⚠️ [CODECHAT-AUTH] Global API Key não configurada, usando apenas JWT`);
      return baseUrl;
    }
  }

  // ============ CODECHAT API v1.3.3 - BUSCAR QR CODE ============
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`📱 [CODECHAT-API] Buscando QR Code via /instance/qrcode/${instanceName}`);
      
      // URL com API Key via query parameter (contorna CORS)
      const baseUrl = `${this.getApiBaseUrl()}/instance/qrcode/${instanceName}`;
      const url = this.buildUrlWithApiKey(baseUrl);
      
      console.log(`🌐 [CODECHAT-API] GET ${baseUrl}?apikey=***`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-API] QR Code response:`, data);

      // QR Code pode vir em diferentes formatos conforme documentação
      const qrCode = data.base64 || data.qrCode || data.code;

      if (!qrCode) {
        throw new Error('QR Code não encontrado na resposta');
      }

      return {
        success: true,
        qrCode: qrCode,
        status: 'qr_ready',
        instanceName
      };

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao buscar QR Code:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ CODECHAT API v1.3.3 - CONECTAR INSTÂNCIA ============
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-API] Conectando via /instance/connect/${instanceName}`);
      
      // URL com API Key via query parameter (contorna CORS)
      const baseUrl = `${this.getApiBaseUrl()}/instance/connect/${instanceName}`;
      const url = this.buildUrlWithApiKey(baseUrl);
      
      console.log(`🌐 [CODECHAT-API] GET ${baseUrl}?apikey=***`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] Connect error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-API] Connect response:`, data);

      // Resposta pode conter QR Code diretamente conforme documentação
      // { "count": 1, "base64": "data:image/png;base64,iVBORw0KGgo...", "code": "2@WWDFM7QHaSH7i0BQQv12dUluv7PFYo ..." }
      const qrCode = data.base64 || data.qrCode || data.code;

      if (qrCode) {
        console.log(`📱 [CODECHAT-API] QR Code recebido diretamente do connect!`);
        return {
          success: true,
          qrCode: qrCode,
          status: 'qr_ready',
          instanceName
        };
      } else {
        console.log(`⏳ [CODECHAT-API] Connect realizado, buscando QR Code...`);
        // Aguardar um pouco e buscar QR Code via endpoint específico
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.getQRCode(instanceName);
      }

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao conectar:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ POLLING PARA QR CODE ============
  async pollQRCode(instanceName: string, maxAttempts: number = 10, interval: number = 3000): Promise<QRCodeResponse> {
    console.log(`🔄 [CODECHAT-REST] Iniciando polling para QR Code: ${instanceName}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 [CODECHAT-REST] Tentativa ${attempt}/${maxAttempts}`);
      
      const result = await this.getQRCode(instanceName);
      
      if (result.success && result.qrCode) {
        console.log(`✅ [CODECHAT-REST] QR Code encontrado na tentativa ${attempt}`);
        return result;
      }
      
      if (attempt < maxAttempts) {
        console.log(`⏳ [CODECHAT-REST] Aguardando ${interval}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    console.log(`❌ [CODECHAT-REST] QR Code não encontrado após ${maxAttempts} tentativas`);
    return {
      success: false,
      error: `QR Code não encontrado após ${maxAttempts} tentativas`,
      instanceName
    };
  }

  // ============ CODECHAT API v1.3.3 - STATUS DA INSTÂNCIA ============
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      console.log(`📊 [CODECHAT-API] Buscando status via /instance/connectionState/${instanceName}`);
      
      // URL com API Key via query parameter (contorna CORS)
      const baseUrl = `${this.getApiBaseUrl()}/instance/connectionState/${instanceName}`;
      const url = this.buildUrlWithApiKey(baseUrl);
      
      console.log(`🌐 [CODECHAT-API] GET ${baseUrl}?apikey=***`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] Status error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-API] Status response:`, data);

      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao buscar status:`, error);
      throw error;
    }
  }

  // ============ CODECHAT API v1.3.3 - BUSCAR DETALHES DA INSTÂNCIA ============
  async getInstanceDetails(instanceName: string): Promise<any> {
    try {
      console.log(`📋 [CODECHAT-API] Buscando detalhes via /instance/fetchInstance/${instanceName}`);
      
      // URL com API Key via query parameter (contorna CORS)
      const baseUrl = `${this.getApiBaseUrl()}/instance/fetchInstance/${instanceName}`;
      const url = this.buildUrlWithApiKey(baseUrl);
      
      console.log(`🌐 [CODECHAT-API] GET ${baseUrl}?apikey=***`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] Instance details error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-API] Instance details:`, data);

      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao buscar detalhes:`, error);
      throw error;
    }
  }

  // ============ DISCONNECT INSTANCE ============
  async disconnectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🔌 [CODECHAT] Desconectando instância: ${instanceName}`);
      
      const baseUrl = `${this.getApiBaseUrl()}/instance/logout/${instanceName}`;
      const url = this.buildUrlWithApiKey(baseUrl);
      console.log(`📡 [CODECHAT] URL de desconexão: ${baseUrl}?apikey=***`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(instanceName)
      });
      
      console.log(`📊 [CODECHAT] Response status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ [CODECHAT] Instância desconectada com sucesso');
        return {
          success: true,
          qrCode: null,
          status: 'disconnected',
          error: null,
          instanceName
        };
      } else {
        const errorText = await response.text();
        console.error('❌ [CODECHAT] Erro na resposta:', errorText);
        
        return {
          success: false,
          qrCode: null,
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`,
          instanceName
        };
      }
      
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao desconectar instância:', error);
      return {
        success: false,
        qrCode: null,
        status: 'error', 
        error: error.message,
        instanceName
      };
    }
  }

  // ============ CREATE INSTANCE ============
  async createInstance(instanceName: string, description?: string): Promise<QRCodeResponse> {
    try {
      console.log(`📝 [CODECHAT] Criando instância: ${instanceName}`);
      
      const baseUrl = `${this.getApiBaseUrl()}/instance/create`;
      const url = this.buildUrlWithApiKey(baseUrl);
      console.log(`📡 [CODECHAT] URL de criação: ${baseUrl}?apikey=***`);
      
      const requestBody = {
        instanceName,
        description: description || `Instance: ${instanceName}`
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: await this.getAuthHeaders(instanceName),
        body: JSON.stringify(requestBody)
      });
      
      console.log(`📊 [CODECHAT] Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CODECHAT] Instância criada com sucesso:', data);
        
        return {
          success: true,
          qrCode: null,
          status: 'created',
          error: null,
          instanceName,
          data
        };
      } else {
        const errorText = await response.text();
        console.error('❌ [CODECHAT] Erro na resposta:', errorText);
        
        return {
          success: false,
          qrCode: null,
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`,
          instanceName
        };
      }
      
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao criar instância:', error);
      return {
        success: false,
        qrCode: null,
        status: 'error',
        error: error.message,
        instanceName
      };
    }
  }
}

export const codechatQRService = new CodeChatQRService();