import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface BusinessTokenResult {
  success: boolean;
  token?: string;
  error?: string;
  expiresAt?: string;
}

export class BusinessTokenService {
  private static instance: BusinessTokenService;
  private tokenCache = new Map<string, { token: string; expires: number }>();

  static getInstance(): BusinessTokenService {
    if (!this.instance) {
      this.instance = new BusinessTokenService();
    }
    return this.instance;
  }

  /**
   * Obter business_token diretamente do Supabase (sem regeneração forçada)
   */
  async ensureValidToken(clientId: string): Promise<BusinessTokenResult> {
    try {
      console.log('🔑 [BUSINESS-TOKEN] Obtendo business_token para cliente:', clientId);
      
      // Buscar business_token real do cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_token')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        console.error('❌ [BUSINESS-TOKEN] Cliente não encontrado:', clientError);
        return { success: false, error: 'Cliente não encontrado' };
      }

      const realToken = client.business_token;
      
      if (!realToken || !this.validateTokenFormat(realToken)) {
        console.error('❌ [BUSINESS-TOKEN] Token inválido ou não encontrado');
        return { success: false, error: 'Token business inválido' };
      }

      console.log('✅ [BUSINESS-TOKEN] Token obtido (mesmo usado pelos outros serviços)');
      
      // Cachear token válido
      this.tokenCache.set(clientId, {
        token: realToken,
        expires: Date.now() + 3600000 // 1 hora
      });

      return { 
        success: true, 
        token: realToken
      };
        
    } catch (error: any) {
      console.error('❌ [BUSINESS-TOKEN] ERRO CRÍTICO:', error);
      return { 
        success: false, 
        error: `Erro crítico: ${error.message}` 
      };
    }
  }

  /**
   * Regenera token via API da Yumer
   */
  private async regenerateTokenViaAPI(businessId: string): Promise<BusinessTokenResult> {
    try {
      console.log('🔄 [BUSINESS-TOKEN] Chamando API para regenerar token...');
      
      const response = await fetch(`https://api.yumer.com.br/api/v2/business/${businessId}/token/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BUSINESS-TOKEN] Falha na API:', errorText);
        return { success: false, error: `API falhou: ${response.status}` };
      }

      const data = await response.json();
      console.log('✅ [BUSINESS-TOKEN] Token regenerado via API');
      
      return { success: true };

    } catch (error: any) {
      console.error('❌ [BUSINESS-TOKEN] Erro na chamada da API:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém token válido do cache ou banco
   */
  async getValidBusinessToken(clientId: string): Promise<string | null> {
    try {
      // Verificar cache primeiro
      const cached = this.tokenCache.get(clientId);
      if (cached && cached.expires > Date.now()) {
        console.log('💾 [BUSINESS-TOKEN] Token do cache válido');
        return cached.token;
      }

      // Buscar do banco
      const { data: client } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', clientId)
        .single();

      if (client?.business_token && this.validateTokenFormat(client.business_token)) {
        // Cachear token válido
        this.tokenCache.set(clientId, {
          token: client.business_token,
          expires: Date.now() + 3600000
        });
        return client.business_token;
      }

      return null;
    } catch (error) {
      console.error('❌ [BUSINESS-TOKEN] Erro ao obter token:', error);
      return null;
    }
  }

  /**
   * Regenera token business
   */
  async regenerateBusinessToken(clientId: string): Promise<BusinessTokenResult> {
    return this.ensureValidToken(clientId);
  }

  /**
   * Valida token business
   */
  async validateBusinessToken(clientId: string): Promise<boolean> {
    const token = await this.getValidBusinessToken(clientId);
    return !!token;
  }

  /**
   * Valida formato JWT
   */
  private validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Tentar decodificar header
      JSON.parse(atob(parts[0]));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Limpa cache de tokens
   */
  clearCache(): void {
    this.tokenCache.clear();
    console.log('🧹 [BUSINESS-TOKEN] Cache limpo');
  }
}

export const businessTokenService = BusinessTokenService.getInstance();