import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço para fazer query direto no Supabase via fetch
 * Usado para contornar limitações do cliente Supabase
 */
class RealTimeWebSocketService {
  
  /**
   * Executa query SQL diretamente no Supabase
   */
  async executeQuery(query: string): Promise<any> {
    try {
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ [REALTIME-WS] Erro ao executar query:', error);
      throw error;
    }
  }

  /**
   * Obter JWT da instância
   */
  async getInstanceJWT(instanceId: string, clientId: string): Promise<string | null> {
    try {
      const query = `
        SELECT auth_jwt, business_token 
        FROM whatsapp_instances 
        WHERE instance_id = '${instanceId}' AND client_id = '${clientId}'
        LIMIT 1
      `;

      const result = await this.executeQuery(query);
      
      if (result.data && result.data.length > 0) {
        return result.data[0].auth_jwt || result.data[0].business_token;
      }

      return null;
    } catch (error) {
      console.error('❌ [REALTIME-WS] Erro ao obter JWT da instância:', error);
      return null;
    }
  }

  /**
   * Atualizar JWT da instância
   */
  async updateInstanceJWT(instanceId: string, clientId: string, jwt: string): Promise<boolean> {
    try {
      const query = `
        UPDATE whatsapp_instances 
        SET auth_jwt = '${jwt}', updated_at = NOW()
        WHERE instance_id = '${instanceId}' AND client_id = '${clientId}'
      `;

      await this.executeQuery(query);
      return true;
    } catch (error) {
      console.error('❌ [REALTIME-WS] Erro ao atualizar JWT:', error);
      return false;
    }
  }

  /**
   * Verificar se instância existe
   */
  async instanceExists(instanceId: string, clientId: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM whatsapp_instances 
        WHERE instance_id = '${instanceId}' AND client_id = '${clientId}'
      `;

      const result = await this.executeQuery(query);
      return result.data?.[0]?.count > 0;
    } catch (error) {
      console.error('❌ [REALTIME-WS] Erro ao verificar instância:', error);
      return false;
    }
  }
}

export const realTimeWebSocketService = new RealTimeWebSocketService();