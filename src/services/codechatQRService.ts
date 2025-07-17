// REST API fallback para QR Codes do CodeChat
import { SOCKET_URL, getYumerGlobalApiKey } from '@/config/environment';
import { yumerJwtService } from './yumerJwtService';
import { yumerNativeWebSocketService } from './yumerNativeWebSocketService';

interface QRCodeResponse {
  success: boolean;
  qrCode?: string | null;
  status?: string;
  error?: string | null;
  instanceName?: string;
  actualName?: string; // Nome real retornado pelo YUMER
  data?: any;
}

interface CreateInstanceResult {
  success: boolean;
  error?: string;
  instanceName: string;
  actualName?: string; // Nome real retornado pelo YUMER
  data?: any;
}

class CodeChatQRService {
  private readonly JWT_SECRET = 'sfdgs8152g5s1s5';

  // Construir URL base da API CodeChat
  private getApiBaseUrl(): string {
    return SOCKET_URL.replace(/^wss?:/, 'https:');
  }

  // ============ AUTENTICAÇÃO CORRETA CONFORME API DOCUMENTATION ============
  private async getAuthHeaders(instanceName: string, useInstanceToken: boolean = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 1. Tentar usar Bearer token da instância (padrão correto)
    if (useInstanceToken) {
      const instanceToken = await this.getInstanceAuthToken(instanceName);
      if (instanceToken) {
        headers['Authorization'] = `Bearer ${instanceToken}`;
        console.log(`🔑 [CODECHAT-AUTH] Bearer token da instância adicionado`);
        return headers;
      }
    }

    // 2. Fallback: Global API Key via header apikey
    const globalApiKey = getYumerGlobalApiKey();
    if (globalApiKey) {
      headers['apikey'] = globalApiKey;
      console.log(`🔑 [CODECHAT-AUTH] API Key global adicionada via header apikey`);
    } else {
      console.error(`❌ [CODECHAT-AUTH] Nenhuma autenticação disponível - requests falharão`);
    }

    return headers;
  }

  // ============ BUSCAR AUTH TOKEN DA INSTÂNCIA ============
  private async getInstanceAuthToken(instanceName: string): Promise<string | null> {
    try {
      console.log(`🔍 [CODECHAT-TOKEN] Buscando token no banco para: ${instanceName}`);
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('auth_token')
        .eq('instance_id', instanceName)
        .single();

      console.log(`🔍 [CODECHAT-TOKEN] Query result - data:`, data, 'error:', error);

      if (error || !data?.auth_token) {
        console.log(`⚠️ [CODECHAT-TOKEN] Token não encontrado ou erro:`, error);
        return null;
      }

      console.log(`✅ [CODECHAT-TOKEN] Token encontrado para ${instanceName}`);
      return data.auth_token;
    } catch (error) {
      console.error(`❌ [CODECHAT-TOKEN] Erro ao buscar token:`, error);
      return null;
    }
  }

  // ============ SALVAR AUTH TOKEN DA INSTÂNCIA ============
  private async saveInstanceAuthToken(instanceName: string, authToken: string): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ auth_token: authToken })
        .eq('instance_id', instanceName);

      if (error) {
        console.error(`❌ [CODECHAT-AUTH] Erro ao salvar token:`, error);
      } else {
        console.log(`✅ [CODECHAT-AUTH] Token salvo para ${instanceName}`);
      }
    } catch (error) {
      console.error(`❌ [CODECHAT-AUTH] Erro ao salvar token:`, error);
    }
  }

  // ============ EXTRAIR QR CODE DO HTML ============
  private extractQRFromHTML(htmlContent: string): string | null {
    try {
      console.log(`🔍 [CODECHAT-HTML] Tentando extrair QR code do HTML...`);
      
      // Padrões para buscar QR code base64 no HTML
      const patterns = [
        // Atributo src de img tag
        /src="(data:image\/[^"]+)"/gi,
        /src='(data:image\/[^']+)'/gi,
        
        // JavaScript variáveis
        /qrCode\s*[=:]\s*["'](data:image\/[^"']+)["']/gi,
        /qr\s*[=:]\s*["'](data:image\/[^"']+)["']/gi,
        /base64\s*[=:]\s*["'](data:image\/[^"']+)["']/gi,
        
        // Canvas toDataURL
        /toDataURL\(\).*?["'](data:image\/[^"']+)["']/gi,
        
        // Padrão genérico para qualquer data:image
        /(data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+\/=]+)/gi
      ];
      
      for (const pattern of patterns) {
        const matches = htmlContent.match(pattern);
        if (matches) {
          for (const match of matches) {
            // Extrair apenas a parte do data:image
            const dataMatch = match.match(/(data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+\/=]+)/);
            if (dataMatch && dataMatch[1]) {
              const qrCode = dataMatch[1];
              console.log(`✅ [CODECHAT-HTML] QR code encontrado via padrão: ${pattern.source}`);
              console.log(`🔍 [CODECHAT-HTML] QR extraído (primeiros 50 chars): ${qrCode.substring(0, 50)}...`);
              
              // Validar se é um base64 válido
              if (this.isValidBase64Image(qrCode)) {
                return qrCode;
              }
            }
          }
        }
      }
      
      console.log(`⚠️ [CODECHAT-HTML] Nenhum QR code encontrado no HTML`);
      console.log(`🔍 [CODECHAT-HTML] HTML snippet (primeiros 500 chars):`, htmlContent.substring(0, 500));
      return null;
      
    } catch (error) {
      console.error(`❌ [CODECHAT-HTML] Erro ao extrair QR do HTML:`, error);
      return null;
    }
  }

  // ============ VALIDAR BASE64 DE IMAGEM ============
  private isValidBase64Image(str: string): boolean {
    try {
      // Verificar se começa com data:image
      if (!str.startsWith('data:image/')) {
        return false;
      }
      
      // Extrair a parte base64
      const base64Part = str.split(',')[1];
      if (!base64Part) {
        return false;
      }
      
      // Verificar se é base64 válido (deve ser múltiplo de 4 quando padded)
      const base64Regex = /^[A-Za-z0-9+\/]*={0,2}$/;
      if (!base64Regex.test(base64Part)) {
        return false;
      }
      
      // Verificar tamanho mínimo (QR codes são geralmente grandes)
      if (base64Part.length < 1000) {
        console.log(`⚠️ [CODECHAT-HTML] Base64 muito pequeno para ser QR code: ${base64Part.length} chars`);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // ============ SALVAR QR CODE NO BANCO ============
  private async saveQRCodeToDatabase(instanceName: string, qrCode: string): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Definir expiração em 60 segundos
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 60);
      
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ 
          qr_code: qrCode,
          has_qr_code: true,
          qr_expires_at: expiresAt.toISOString(),
          status: 'qr_ready',
          updated_at: new Date().toISOString()
        })
        .eq('instance_id', instanceName);

      if (error) {
        console.error(`❌ [CODECHAT-QR] Erro ao salvar QR no banco:`, error);
      } else {
        console.log(`✅ [CODECHAT-QR] QR Code salvo no banco para ${instanceName}`);
      }
    } catch (error) {
      console.error(`❌ [CODECHAT-QR] Erro ao salvar QR:`, error);
    }
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

  // ============ CONNECT QR WEBSOCKET ============
  private async connectQRWebSocket(instanceName: string, authToken: string): Promise<QRCodeResponse> {
    return new Promise((resolve) => {
      console.log(`🔌 [CODECHAT-WS] Conectando WebSocket para ${instanceName}`);
      
      try {
        yumerNativeWebSocketService.connect({
          instanceName,
          event: 'qr_code',
          useSecureConnection: true,
          autoReconnect: false
        });

        const handleQRCode = (data: any) => {
          console.log(`📱 [CODECHAT-WS] QR Code recebido via WebSocket:`, data);
          
          if (data && data.base64) {
            this.saveQRCodeToDatabase(instanceName, data.base64);
            yumerNativeWebSocketService.off('qr_code', handleQRCode);
            yumerNativeWebSocketService.disconnect();
            
            resolve({
              success: true,
              qrCode: data.base64,
              status: 'qr_ready',
              instanceName
            });
          }
        };

        const handleConnection = (data: any) => {
          if (data && data.state === 'open') {
            console.log(`✅ [CODECHAT-WS] Instância conectada via WebSocket`);
            yumerNativeWebSocketService.off('qr_code', handleQRCode);
            yumerNativeWebSocketService.off('connection_update', handleConnection);
            yumerNativeWebSocketService.disconnect();
            
            resolve({
              success: true,
              qrCode: undefined,
              status: 'connected',
              instanceName
            });
          }
        };

        yumerNativeWebSocketService.on('qr_code', handleQRCode);
        yumerNativeWebSocketService.on('connection_update', handleConnection);

        // Timeout após 30 segundos
        setTimeout(() => {
          yumerNativeWebSocketService.off('qr_code', handleQRCode);
          yumerNativeWebSocketService.off('connection_update', handleConnection);
          yumerNativeWebSocketService.disconnect();
          
          resolve({
            success: false,
            error: 'WebSocket timeout - fallback para REST',
            instanceName
          });
        }, 30000);

      } catch (error: any) {
        console.error(`❌ [CODECHAT-WS] Erro WebSocket:`, error);
        resolve({
          success: false,
          error: `WebSocket error: ${error.message}`,
          instanceName
        });
      }
    });
  }

  // ============ CONNECT INSTANCE COM ESTRATÉGIA HÍBRIDA ============
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-API] Conectando instância (WebSocket + REST): ${instanceName}`);
      
      // ============ VERIFICAR NOME REAL NO BANCO ============
      const realInstanceName = await this.getRealYumerInstanceName(instanceName);
      console.log(`🔍 [CODECHAT-DEBUG] Nome original: ${instanceName}`);
      console.log(`🔍 [CODECHAT-DEBUG] Nome real no YUMER: ${realInstanceName}`);
      
      const nameToUse = realInstanceName || instanceName;
      
      // ============ ETAPA 1: VERIFICAR SE JÁ ESTÁ CONECTADO ============
      try {
        const currentStatus = await this.getInstanceStatus(nameToUse);
        console.log(`📊 [CODECHAT-API] Status atual:`, currentStatus);
        
        if (currentStatus.state === 'open') {
          console.log(`✅ [CODECHAT-API] Instância já conectada!`);
          return {
            success: true,
            qrCode: undefined,
            status: 'connected',
            instanceName: nameToUse,
            data: currentStatus
          };
        }
      } catch (statusError) {
        console.log(`ℹ️ [CODECHAT-API] Status check failed (continuando):`, statusError);
      }
      
      // ============ ETAPA 2: BUSCAR TOKEN PARA WEBSOCKET ============
      console.log(`🔍 [CODECHAT-DEBUG] Buscando token para instância: ${nameToUse}`);
      const authToken = await this.getInstanceAuthToken(nameToUse);
      console.log(`🔍 [CODECHAT-DEBUG] Token encontrado:`, authToken ? 'SIM' : 'NÃO');
      
      if (authToken) {
        console.log(`🔌 [CODECHAT-API] Tentando WebSocket primeiro...`);
        const wsResult = await this.connectQRWebSocket(nameToUse, authToken);
        
        if (wsResult.success) {
          return wsResult;
        } else {
          console.log(`⚠️ [CODECHAT-API] WebSocket falhou, usando fallback REST`);
        }
      } else {
        console.log(`⚠️ [CODECHAT-API] Token não encontrado, usando REST direto`);
      }
      
      // ============ ETAPA 3: FALLBACK PARA ESTRATÉGIA HÍBRIDA REST ============
      console.log(`🔄 [CODECHAT-HYBRID] Iniciando estratégia híbrida REST...`);
      return await this.connectInstanceHybrid(nameToUse);

    } catch (error: any) {
      console.error(`❌ [CODECHAT-API] Erro ao conectar:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ CONNECT COM RETRY SIMPLES ============
  private async connectWithRetry(instanceName: string, maxAttempts: number = 3): Promise<QRCodeResponse> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔗 [CODECHAT-API] Tentativa de conexão ${attempt}/${maxAttempts}`);
        
        const url = `${this.getApiBaseUrl()}/instance/connect/${instanceName}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: await this.getAuthHeaders(instanceName),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [CODECHAT-API] Connect error ${response.status}:`, errorText);
          
          if (attempt === maxAttempts) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          continue;
        }

        const data = await response.json();
        console.log(`✅ [CODECHAT-API] Connect response:`, data);

        const qrCode = data.base64 || data.qrCode || data.code;
        
        if (qrCode) {
          console.log(`📱 [CODECHAT-API] ✅ QR CODE RECEBIDO na tentativa ${attempt}!`);
          return {
            success: true,
            qrCode: qrCode,
            status: 'qr_ready',
            instanceName,
            data: data
          };
        }

        if (attempt < maxAttempts) {
          console.log(`⏳ [CODECHAT-API] Aguardando 2s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error: any) {
        if (attempt === maxAttempts) {
          throw error;
        }
        console.warn(`⚠️ [CODECHAT-API] Tentativa ${attempt} falhou:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return {
      success: false,
      error: 'QR Code não obtido após tentativas de conexão',
      instanceName
    };
  }

  // ============ POLLING MELHORADO PARA QR CODE ============
  private async pollForQRCode(instanceName: string, maxAttempts: number = 15): Promise<QRCodeResponse> {
    console.log(`🔄 [CODECHAT-POLL] Iniciando polling para QR Code: ${instanceName}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔍 [CODECHAT-POLL] Tentativa ${attempt}/${maxAttempts} - Buscando QR...`);
        
        // Tentar múltiplos endpoints
        const qrResult = await this.tryMultipleQREndpoints(instanceName);
        
        if (qrResult.success && qrResult.qrCode) {
          console.log(`✅ [CODECHAT-POLL] QR Code encontrado na tentativa ${attempt}!`);
          return qrResult;
        }

        // Verificar se já conectou
        try {
          const status = await this.getInstanceStatus(instanceName);
          if (status.state === 'open') {
            console.log(`✅ [CODECHAT-POLL] Instância conectada durante polling!`);
            return {
              success: true,
              qrCode: undefined,
              status: 'connected',
              instanceName,
              data: status
            };
          }
        } catch (statusError) {
          console.warn(`⚠️ [CODECHAT-POLL] Erro ao verificar status:`, statusError);
        }

        if (attempt < maxAttempts) {
          // Backoff exponencial: 3s, 5s, 8s...
          const delay = Math.min(3000 + (attempt * 2000), 10000);
          console.log(`⏳ [CODECHAT-POLL] Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error: any) {
        console.warn(`⚠️ [CODECHAT-POLL] Erro na tentativa ${attempt}:`, error.message);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    console.log(`❌ [CODECHAT-POLL] Polling finalizado sem QR Code após ${maxAttempts} tentativas`);
    return {
      success: false,
      error: `QR Code não encontrado após ${maxAttempts} tentativas de polling`,
      instanceName
    };
  }

  // ============ TENTAR MÚLTIPLOS ENDPOINTS PARA QR ============
  private async tryMultipleQREndpoints(instanceName: string): Promise<QRCodeResponse> {
    const endpoints = [
      () => this.getInstanceDetails(instanceName),
      () => this.getQRCodeDirectly(instanceName),
      () => this.getQRFromAlternativeEndpoints(instanceName),
      () => this.connectWithRetry(instanceName, 1)
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await endpoint();
        
        // Para getInstanceDetails
        if (result.qrCode || result.base64 || result.code || result.Whatsapp?.qrCode) {
          const qrCode = result.qrCode || result.base64 || result.code || result.Whatsapp?.qrCode;
          return {
            success: true,
            qrCode: qrCode,
            status: 'qr_ready',
            instanceName
          };
        }
        
        // Para outros métodos que já retornam QRCodeResponse
        if (result.success && result.qrCode) {
          return result;
        }
        
      } catch (error) {
        console.warn(`⚠️ [CODECHAT-MULTI] Endpoint falhou:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'Nenhum endpoint retornou QR Code',
      instanceName
    };
  }

  // ============ ENDPOINTS ALTERNATIVOS DE QR CODE ============
  async getQRFromAlternativeEndpoints(instanceName: string): Promise<QRCodeResponse> {
    const alternativeEndpoints = [
      `/api/v2/instance/${instanceName}/connect`,
      `/instance/connect/${instanceName}?format=json`,
      `/instance/qr/${instanceName}`,
      `/whatsapp/qrcode/${instanceName}`,
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        console.log(`📱 [CODECHAT-ALT] Testando endpoint alternativo: ${endpoint}`);
        
        const url = `${this.getApiBaseUrl()}${endpoint}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: await this.getAuthHeaders(instanceName),
        });

        if (!response.ok) {
          console.log(`❌ [CODECHAT-ALT] ${endpoint} retornou ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type');
        let data: any;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { text };
          }
        }

        console.log(`🔍 [CODECHAT-ALT] Response de ${endpoint}:`, data);

        // Buscar QR em múltiplos campos possíveis
        const qrCode = data.base64 || data.qrCode || data.code || data.qr || 
                      data.data?.base64 || data.data?.qrCode || data.data?.code ||
                      data.qrcode?.base64 || data.qrcode?.code || data.text;

        if (qrCode && (qrCode.startsWith('data:image') || qrCode.length > 100)) {
          console.log(`✅ [CODECHAT-ALT] QR encontrado em ${endpoint}!`);
          return {
            success: true,
            qrCode: qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`,
            status: 'qr_ready',
            instanceName
          };
        }

      } catch (error: any) {
        console.warn(`⚠️ [CODECHAT-ALT] Erro em ${endpoint}:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      error: 'Nenhum endpoint alternativo retornou QR Code',
      instanceName
    };
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

      console.log(`🔍 [CODECHAT-DEBUG] Response status: ${response.status}`);
      console.log(`🔍 [CODECHAT-DEBUG] Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Verificar se é JSON ou texto
      const contentType = response.headers.get('content-type');
      console.log(`🔍 [CODECHAT-DEBUG] Content-Type: ${contentType}`);
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        console.log(`🔍 [CODECHAT-DEBUG] Response JSON:`, data);
        
        // Mais campos possíveis para QR Code
        const qrCode = data.base64 || data.qrCode || data.code || data.qr || 
                      data.data?.base64 || data.data?.qrCode || data.data?.code || 
                      data.qrcode?.base64 || data.qrcode?.code;
        
        if (qrCode) {
          console.log(`✅ [CODECHAT-API] QR obtido via endpoint QR JSON`);
          
          // 🔑 SALVAR QR CODE NO BANCO IMEDIATAMENTE
          await this.saveQRCodeToDatabase(instanceName, qrCode);
          
          return {
            success: true,
            qrCode: qrCode,
            status: 'qr_ready',
            instanceName
          };
        }
      } else {
        // Se retornar texto/HTML, verificar se é HTML da página de QR
        const text = await response.text();
        console.log(`🔍 [CODECHAT-DEBUG] Response text (primeiros 200 chars):`, text.substring(0, 200));
        console.log(`🔍 [CODECHAT-DEBUG] Content-Type:`, response.headers.get('content-type'));
        
        // Se for HTML, tentar extrair QR code
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          console.log(`📄 [CODECHAT-API] Endpoint retornou HTML, tentando extrair QR Code...`);
          
          const extractedQR = this.extractQRFromHTML(text);
          if (extractedQR) {
            console.log(`✅ [CODECHAT-API] QR Code extraído do HTML com sucesso`);
            
            // 🔑 SALVAR QR CODE NO BANCO IMEDIATAMENTE
            await this.saveQRCodeToDatabase(instanceName, extractedQR);
            
            return {
              success: true,
              qrCode: extractedQR,
              status: 'qr_ready',
              instanceName
            };
          } else {
            console.log(`⚠️ [CODECHAT-API] Não foi possível extrair QR Code do HTML`);
            console.log(`🔄 [CODECHAT-API] QR Code deve ser obtido via WebSocket ou polling`);
            return {
              success: false,
              error: 'Não foi possível extrair QR Code do HTML',
              instanceName
            };
          }
        }
        
        // Se for base64 direto
        if (text && text.startsWith('data:image')) {
          console.log(`✅ [CODECHAT-API] QR obtido via endpoint QR texto`);
          
          // 🔑 SALVAR QR CODE NO BANCO IMEDIATAMENTE
          await this.saveQRCodeToDatabase(instanceName, text);
          
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

  // ============ VERIFICAR QR VIA WEBHOOK NO BANCO ============
  async checkQRFromWebhook(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🔍 [CODECHAT-WEBHOOK] Verificando QR via webhook no banco: ${instanceName}`);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('qr_code, has_qr_code, qr_expires_at, status')
        .eq('instance_id', instanceName)
        .single();

      if (error) {
        console.error('❌ [CODECHAT-WEBHOOK] Erro ao buscar QR no banco:', error);
        return { success: false, error: error.message, instanceName };
      }

      if (data?.has_qr_code && data?.qr_code) {
        // Verificar se QR não expirou
        const expiresAt = data.qr_expires_at ? new Date(data.qr_expires_at) : null;
        const now = new Date();
        
        if (!expiresAt || expiresAt > now) {
          console.log(`✅ [CODECHAT-WEBHOOK] QR Code encontrado via webhook!`);
          return {
            success: true,
            qrCode: data.qr_code,
            status: data.status || 'qr_ready',
            instanceName
          };
        } else {
          console.log(`⏰ [CODECHAT-WEBHOOK] QR Code expirado`);
        }
      }

      return { success: false, error: 'QR não encontrado via webhook', instanceName };
    } catch (error: any) {
      console.error(`❌ [CODECHAT-WEBHOOK] Erro:`, error);
      return { success: false, error: error.message, instanceName };
    }
  }

  // ============ ESTRATÉGIA HÍBRIDA: POLLING + WEBHOOK ============
  async connectInstanceHybrid(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-HYBRID] Iniciando conexão híbrida: ${instanceName}`);
      
      // 1. Verificar se já existe QR via webhook
      const webhookResult = await this.checkQRFromWebhook(instanceName);
      if (webhookResult.success && webhookResult.qrCode) {
        console.log(`✅ [CODECHAT-HYBRID] QR encontrado via webhook!`);
        return webhookResult;
      }

      // 2. Conectar via API e aguardar QR (webhook ou polling)
      console.log(`🔗 [CODECHAT-HYBRID] Conectando via API...`);
      await this.connectWithRetry(instanceName, 1);

      // 3. Estratégia híbrida: polling de endpoints + verificação webhook
      return await this.hybridQRStrategy(instanceName);

    } catch (error: any) {
      console.error(`❌ [CODECHAT-HYBRID] Erro:`, error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ ESTRATÉGIA HÍBRIDA POLLING + WEBHOOK ============
  private async hybridQRStrategy(instanceName: string, maxAttempts: number = 20): Promise<QRCodeResponse> {
    console.log(`🔄 [CODECHAT-HYBRID] Iniciando estratégia híbrida para: ${instanceName}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 [CODECHAT-HYBRID] Tentativa ${attempt}/${maxAttempts}`);
      
      try {
        // 1. Verificar via webhook primeiro (mais rápido)
        const webhookResult = await this.checkQRFromWebhook(instanceName);
        if (webhookResult.success && webhookResult.qrCode) {
          console.log(`✅ [CODECHAT-HYBRID] QR encontrado via webhook na tentativa ${attempt}!`);
          return webhookResult;
        }

        // 2. Tentar múltiplos endpoints REST
        const restResult = await this.tryMultipleQREndpoints(instanceName);
        if (restResult.success && restResult.qrCode) {
          console.log(`✅ [CODECHAT-HYBRID] QR encontrado via REST na tentativa ${attempt}!`);
          return restResult;
        }

        // 3. Verificar se já conectou
        try {
          const status = await this.getInstanceStatus(instanceName);
          if (status.state === 'open') {
            console.log(`✅ [CODECHAT-HYBRID] Instância conectada durante tentativa ${attempt}!`);
            return {
              success: true,
              qrCode: undefined,
              status: 'connected',
              instanceName,
              data: status
            };
          }
        } catch (statusError) {
          // Ignorar erro de status
        }

        if (attempt < maxAttempts) {
          // Intervalos menores no início, maiores depois
          const delay = attempt <= 5 ? 3000 : attempt <= 10 ? 5000 : 7000;
          console.log(`⏳ [CODECHAT-HYBRID] Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error: any) {
        console.warn(`⚠️ [CODECHAT-HYBRID] Erro na tentativa ${attempt}:`, error.message);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    console.log(`❌ [CODECHAT-HYBRID] Estratégia híbrida finalizada sem sucesso após ${maxAttempts} tentativas`);
    return {
      success: false,
      error: `QR Code não encontrado após ${maxAttempts} tentativas (híbrido)`,
      instanceName
    };
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

  // ============ GET ALL INSTANCES ============
  async getAllInstances(): Promise<any[]> {
    try {
      console.log('📋 [CODECHAT] Buscando todas as instâncias');
      
      const url = `${this.getApiBaseUrl()}/instance/fetchInstances`;
      console.log(`📡 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders('fetchInstances'),
      });
      
      console.log(`📊 [CODECHAT-API] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [CODECHAT] Instâncias encontradas:`, data);
      
      // Normalizar resposta - pode ser array ou objeto com array
      if (Array.isArray(data)) {
        return data;
      } else if (data && data.instances && Array.isArray(data.instances)) {
        return data.instances;
      } else if (data && typeof data === 'object') {
        return [data]; // Instância única
      }
      
      return [];
      
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao buscar instâncias:', error);
      throw error;
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

  // ============ LOGOUT INSTANCE ============
  async logoutInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log('🚪 [CODECHAT-API] Fazendo logout da instância:', instanceName);
      
      const response = await fetch(`${this.getApiBaseUrl()}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(instanceName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [CODECHAT-API] Logout realizado:', data);

      return {
        success: true,
        data,
        status: 'logout_success',
        instanceName
      };
    } catch (error: any) {
      console.error('❌ [CODECHAT-API] Erro ao fazer logout:', error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }

  // ============ BUSCAR NOME REAL NO YUMER SALVO NO BANCO ============
  private async getRealYumerInstanceName(instanceId: string): Promise<string | null> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('yumer_instance_name')
        .eq('instance_id', instanceId)
        .single();

      if (error || !data?.yumer_instance_name) {
        console.log(`ℹ️ [CODECHAT-DEBUG] Nome real não encontrado para ${instanceId}`);
        return null;
      }

      return data.yumer_instance_name;
    } catch (error) {
      console.error(`❌ [CODECHAT-DEBUG] Erro ao buscar nome real:`, error);
      return null;
    }
  }

  // ============ CREATE INSTANCE - PADRÃO CORRETO DA API ============
  async createInstance(instanceName: string, description?: string): Promise<CreateInstanceResult> {
    try {
      console.log(`📝 [CODECHAT-API] Criando instância (padrão correto): ${instanceName}`);
      
      const url = `${this.getApiBaseUrl()}/instance/create`;
      console.log(`🌐 [CODECHAT-API] POST ${url}`);
      
      const requestBody = {
        instanceName,
        description: description || `Instance: ${instanceName}`
      };
      
      console.log(`📋 [CODECHAT-API] Request body:`, requestBody);
      
      // Usar autenticação global para criar instância (não temos token ainda)
      const response = await fetch(url, {
        method: 'POST',
        headers: await this.getAuthHeaders(instanceName, false), // false = não usar instance token
        body: JSON.stringify(requestBody)
      });
      
      console.log(`📊 [CODECHAT-API] Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CODECHAT-API] Instância criada:', data);
        
        // ============ INVESTIGAR E EXTRAIR NOME REAL ============
        const yumerInstanceName = data.instance?.instanceName || data.instanceName || data.name;
        console.log(`🔍 [CODECHAT-DEBUG] Nome enviado: ${instanceName}`);
        console.log(`🔍 [CODECHAT-DEBUG] Nome retornado pelo YUMER: ${yumerInstanceName}`);
        console.log(`🔍 [CODECHAT-DEBUG] Response completa:`, JSON.stringify(data, null, 2));
        
        // ============ EXTRAIR E SALVAR AUTH TOKEN (CRÍTICO) ============
        const authToken = data.Auth?.token || data.hash || data.auth_token || data.token;
        const correctInstanceName = yumerInstanceName || instanceName;
        
        if (authToken) {
          console.log(`🔐 [CODECHAT-API] ✅ Auth token extraído da resposta!`);
          await this.saveInstanceAuthToken(correctInstanceName, authToken);
          console.log(`🔑 [CODECHAT-DEBUG] Token salvo para: ${correctInstanceName}`);
        } else {
          console.warn(`⚠️ [CODECHAT-API] Auth token não encontrado na resposta:`, data);
        }
        
        return {
          success: true,
          instanceName: correctInstanceName,
          actualName: yumerInstanceName,
          data: {
            ...data,
            authTokenSaved: !!authToken
          }
        };
      } else {
        const errorText = await response.text();
        console.error('❌ [CODECHAT-API] Erro na criação:', errorText);
        
        // Verificar se é erro 403/400/409 (instância já existe)
        const isConflict = response.status === 409 || response.status === 403 || response.status === 400;
        const isAlreadyExists = isConflict && (
          errorText.includes('already in use') || 
          errorText.includes('already exists') ||
          errorText.includes('Instance already exists')
        );
        
        if (isAlreadyExists) {
          console.log('ℹ️ [CODECHAT-API] Instância já existe - continuando');
          return {
            success: true,
            instanceName,
            actualName: instanceName, // Se já existe, usar o nome fornecido
            data: {
              alreadyExists: true
            }
          };
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          instanceName
        };
      }
      
    } catch (error: any) {
      console.error('❌ [CODECHAT-API] Erro ao criar instância:', error);
      return {
        success: false,
        error: error.message,
        instanceName
      };
    }
  }
}

export const codechatQRService = new CodeChatQRService();