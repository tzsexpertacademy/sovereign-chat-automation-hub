// REST API fallback para QR Codes do CodeChat
import { SOCKET_URL } from '@/config/environment';
import { yumerJwtService } from './yumerJwtService';

interface QRCodeResponse {
  success: boolean;
  qrCode?: string;
  status?: string;
  error?: string;
  instanceName?: string;
}

class CodeChatQRService {
  private readonly JWT_SECRET = 'sfdgs8152g5s1s5';

  // Construir URL base da API CodeChat
  private getApiBaseUrl(): string {
    return SOCKET_URL.replace(/^wss?:/, 'https:');
  }

  // ============ CODECHAT API v1.3.3 - BUSCAR QR CODE ============
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`📱 [CODECHAT-API] Buscando QR Code via /instance/qrcode/${instanceName}`);
      
      // Gerar JWT compatível com CodeChat
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // URL exata conforme documentação CodeChat API v1.3.3
      const url = `${this.getApiBaseUrl()}/instance/qrcode/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
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
      
      // Gerar JWT compatível com CodeChat
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // URL exata conforme documentação CodeChat API v1.3.3
      const url = `${this.getApiBaseUrl()}/instance/connect/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
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
      
      // Gerar JWT compatível com CodeChat
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // URL exata conforme documentação CodeChat API v1.3.3
      const url = `${this.getApiBaseUrl()}/instance/connectionState/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
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
      
      // Gerar JWT compatível com CodeChat
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // URL conforme documentação CodeChat API v1.3.3
      const url = `${this.getApiBaseUrl()}/instance/fetchInstance/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
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
}

export const codechatQRService = new CodeChatQRService();