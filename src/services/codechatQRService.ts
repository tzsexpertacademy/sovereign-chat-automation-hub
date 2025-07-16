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

  // ============ REST API FALLBACK ============
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`📱 [CODECHAT-REST] Buscando QR Code via REST: ${instanceName}`);
      
      // Gerar JWT para autenticação
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // Construir URL da API REST
      const apiUrl = SOCKET_URL.replace(/^wss?:/, 'https:');
      const url = `${apiUrl}/instance/qrcode/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-REST] URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-REST] Resposta recebida:`, data);

      return {
        success: true,
        qrCode: data.qrCode || data.qr || data.base64,
        status: data.status || 'qr_ready',
        instanceName
      };

    } catch (error: any) {
      console.error(`❌ [CODECHAT-REST] Erro ao buscar QR Code:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ CONECTAR INSTÂNCIA VIA REST ============
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-REST] Conectando instância via REST: ${instanceName}`);
      
      // Gerar JWT para autenticação
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // Construir URL da API REST
      const apiUrl = SOCKET_URL.replace(/^wss?:/, 'https:');
      const url = `${apiUrl}/instance/connect/${instanceName}`;
      
      console.log(`🌐 [CODECHAT-REST] URL de conexão: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-REST] Conexão iniciada:`, data);

      // Aguardar um pouco e buscar QR Code
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.getQRCode(instanceName);

    } catch (error: any) {
      console.error(`❌ [CODECHAT-REST] Erro ao conectar:`, error);
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

  // ============ STATUS DA INSTÂNCIA ============
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      console.log(`📊 [CODECHAT-REST] Buscando status da instância: ${instanceName}`);
      
      // Gerar JWT para autenticação
      const jwt = await yumerJwtService.generateLocalJWT(this.JWT_SECRET, instanceName);
      
      // Construir URL da API REST
      const apiUrl = SOCKET_URL.replace(/^wss?:/, 'https:');
      const url = `${apiUrl}/instance/connectionState/${instanceName}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-REST] Status recebido:`, data);

      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-REST] Erro ao buscar status:`, error);
      throw error;
    }
  }
}

export const codechatQRService = new CodeChatQRService();