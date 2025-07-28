import { supabase } from "@/integrations/supabase/client";
import { yumerJwtService } from "./yumerJwtService";

export interface BusinessTokenResult {
  success: boolean;
  token?: string;
  error?: string;
  expiresAt?: Date;
}

class BusinessTokenService {
  
  /**
   * Regenera o business token para um cliente específico
   */
  async regenerateBusinessToken(clientId: string): Promise<BusinessTokenResult> {
    try {
      console.log('🔄 [BUSINESS-TOKEN] Regenerando business token para cliente:', clientId);
      
      // 1. Buscar dados do cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_id, name, email')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        console.error('❌ [BUSINESS-TOKEN] Cliente não encontrado:', clientError);
        return { success: false, error: 'Cliente não encontrado' };
      }

      // 2. Buscar instância do cliente
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, yumer_instance_name')
        .eq('client_id', clientId)
        .maybeSingle();

      if (instanceError || !instance) {
        console.error('❌ [BUSINESS-TOKEN] Instância não encontrada:', instanceError);
        return { success: false, error: 'Instância não encontrada para o cliente' };
      }

      // 3. Gerar novo business token usando o serviço JWT
      let businessToken: string;
      
      if (client.business_id && instance.instance_id) {
        // Usar generateInstanceJWT se temos business_id
        businessToken = await yumerJwtService.generateInstanceJWT(instance.instance_id, client.business_id);
      } else if (instance.yumer_instance_name) {
        // Fallback para generateLocalJWT
        businessToken = await yumerJwtService.generateLocalJWT(instance.yumer_instance_name);
      } else {
        throw new Error('Dados insuficientes para gerar token: sem business_id nem yumer_instance_name');
      }

      // 4. Calcular data de expiração (4 horas)
      const expiresAt = new Date(Date.now() + (4 * 60 * 60 * 1000));

      // 5. Atualizar o token no banco de dados
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          business_token: businessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (updateError) {
        console.error('❌ [BUSINESS-TOKEN] Erro ao salvar token no banco:', updateError);
        return { success: false, error: 'Erro ao salvar token no banco de dados' };
      }

      // 6. Também atualizar o auth_jwt na instância
      const { error: instanceUpdateError } = await supabase
        .from('whatsapp_instances')
        .update({ 
          auth_jwt: businessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      if (instanceUpdateError) {
        console.warn('⚠️ [BUSINESS-TOKEN] Aviso: não foi possível atualizar auth_jwt na instância:', instanceUpdateError);
      }

      console.log('✅ [BUSINESS-TOKEN] Token regenerado com sucesso:', {
        clientId,
        tokenLength: businessToken.length,
        expiresAt: expiresAt.toISOString()
      });

      return { 
        success: true, 
        token: businessToken,
        expiresAt 
      };

    } catch (error: any) {
      console.error('❌ [BUSINESS-TOKEN] Erro ao regenerar token:', error);
      return { 
        success: false, 
        error: error.message || 'Erro desconhecido ao regenerar token' 
      };
    }
  }

  /**
   * Verifica se o business token está válido (não expirado)
   */
  async validateBusinessToken(clientId: string): Promise<boolean> {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', clientId)
        .single();

      if (!client?.business_token) {
        return false;
      }

      // Tentar decodificar o JWT para verificar expiração
      try {
        const tokenParts = client.business_token.split('.');
        if (tokenParts.length !== 3) {
          return false;
        }

        const payload = JSON.parse(atob(tokenParts[1]));
        const expirationTime = payload.exp * 1000; // Converter para milliseconds
        const currentTime = Date.now();

        return currentTime < expirationTime;
      } catch (decodeError) {
        console.warn('⚠️ [BUSINESS-TOKEN] Erro ao decodificar token:', decodeError);
        return false;
      }

    } catch (error) {
      console.error('❌ [BUSINESS-TOKEN] Erro ao validar token:', error);
      return false;
    }
  }

  /**
   * Regenera automaticamente o token se ele estiver expirado
   */
  async ensureValidToken(clientId: string): Promise<BusinessTokenResult> {
    const isValid = await this.validateBusinessToken(clientId);
    
    if (isValid) {
      console.log('✅ [BUSINESS-TOKEN] Token válido, não precisa regenerar');
      return { success: true };
    }

    console.log('🔄 [BUSINESS-TOKEN] Token inválido ou expirado, regenerando...');
    return await this.regenerateBusinessToken(clientId);
  }

  /**
   * Obtém o business token válido para um cliente
   */
  async getValidBusinessToken(clientId: string): Promise<string | null> {
    const result = await this.ensureValidToken(clientId);
    
    if (!result.success) {
      console.error('❌ [BUSINESS-TOKEN] Não foi possível obter token válido:', result.error);
      return null;
    }

    // Se regenerou, retornar o novo token
    if (result.token) {
      return result.token;
    }

    // Se não regenerou, buscar do banco
    const { data: client } = await supabase
      .from('clients')
      .select('business_token')
      .eq('id', clientId)
      .single();

    return client?.business_token || null;
  }
}

export const businessTokenService = new BusinessTokenService();