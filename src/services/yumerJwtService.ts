// YUMER JWT Service - Gerencia autenticação JWT para WebSockets
import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';
import { SignJWT } from 'jose';

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

  // ============ GERAÇÃO LOCAL DE JWT ============
  async generateLocalJWT(jwtSecret: string, instanceName: string): Promise<string> {
    try {
      console.log('🔐 Gerando JWT local para WebSocket...', instanceName);
      
      const payload = {
        instanceName: instanceName
      };
      
      // Converter secret para Uint8Array
      const secret = new TextEncoder().encode(jwtSecret);
      
      // Criar JWT sem expiração usando jose
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .sign(secret);
      
      this.currentToken = token;
      this.tokenExpiry = null; // Token nunca expira
      
      console.log('✅ JWT local gerado com sucesso');
      console.log('📋 Payload:', payload);
      
      return token;
    } catch (error: any) {
      console.error('❌ Erro ao gerar JWT local:', error);
      throw error;
    }
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