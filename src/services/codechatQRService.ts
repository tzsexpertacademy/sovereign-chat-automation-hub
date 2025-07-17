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

  // ============ REMOVER: MÉTODO QUE USA ROTA INEXISTENTE ============
  // O endpoint /api/v2/instance/find/ não existe no YUMER
  // Usando fetchInstance para obter instanceId quando necessário

  // ============ CONFIGURAR WEBHOOK INTELIGENTE (CORRIGIDO) ============
  async configureWebhook(instanceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔧 [CODECHAT] Configurando webhook para ${instanceName}`);
      
      // ============ ETAPA 1: BUSCAR INSTANCE ID REAL VIA FETCHINSTANCE ============
      try {
        const details = await this.getInstanceDetails(instanceName);
        const realInstanceId = details.id?.toString();
        
        if (!realInstanceId) {
          console.error(`❌ [CODECHAT] Instance ID não encontrado nos detalhes:`, details);
          return { success: false, error: 'Instance ID não encontrado' };
        }
        
        console.log(`🎯 [CODECHAT] Usando instanceId real: ${realInstanceId}`);
        return await this.configureWebhookWithId(instanceName, realInstanceId);
        
      } catch (detailsError) {
        console.warn(`⚠️ [CODECHAT] Erro ao buscar detalhes (tentando sem ID real):`, detailsError);
        // Fallback: tentar configurar webhook usando o nome da instância diretamente
        return await this.configureWebhookWithId(instanceName, instanceName);
      }
      
    } catch (error: any) {
      console.error(`❌ [CODECHAT] Erro webhook:`, error);
      return { 
        success: false, 
        error: error.message || 'Erro desconhecido' 
      };
    }
  }

  // ============ CONFIGURAR WEBHOOK COM ID ESPECÍFICO ============
  private async configureWebhookWithId(instanceName: string, instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🎯 [CODECHAT] Configurando webhook com ID: ${instanceId}`);
      
      // ============ ETAPA 1: VERIFICAR SE WEBHOOK JÁ EXISTE (OPCIONAL) ============
      // Skipping check since API v2 routes don't exist consistently
      console.log(`🔧 [CODECHAT] Configurando webhook API v1 (padrão)...`);
      
      // ============ ETAPA 2: CONFIGURAR WEBHOOK VIA API v1 ============
      const webhookUrl = "https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-webhook";
      
      console.log(`📡 [CODECHAT] URL do webhook: ${webhookUrl}`);
      console.log(`📋 [CODECHAT] Usando instanceId: ${instanceId}`);
      
      // Tentar configurar webhook via API v1 (se existir)
      try {
        const webhookConfigUrl = `${this.getApiBaseUrl()}/instance/update/${instanceName}`;
        console.log(`🌐 [CODECHAT] PATCH ${webhookConfigUrl}`);
        
        const response = await fetch(webhookConfigUrl, {
          method: 'PATCH',
          headers: await this.getAuthHeaders(instanceName),
          body: JSON.stringify({
            webhook: {
              url: webhookUrl,
              enabled: true,
              events: {
                qrcodeUpdated: true,
                connectionUpdated: true,
                messagesUpsert: true
              }
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [CODECHAT] Webhook configurado via API v1:`, data);
          return { success: true };
        } else {
          const errorText = await response.text();
          console.warn(`⚠️ [CODECHAT] API v1 falhou: ${response.status} - ${errorText}`);
        }
      } catch (v1Error) {
        console.warn(`⚠️ [CODECHAT] Erro API v1:`, v1Error);
      }
      
      // ============ FALLBACK: ASSUMIR QUE WEBHOOK GLOBAL ESTÁ CONFIGURADO ============
      console.log(`📝 [CODECHAT] Usando webhook global - assumindo configuração manual`);
      console.log(`🎯 [CODECHAT] O YUMER deve estar configurado para enviar eventos para: ${webhookUrl}`);
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`❌ [CODECHAT] Erro webhook:`, error);
      return { 
        success: false, 
        error: error.message || 'Erro desconhecido' 
      };
    }
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

  // ============ CODECHAT API v1.3.3 - CONECTAR INSTÂNCIA E GERAR QR (CORRIGIDO) ============
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-API] Conectando via /instance/connect/${instanceName}`);
      
      // ============ ETAPA 1: VERIFICAR STATUS ATUAL ============
      try {
        const currentStatus = await this.getInstanceStatus(instanceName);
        console.log(`📊 [CODECHAT-API] Status atual antes da conexão:`, currentStatus);
        
        // Se já está conectado, não precisa conectar novamente
        if (currentStatus.state === 'open') {
          console.log(`✅ [CODECHAT-API] Instância já conectada!`);
          return {
            success: true,
            qrCode: undefined,
            status: 'connected',
            instanceName,
            data: currentStatus
          };
        }
      } catch (statusError) {
        console.log(`⚠️ [CODECHAT-API] Erro ao verificar status atual (continuando):`, statusError);
      }
      
      // ============ ETAPA 2: EXECUTAR CONEXÃO E AGUARDAR QR CODE ============
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
      console.log(`✅ [CODECHAT-API] Connect response completa:`, data);

      // ============ ETAPA 3: VERIFICAR QR CODE IMEDIATO ============
      const qrCode = data.base64 || data.qrCode || data.code || data.qr || data.qr_code;
      
      console.log(`🔍 [CODECHAT-API] Análise QR Code:`, {
        hasBase64: !!data.base64,
        hasQrCode: !!data.qrCode,
        hasCode: !!data.code,
        hasQr: !!data.qr,
        hasQrCodeField: !!data.qr_code,
        count: data.count,
        foundQrCode: !!qrCode
      });

      if (qrCode) {
        console.log(`📱 [CODECHAT-API] ✅ QR CODE ENCONTRADO NO CONNECT!`);
        console.log(`📱 [CODECHAT-API] QR Code length: ${qrCode.length} chars`);
        
        return {
          success: true,
          qrCode: qrCode,
          status: 'qr_ready',
          instanceName,
          data: data
        };
      }

      // ============ ETAPA 4: SE NÃO TEM QR IMEDIATO, FAZER POLLING COM QR ENDPOINT ============
      console.log(`🔄 [CODECHAT-API] QR não encontrado no connect - tentando endpoint QR específico`);
      
      // Tentar /instance/qrcode/{instanceName} como fallback
      try {
        const qrResponse = await this.getQRCodeDirectly(instanceName);
        if (qrResponse.success && qrResponse.qrCode) {
          console.log(`📱 [CODECHAT-API] ✅ QR CODE OBTIDO VIA ENDPOINT QR!`);
          return qrResponse;
        }
      } catch (qrError) {
        console.warn(`⚠️ [CODECHAT-API] Endpoint QR falhou:`, qrError);
      }

      // ============ ETAPA 5: POLLING VIA FETCHINSTANCE ============
      console.log(`🔄 [CODECHAT-API] Iniciando polling via fetchInstance...`);
      
      let attempts = 0;
      const maxAttempts = 15; // 30 segundos
      const interval = 2000; // 2 segundos
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔍 [CODECHAT-API] Polling tentativa ${attempts}/${maxAttempts}`);
        
        try {
          await new Promise(resolve => setTimeout(resolve, interval));
          
          const details = await this.getInstanceDetails(instanceName);
          console.log(`📊 [CODECHAT-API] Details polling:`, details);
          
          // Verificar QR code nos detalhes (incluindo dentro de Whatsapp object)
          const polledQr = details.qrCode || details.base64 || details.code || details.qr || 
                           details.Whatsapp?.qrCode || details.Whatsapp?.base64;
          if (polledQr) {
            console.log(`📱 [CODECHAT-API] ✅ QR CODE ENCONTRADO VIA POLLING!`);
            return {
              success: true,
              qrCode: polledQr,
              status: 'qr_ready',
              instanceName,
              data: details
            };
          }
          
          // Verificar se já conectou
          if (details.ownerJid || details.phoneNumber) {
            console.log(`✅ [CODECHAT-API] Instância conectada durante polling!`);
            return {
              success: true,
              qrCode: undefined,
              status: 'connected',
              instanceName,
              data: details
            };
          }
          
        } catch (pollError) {
          console.warn(`⚠️ [CODECHAT-API] Erro no polling ${attempts}:`, pollError);
        }
      }
      
      console.log(`⏰ [CODECHAT-API] Polling finalizado sem QR code`);
      return {
        success: true,
        qrCode: undefined,
        status: 'connecting',
        instanceName,
        data: data
      };

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao conectar:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ NOVO: ENDPOINT QR CODE DIRETO (FALLBACK) ============
  async getQRCodeDirectly(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`📱 [CODECHAT-API] Tentando QR via /instance/qrcode/${instanceName}`);
      
      const url = `${this.getApiBaseUrl()}/instance/qrcode/${instanceName}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Verificar se é JSON ou texto
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        const qrCode = data.base64 || data.qrCode || data.code || data.qr;
        
        if (qrCode) {
          console.log(`📱 [CODECHAT-API] QR obtido via endpoint QR JSON`);
          return {
            success: true,
            qrCode: qrCode,
            status: 'qr_ready',
            instanceName
          };
        }
      } else {
        // Se retornar texto/HTML, pode ser base64 direto
        const text = await response.text();
        if (text && text.startsWith('data:image')) {
          console.log(`📱 [CODECHAT-API] QR obtido via endpoint QR texto`);
          return {
            success: true,
            qrCode: text,
            status: 'qr_ready',
            instanceName
          };
        }
      }
      
      throw new Error('QR Code não encontrado na resposta');
      
    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro endpoint QR direto:`, error);
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
         
         // Verificar se há QR Code (incluindo dentro de Whatsapp object)
         const qrCode = details.qrCode || details.base64 || details.code || 
                       details.Whatsapp?.qrCode || details.Whatsapp?.base64;
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
        
        // Detectar especificamente erro de instância não encontrada
        if (response.status === 400 && errorText.includes('Instance not found')) {
          throw new Error('Instance not found');
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

  // ============ VERIFICAR SE INSTÂNCIA EXISTE ============
  async checkInstanceExists(instanceName: string): Promise<{ exists: boolean; status?: string; error?: string }> {
    try {
      console.log(`🔍 [CODECHAT] Verificando existência: ${instanceName}`);
      
      const details = await this.getInstanceDetails(instanceName);
      console.log(`✅ [CODECHAT] Instância existe:`, details);
      
      return { 
        exists: true, 
        status: details.state || 'unknown' 
      };
      
    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.log(`📋 [CODECHAT] Instância não existe: ${instanceName}`);
        return { exists: false };
      } else {
        console.error(`❌ [CODECHAT] Erro ao verificar existência:`, error);
        return { 
          exists: false, 
          error: error.message 
        };
      }
    }
  }

  // ============ DELETE INSTANCE ============
  async deleteInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🗑️ [CODECHAT] Deletando instância: ${instanceName}`);
      
      const url = `${this.getApiBaseUrl()}/instance/delete/${instanceName}`;
      console.log(`📡 [CODECHAT] URL de deleção: ${url}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(instanceName),
      });
      
      console.log(`📊 [CODECHAT] Delete response status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ [CODECHAT] Instância deletada com sucesso');
        return {
          success: true,
          qrCode: null,
          status: 'deleted',
          error: null,
          instanceName
        };
      } else {
        const errorText = await response.text();
        console.warn('⚠️ [CODECHAT] Erro ao deletar (pode não existir):', errorText);
        
        // 404 ou 400 pode ser normal se instância não existir
        if (response.status === 404 || response.status === 400) {
          return {
            success: true,
            qrCode: null,
            status: 'not_found',
            error: null,
            instanceName
          };
        }
        
        return {
          success: false,
          qrCode: null,
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`,
          instanceName
        };
      }
      
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao deletar instância:', error);
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
        
        // Verificar se é erro 403/400/409 (instância já existe)
        const isConflict = response.status === 409 || response.status === 403 || response.status === 400;
        const isAlreadyExists = isConflict && (
          errorText.includes('already in use') || 
          errorText.includes('already exists') ||
          errorText.includes('Instance already exists')
        );
        
        if (isAlreadyExists) {
          console.log('ℹ️ [CODECHAT] Instância já existe - continuando com conexão');
          return {
            success: true,
            qrCode: null,
            status: 'already_exists',
            error: null,
            instanceName
          };
        }
        
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