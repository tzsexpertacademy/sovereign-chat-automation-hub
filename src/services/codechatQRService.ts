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

  // ============ AUTENTICAÇÃO SIMPLIFICADA (APENAS HEADER APIKEY) ============
  private async getAuthHeaders(instanceName: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Global API Key via header apikey (formato correto do servidor)
    const globalApiKey = getYumerGlobalApiKey();
    if (globalApiKey) {
      headers['apikey'] = globalApiKey;
      console.log(`🔑 [CODECHAT-AUTH] API Key adicionada via header apikey: ${globalApiKey}`);
      console.log(`📋 [CODECHAT-AUTH] Headers finais:`, headers);
    } else {
      console.error(`❌ [CODECHAT-AUTH] Global API Key NÃO CONFIGURADA - requests falharão`);
      console.log(`📋 [CODECHAT-AUTH] LocalStorage check:`, localStorage.getItem('yumer_global_api_key'));
    }

    // REMOVIDO: JWT via Authorization header para evitar conflitos CORS
    // Usando apenas apikey header conforme funciona no CURL

    return headers;
  }


  // ============ REMOVED: PROBLEMATIC QR CODE ENDPOINT ============
  // O endpoint /instance/qrcode/{instanceName} retorna HTML, não JSON
  // Usaremos apenas polling via /instance/fetchInstance e WebSocket
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    console.warn(`⚠️ [CODECHAT-API] QR Code endpoint desabilitado (retorna HTML)`);
    console.log(`🔄 [CODECHAT-API] Redirecionando para fetchInstance...`);
    
    try {
      // Usar endpoint fetchInstance que retorna JSON válido
      const details = await this.getInstanceDetails(instanceName);
      
      // Verificar se há QR Code nos detalhes da instância
      const qrCode = details.qrCode || details.base64 || details.code;
      
      if (qrCode) {
        console.log(`✅ [CODECHAT-API] QR Code encontrado via fetchInstance`);
        return {
          success: true,
          qrCode: qrCode,
          status: 'qr_ready',
          instanceName
        };
      } else {
        console.log(`ℹ️ [CODECHAT-API] QR Code não disponível ainda`);
        return {
          success: false,
          error: 'QR Code não disponível ainda',
          instanceName
        };
      }
      
    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao buscar QR Code via fetchInstance:`, error);
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
      
      const url = `${this.getApiBaseUrl()}/instance/connect/${instanceName}`;
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
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
      
      console.log(`🔍 [CODECHAT-API] Verificando campos de QR Code na resposta connect:`, {
        base64: !!data.base64,
        qrCode: !!data.qrCode,
        code: !!data.code,
        keys: Object.keys(data)
      });

      if (qrCode) {
        console.log(`📱 [CODECHAT-API] QR Code recebido diretamente do connect!`);
        return {
          success: true,
          qrCode: qrCode,
          status: 'qr_ready',
          instanceName
        };
      } else {
        console.log(`⏳ [CODECHAT-API] Connect realizado, aguardando QR Code via polling...`);
        // Retornar sucesso e deixar o polling REST handle o QR Code
        return {
          success: true,
          qrCode: undefined,
          status: 'connecting',
          instanceName
        };
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

  // ============ POLLING PARA STATUS E QR CODE VIA REST ============
  async pollInstanceStatus(instanceName: string, maxAttempts: number = 20, interval: number = 3000): Promise<QRCodeResponse> {
    console.log(`🔄 [CODECHAT-REST] Iniciando polling para status e QR Code: ${instanceName}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 [CODECHAT-REST] Tentativa ${attempt}/${maxAttempts}`);
      
      try {
        // Buscar detalhes completos da instância
        const details = await this.getInstanceDetails(instanceName);
        
        console.log(`📊 [CODECHAT-REST] Detalhes da instância:`, details);
        
        // Verificar se há QR Code
        const qrCode = details.qrCode || details.base64 || details.code;
        if (qrCode) {
          console.log(`✅ [CODECHAT-REST] QR Code encontrado na tentativa ${attempt}`);
          return {
            success: true,
            qrCode: qrCode,
            status: 'qr_ready',
            instanceName
          };
        }
        
        // Verificar se já está conectado
        if (details.ownerJid || details.phoneNumber) {
          console.log(`✅ [CODECHAT-REST] Instância já conectada: ${details.ownerJid || details.phoneNumber}`);
          return {
            success: true,
            qrCode: undefined,
            status: 'connected',
            instanceName,
            data: { phoneNumber: details.ownerJid || details.phoneNumber }
          };
        }
        
        // Verificar status de conexão
        try {
          const status = await this.getInstanceStatus(instanceName);
          if (status.state === 'open') {
            console.log(`✅ [CODECHAT-REST] Instância conectada via status check`);
            return {
              success: true,
              qrCode: undefined,
              status: 'connected',
              instanceName
            };
          }
        } catch (statusError) {
          console.warn(`⚠️ [CODECHAT-REST] Erro ao verificar status:`, statusError);
        }
        
      } catch (error) {
        console.warn(`⚠️ [CODECHAT-REST] Erro na tentativa ${attempt}:`, error);
      }
      
      if (attempt < maxAttempts) {
        console.log(`⏳ [CODECHAT-REST] Aguardando ${interval}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    console.log(`❌ [CODECHAT-REST] Polling finalizado sem sucesso após ${maxAttempts} tentativas`);
    return {
      success: false,
      error: `QR Code ou conexão não estabelecida após ${maxAttempts} tentativas`,
      instanceName
    };
  }

  // ============ CODECHAT API v1.3.3 - STATUS DA INSTÂNCIA ============
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      console.log(`📊 [CODECHAT-API] Buscando status via /instance/connectionState/${instanceName}`);
      
      const url = `${this.getApiBaseUrl()}/instance/connectionState/${instanceName}`;
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
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
      
      const url = `${this.getApiBaseUrl()}/instance/fetchInstance/${instanceName}`;
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] Instance details error ${response.status}:`, errorText);
        
        // Se HTML detectado, logar para debug
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          console.error(`🚨 [CODECHAT-API] HTML response detected! Server may be returning error page instead of JSON`);
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Verificar se response é JSON válido antes de fazer parse
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`🚨 [CODECHAT-API] Non-JSON response:`, text);
        throw new Error('Server returned non-JSON response');
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
      
      const url = `${this.getApiBaseUrl()}/instance/logout/${instanceName}`;
      console.log(`📡 [CODECHAT] URL de desconexão: ${url}`);
      
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
      
      const url = `${this.getApiBaseUrl()}/instance/create`;
      console.log(`📡 [CODECHAT] URL de criação: ${url}`);
      
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
        
        // Verificar se é erro 409 (instância já existe)
        const is409Conflict = response.status === 409;
        
        return {
          success: false,
          qrCode: null,
          status: is409Conflict ? 'already_exists' : 'error',
          error: is409Conflict ? 'Instance already exists' : `HTTP ${response.status}: ${errorText}`,
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