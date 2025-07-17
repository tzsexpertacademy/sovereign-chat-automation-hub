// YUMER JWT Service - Gerencia autenticação JWT para WebSockets
import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';
import { SignJWT } from 'jose';

// JWT Secret do servidor YUMER (deve coincidir com AUTHENTICATION_JWT_SECRET no .env)
const YUMER_JWT_SECRET = 'sfdgs8152g5s1s5';

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

  // ============ GERAÇÃO LOCAL DE JWT PARA CODECHAT API v1.3.3 ============
  async generateLocalJWT(instanceName: string, customSecret?: string): Promise<string> {
    // SECRET OBRIGATORIAMENTE DEVE SER CONSTANTE DO .ENV DO SERVIDOR
    // É o AUTHENTICATION_JWT_SECRET no .env do backend YUMER
    const jwtSecret = customSecret || YUMER_JWT_SECRET;
    try {
      console.log('🔐 [CODECHAT] Gerando JWT compatível com CodeChat API v1.3.3...', { instanceName, secretUsed: jwtSecret.substring(0, 8) + '...' });
      
      // Payload compatível com CodeChat API conforme documentação
      const payload = {
        instanceName: instanceName,
        apiName: "whatsapp-api", // Conforme documentação CodeChat
        tokenId: this.generateTokenId(), // ID único do token
        iat: Math.floor(Date.now() / 1000), // Issued at
        exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60), // Expira em 4 horas (NUNCA usar expiração igual a iat!)
        sub: "g-t" // Subject conforme exemplo da documentação
      };
      
      // Converter secret para Uint8Array
      const secret = new TextEncoder().encode(jwtSecret);
      
      // Criar JWT usando jose com estrutura CodeChat
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('4h') // CRÍTICO: Garantir que tenha expiração correta
        .setSubject('g-t')
        .sign(secret);
      
      this.currentToken = token;
      this.tokenExpiry = payload.exp * 1000; // Converter para milliseconds
      
      console.log('✅ [CODECHAT] JWT compatível gerado com sucesso');
      console.log('📋 [CODECHAT] Payload final:', payload);
      console.log('🔑 [CODECHAT] Token JWT:', token.substring(0, 50) + '...');
      
      return token;
    } catch (error: any) {
      console.error('❌ [CODECHAT] Erro ao gerar JWT:', error);
      throw error;
    }
  }

  // Gerar ID único para o token
  private generateTokenId(): string {
    return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ============ GERAÇÃO DE JWT (MÉTODO LEGADO - ENDPOINT) ============  
  async generateJWT(instanceName: string): Promise<string> {
    const globalApiKey = getYumerGlobalApiKey();
    if (!globalApiKey) {
      throw new Error('Global API Key não configurada');
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
      // Fallback para eventos comuns
      return ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CONNECTION_UPDATE', 'QR_CODE', 'INSTANCE_UPDATE'];
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
        return ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CONNECTION_UPDATE', 'QR_CODE', 'INSTANCE_UPDATE'];
      }

      const data: YumerEventsList = await response.json();
      console.log('✅ Eventos disponíveis:', data.events);
      
      return data.events;
    } catch (error: any) {
      console.warn('⚠️ Erro ao obter eventos, usando fallback:', error);
      return ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CONNECTION_UPDATE', 'QR_CODE', 'INSTANCE_UPDATE'];
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
}

export const yumerJwtService = new YumerJwtService();