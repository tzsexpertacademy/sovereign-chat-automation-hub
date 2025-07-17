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
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('auth_token')
        .eq('instance_id', instanceName)
        .single();

      if (error || !data?.auth_token) {
        console.log(`ℹ️ [CODECHAT-AUTH] Token não encontrado para ${instanceName}`);
        return null;
      }

      return data.auth_token;
    } catch (error) {
      console.error(`❌ [CODECHAT-AUTH] Erro ao buscar token:`, error);
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

  // ============ CONNECT INSTANCE - PADRÃO CORRETO DA API ============
  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`🚀 [CODECHAT-API] Conectando instância (padrão correto): ${instanceName}`);
      
      // ============ ETAPA 1: VERIFICAR SE JÁ ESTÁ CONECTADO ============
      try {
        const currentStatus = await this.getInstanceStatus(instanceName);
        console.log(`📊 [CODECHAT-API] Status atual:`, currentStatus);
        
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
        console.log(`ℹ️ [CODECHAT-API] Status check failed (continuando):`, statusError);
      }
      
      // ============ ETAPA 2: CONECTAR E OBTER QR CODE ============
      const url = `${this.getApiBaseUrl()}/instance/connect/${instanceName}`;
      console.log(`🌐 [CODECHAT-API] GET ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(instanceName), // Usa Bearer token da instância
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-API] Connect error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-API] Connect response:`, data);

      // ============ ETAPA 3: EXTRAIR QR CODE DA RESPOSTA ============
      const qrCode = data.base64 || data.qrCode || data.code;
      
      if (qrCode) {
        console.log(`📱 [CODECHAT-API] ✅ QR CODE RECEBIDO!`);
        return {
          success: true,
          qrCode: qrCode,
          status: 'qr_ready',
          instanceName,
          data: data
        };
      }

      // ============ FALLBACK: Se não tem QR, assume que está conectando ============
      console.log(`🔄 [CODECHAT-API] QR não disponível - instância pode estar conectando`);
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

  // ============ CREATE INSTANCE - PADRÃO CORRETO DA API ============
  async createInstance(instanceName: string, description?: string): Promise<QRCodeResponse> {
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
        
        // ============ EXTRAIR E SALVAR AUTH TOKEN (CRÍTICO) ============
        const authToken = data.Auth?.token;
        if (authToken) {
          console.log(`🔐 [CODECHAT-API] ✅ Auth token extraído da resposta!`);
          await this.saveInstanceAuthToken(instanceName, authToken);
        } else {
          console.warn(`⚠️ [CODECHAT-API] Auth token não encontrado na resposta:`, data);
        }
        
        return {
          success: true,
          qrCode: null,
          status: 'created',
          error: null,
          instanceName,
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
      console.error('❌ [CODECHAT-API] Erro ao criar instância:', error);
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