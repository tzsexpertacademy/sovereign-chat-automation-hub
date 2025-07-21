
import { supabase } from "@/integrations/supabase/client";
import { whatsappInstancesService, WhatsAppInstanceData } from "./whatsappInstancesService";
import { codechatApiService } from "./codechatApiService";

/**
 * Gerenciador Unificado de Instâncias WhatsApp
 * LOCAL FIRST: Prioriza dados do Supabase, APIs externas secundárias
 */
export class WhatsAppInstanceManager {
  
  /**
   * Buscar instâncias ativas de um cliente (LOCAL FIRST)
   */
  async getActiveClientInstances(clientId: string): Promise<WhatsAppInstanceData[]> {
    console.log('🔍 [INSTANCE-MANAGER] Buscando instâncias locais para cliente:', clientId);
    
    try {
      // SEMPRE usar dados locais como fonte da verdade
      const localInstances = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      // Filtrar apenas instâncias ativas/conectadas para importação
      const activeInstances = localInstances.filter(instance => 
        instance.status === 'connected' || instance.status === 'qr_ready'
      );
      
      console.log('✅ [INSTANCE-MANAGER] Instâncias encontradas:', {
        total: localInstances.length,
        active: activeInstances.length,
        instances: activeInstances.map(i => ({
          id: i.instance_id,
          status: i.status,
          name: i.custom_name
        }))
      });
      
      return activeInstances;
    } catch (error) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao buscar instâncias locais:', error);
      return [];
    }
  }

  /**
   * Verificar se cliente tem instâncias válidas para importação
   */
  async hasValidInstancesForImport(clientId: string): Promise<boolean> {
    const instances = await this.getActiveClientInstances(clientId);
    return instances.length > 0;
  }

  /**
   * Buscar chats de uma instância específica (API externa)
   */
  async getInstanceChats(instanceName: string, limit: number = 50): Promise<any[]> {
    console.log('📡 [INSTANCE-MANAGER] Buscando chats da instância:', instanceName);
    
    try {
      const chats = await codechatApiService.findChats(instanceName, limit);
      
      console.log('✅ [INSTANCE-MANAGER] Chats encontrados:', chats.length);
      return chats;
    } catch (error) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao buscar chats:', error);
      return [];
    }
  }

  /**
   * Buscar mensagens de um chat específico (API externa)
   */
  async getInstanceMessages(instanceName: string, chatId: string, limit: number = 50): Promise<any[]> {
    console.log('📨 [INSTANCE-MANAGER] Buscando mensagens:', { instanceName, chatId });
    
    try {
      const messages = await codechatApiService.findMessages(instanceName, chatId, limit);
      
      console.log('✅ [INSTANCE-MANAGER] Mensagens encontradas:', messages.length);
      return messages;
    } catch (error) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Sincronizar status de instância (LOCAL + API)
   */
  async syncInstanceStatus(instanceId: string): Promise<void> {
    console.log('🔄 [INSTANCE-MANAGER] Sincronizando status:', instanceId);
    
    try {
      // Status será atualizado via webhook ou sincronização
      // const apiStatus = await codechatApiService.getInstanceStatus(instanceId);
      
      // Status será atualizado via webhook
      const localStatus = 'disconnected'; // Placeholder
      
      // TODO: Implementar sincronização real quando necessário
      // await whatsappInstancesService.updateInstanceStatus(instanceId, localStatus);
      
      console.log('✅ [INSTANCE-MANAGER] Status sincronizado:', { instanceId, status: localStatus });
    } catch (error) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao sincronizar status:', error);
    }
  }

  /**
   * Obter resumo de instâncias para dashboard
   */
  async getInstancesSummary(clientId: string): Promise<{
    total: number;
    connected: number;
    disconnected: number;
    instances: WhatsAppInstanceData[];
  }> {
    const instances = await whatsappInstancesService.getInstancesByClientId(clientId);
    
    const connected = instances.filter(i => i.status === 'connected').length;
    const disconnected = instances.filter(i => i.status === 'disconnected').length;
    
    return {
      total: instances.length,
      connected,
      disconnected,
      instances
    };
  }
}

export const whatsappInstanceManager = new WhatsAppInstanceManager();
