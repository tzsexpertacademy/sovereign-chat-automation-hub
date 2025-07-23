
// YUMER JWT Service - Gerencia autenticação JWT para WebSockets
import { API_BASE_URL, getYumerGlobalApiKey, auth } from '@/config/environment';
import { SignJWT } from 'jose';

// JWT Secret do servidor YUMER (deve coincidir com AUTHENTICATION_JWT_SECRET no .env)
const YUMER_JWT_SECRET = auth.jwtSecret;

export interface YumerJwtResponse {
  token: string;
  expiresIn: number;
  instanceName: string;
}

export interface YumerEventsList {
  events: string[];
  description: Record<string, string>;
}

export interface JwtConfig {
  secret: string;
  instanceName: string;
}

class YumerJwtService {
  private currentToken: string | null = null;
  private tokenExpiry: number | null = null;
  private renewalTimer: NodeJS.Timeout | null = null;

  // ============ GERAÇÃO JWT PARA INSTÂNCIAS ESPECÍFICAS ============
  async generateInstanceJWT(instanceId: string, businessId: string, customSecret?: string): Promise<string> {
    const jwtSecret = customSecret || auth.jwtSecret;
    
    try {
      console.log('🔐 [INSTANCE-JWT] Gerando JWT específico para instância...', { 
        instanceId, 
        businessId,
        secretUsed: jwtSecret.substring(0, 8) + '...' 
      });
      
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (4 * 60 * 60); // 4 horas de expiração
      
      // Payload específico para instância conforme documentação Yumer
      const payload = {
        I_ID: instanceId,      // Instance ID
        B_ID: businessId,      // Business ID  
        A_N: "codechat_api",   // Application Name
        iat: now,
        exp: exp,
        sub: "I_T"             // Subject: Instance Token
      };
      
      const secret = new TextEncoder().encode(jwtSecret);
      
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setSubject('I_T')
        .sign(secret);
      
      console.log('✅ [INSTANCE-JWT] JWT de instância gerado com sucesso');
      console.log('📋 [INSTANCE-JWT] Payload:', payload);
      console.log('🔑 [INSTANCE-JWT] Token:', token.substring(0, 50) + '...');
      
      return token;
    } catch (error: any) {
      console.error('❌ [INSTANCE-JWT] Erro ao gerar JWT:', error);
      throw error;
    }
  }

  // ============ GERAÇÃO LOCAL DE JWT PARA CODECHAT API v1.3.5 ============
  async generateLocalJWT(instanceName: string, customSecret?: string): Promise<string> {
    // SECRET OBRIGATORIAMENTE DEVE SER CONSTANTE DO .ENV DO SERVIDOR
    // É o AUTHENTICATION_JWT_SECRET no .env do backend YUMER
    const jwtSecret = customSecret || YUMER_JWT_SECRET;
    
    try {
      console.log('🔐 [CODECHAT] Gerando JWT compatível com CodeChat API v1.3.5...', { 
        instanceName: instanceName, // USAR O NOME COMPLETO SEM LIMPEZA
        secretUsed: jwtSecret.substring(0, 8) + '...' 
      });
      
      // ✅ CORREÇÃO CRÍTICA: NÃO FAZER LIMPEZA DO NOME DA INSTÂNCIA
      // Usar o instanceName EXATAMENTE como recebido (com timestamp)
      const fullInstanceName = instanceName; // Não fazer split nem limpeza
      
      // Payload compatível com CodeChat API conforme documentação oficial
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (4 * 60 * 60); // 4 horas de expiração
      
      const payload = {
        instanceName: fullInstanceName, // ✅ Nome COMPLETO da instância (com timestamp)
        apiName: "whatsapp-api", // Conforme documentação CodeChat
        tokenId: this.generateTokenId(), // ID único do token
        iat: now, // Issued at (agora)
        exp: exp, // Expira em 4 horas
        sub: "g-t" // Subject conforme exemplo da documentação
      };
      
      // Converter secret para Uint8Array
      const secret = new TextEncoder().encode(jwtSecret);
      
      // Criar JWT usando jose com estrutura CodeChat v1.3.5
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setSubject('g-t')
        .sign(secret);
      
      this.currentToken = token;
      this.tokenExpiry = exp * 1000; // Converter para milliseconds
      
      console.log('✅ [CODECHAT] JWT compatível gerado com sucesso');
      console.log('📋 [CODECHAT] Payload final:', payload);
      console.log('🔑 [CODECHAT] Token JWT:', token.substring(0, 50) + '...');
      console.log('⏱️ [CODECHAT] Expira em:', new Date(this.tokenExpiry).toISOString());
      console.log('🎯 [CODECHAT] InstanceName usado no JWT:', fullInstanceName);
      
      return token;
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao gerar JWT:', error);
      throw error;
    }
  }

  // Gerar ID único para o token (formato UUID v4 simplificado)
  private generateTokenId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ============ GERAÇÃO DE JWT (MÉTODO LEGADO - ENDPOINT) ============  
  async generateJWT(instanceName: string): Promise<string> {
    // Tentar método local primeiro (mais confiável)
    try {
      console.log('🔐 Tentando geração local de JWT primeiro...');
      return await this.generateLocalJWT(instanceName);
    } catch (localError) {
      console.warn('⚠️ Geração local falhou, tentando endpoint...', localError);
    }

    // Fallback para endpoint (se disponível)
    const globalApiKey = getYumerGlobalApiKey();
    if (!globalApiKey) {
      throw new Error('Global API Key não configurada e geração local falhou');
    }

    try {
      console.log('🔐 Tentando gerar JWT via endpoint...', instanceName);
      
      const response = await fetch(`${API_BASE_URL}/auth/jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': globalApiKey,
        },
        body: JSON.stringify({ instanceName }),
      });

      if (!response.ok) {
        throw new Error(`Endpoint /auth/jwt não disponível: ${response.status}`);
      }

      const data: YumerJwtResponse = await response.json();
      this.currentToken = data.token;
      this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
      
      console.log('✅ JWT via endpoint gerado com sucesso');
      
      // Agendar renovação automática (renovar 30 segundos antes de expirar)
      this.scheduleRenewal(instanceName, data.expiresIn - 30);
      
      return data.token;
    } catch (error: any) {
      console.error('❌ Erro ao gerar JWT via endpoint:', error);
      throw error;
    }
  }

  // ============ DESCOBERTA DE EVENTOS ============
  async getAvailableEvents(): Promise<string[]> {
    const globalApiKey = getYumerGlobalApiKey();
    if (!globalApiKey) {
      // Fallback para eventos comuns CodeChat
      return [
        'MESSAGE_RECEIVED', 
        'MESSAGE_SENT', 
        'CONNECTION_UPDATE', 
        'QR_CODE', 
        'INSTANCE_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
        'CONTACTS_UPSERT',
        'CHATS_UPSERT',
        'PRESENCE_UPDATE',
        'QRCODE_UPDATED'
      ];
    }

    try {
      console.log('📋 Descobrindo eventos disponíveis...');
      
      const response = await fetch(`${API_BASE_URL}/events/list`, {
        method: 'GET',
        headers: {
          'X-API-Key': globalApiKey,
        },
      });

      if (!response.ok) {
        console.warn('⚠️ Não foi possível obter lista de eventos, usando fallback');
        return [
          'MESSAGE_RECEIVED', 
          'MESSAGE_SENT', 
          'CONNECTION_UPDATE', 
          'QR_CODE', 
          'INSTANCE_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONTACTS_UPSERT',
          'CHATS_UPSERT',
          'PRESENCE_UPDATE',
          'QRCODE_UPDATED'
        ];
      }

      const data: YumerEventsList = await response.json();
      console.log('✅ Eventos disponíveis:', data.events);
      
      return data.events;
    } catch (error: any) {
      console.warn('⚠️ Erro ao obter eventos, usando fallback:', error);
      return [
        'MESSAGE_RECEIVED', 
        'MESSAGE_SENT', 
        'CONNECTION_UPDATE', 
        'QR_CODE', 
        'INSTANCE_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
        'CONTACTS_UPSERT',
        'CHATS_UPSERT',
        'PRESENCE_UPDATE',
        'QRCODE_UPDATED'
      ];
    }
  }

  // ============ GESTÃO DO TOKEN ============
  getCurrentToken(): string | null {
    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      console.log('⚠️ Token JWT expirou');
      this.currentToken = null;
      this.tokenExpiry = null;
    }
    return this.currentToken;
  }

  isTokenValid(): boolean {
    return this.getCurrentToken() !== null;
  }

  private scheduleRenewal(instanceName: string, delaySeconds: number): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
    }

    // Não agendar se o delay for muito curto
    if (delaySeconds < 60) {
      console.log('⚠️ Delay muito curto para renovação automática, pulando agendamento');
      return;
    }

    this.renewalTimer = setTimeout(async () => {
      try {
        console.log('🔄 Renovando JWT automaticamente...');
        await this.generateJWT(instanceName);
      } catch (error) {
        console.error('❌ Erro na renovação automática do JWT:', error);
      }
    }, delaySeconds * 1000);
  }

  clearRenewal(): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  reset(): void {
    this.currentToken = null;
    this.tokenExpiry = null;
    this.clearRenewal();
  }

  // ============ VALIDAÇÃO DE TOKEN ============
  validateTokenFormat(token: string): boolean {
    try {
      // Verificar se é um JWT válido (3 partes separadas por ponto)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }
      
      // Tentar decodificar o header e payload
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      
      // Verificar campos obrigatórios do CodeChat
      return !!(
        header.alg && 
        header.typ && 
        payload.instanceName && 
        payload.apiName && 
        payload.iat && 
        payload.exp
      );
    } catch (error) {
      return false;
    }
  }

  // Salvar JWT gerado no banco de dados
  async saveInstanceJWT(instanceId: string, businessId: string): Promise<void> {
    try {
      // Verificar se instância existe no banco
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: existingInstance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (!existingInstance) {
        console.error('❌ Instância não encontrada no banco:', instanceId);
        throw new Error(`Instância ${instanceId} não encontrada no banco`);
      }

      const jwt = await this.generateInstanceJWT(instanceId, businessId);
      
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ auth_jwt: jwt })
        .eq('instance_id', instanceId);
      
      if (error) {
        console.error('❌ Erro ao salvar JWT no banco:', error);
        throw new Error(`Erro ao salvar JWT: ${error.message}`);
      }
      
      console.log('✅ JWT salvo com sucesso para instância:', instanceId);
    } catch (error) {
      console.error('❌ Erro ao salvar JWT da instância:', error);
      throw error;
    }
  }
}

export const yumerJwtService = new YumerJwtService();
