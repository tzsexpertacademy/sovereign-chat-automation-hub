
import { supabase } from "@/integrations/supabase/client";
import { clientsService, ClientData } from "./clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "./whatsappInstancesService";

export interface DataInconsistency {
  type: 'orphaned_client_reference' | 'orphaned_instance' | 'missing_instance';
  clientId: string;
  clientName: string;
  instanceId?: string;
  description: string;
}

export class DataConsistencyService {
  async findInconsistencies(): Promise<DataInconsistency[]> {
    console.log('🔍 Verificando inconsistências nos dados...');
    
    const inconsistencies: DataInconsistency[] = [];
    
    try {
      // Buscar todos os clientes
      const clients = await clientsService.getAllClients();
      
      for (const client of clients) {
        if (client.instance_id) {
          // Cliente tem instance_id, verificar se a instância existe
          const instance = await whatsappInstancesService.getInstanceByInstanceId(client.instance_id);
          
          if (!instance) {
            inconsistencies.push({
              type: 'orphaned_client_reference',
              clientId: client.id,
              clientName: client.name,
              instanceId: client.instance_id,
              description: `Cliente ${client.name} referencia instância ${client.instance_id} que não existe`
            });
          }
        }
      }
      
      // Buscar instâncias órfãs (que referenciam clientes que não existem ou não as referenciam de volta)
      const { data: allInstances, error } = await supabase
        .from("whatsapp_instances")
        .select("*");
        
      if (error) throw error;
      
      for (const instance of allInstances || []) {
        if (instance.client_id) {
          const client = clients.find(c => c.id === instance.client_id);
          
          if (!client) {
            inconsistencies.push({
              type: 'orphaned_instance',
              clientId: instance.client_id,
              clientName: 'Cliente não encontrado',
              instanceId: instance.instance_id,
              description: `Instância ${instance.instance_id} referencia cliente ${instance.client_id} que não existe`
            });
          } else if (client.instance_id !== instance.instance_id) {
            inconsistencies.push({
              type: 'missing_instance',
              clientId: client.id,
              clientName: client.name,
              instanceId: instance.instance_id,
              description: `Cliente ${client.name} não referencia a instância ${instance.instance_id} que está associada a ele`
            });
          }
        }
      }
      
      console.log(`🔍 Encontradas ${inconsistencies.length} inconsistências`);
      return inconsistencies;
      
    } catch (error) {
      console.error('❌ Erro ao verificar inconsistências:', error);
      throw error;
    }
  }

  async fixOrphanedClientReference(clientId: string): Promise<void> {
    console.log(`🔧 Corrigindo referência órfã do cliente ${clientId}`);
    
    try {
      // Limpar instance_id e instance_status do cliente
      await clientsService.updateClient(clientId, {
        instance_id: null,
        instance_status: 'disconnected'
      });
      
      console.log('✅ Referência órfã corrigida');
    } catch (error) {
      console.error('❌ Erro ao corrigir referência órfã:', error);
      throw error;
    }
  }

  async fixOrphanedInstance(instanceId: string): Promise<void> {
    console.log(`🔧 Removendo instância órfã ${instanceId}`);
    
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      console.log('✅ Instância órfã removida');
    } catch (error) {
      console.error('❌ Erro ao remover instância órfã:', error);
      throw error;
    }
  }

  async fixMissingInstanceReference(clientId: string, instanceId: string): Promise<void> {
    console.log(`🔧 Corrigindo referência faltante do cliente ${clientId} para instância ${instanceId}`);
    
    try {
      // Buscar status atual da instância
      const instance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
      
      await clientsService.updateClient(clientId, {
        instance_id: instanceId,
        instance_status: instance?.status || 'disconnected'
      });
      
      console.log('✅ Referência faltante corrigida');
    } catch (error) {
      console.error('❌ Erro ao corrigir referência faltante:', error);
      throw error;
    }
  }

  async fixAllInconsistencies(): Promise<number> {
    console.log('🔧 Iniciando correção automática de todas as inconsistências...');
    
    const inconsistencies = await this.findInconsistencies();
    let fixedCount = 0;
    
    for (const inconsistency of inconsistencies) {
      try {
        switch (inconsistency.type) {
          case 'orphaned_client_reference':
            await this.fixOrphanedClientReference(inconsistency.clientId);
            fixedCount++;
            break;
            
          case 'orphaned_instance':
            if (inconsistency.instanceId) {
              await this.fixOrphanedInstance(inconsistency.instanceId);
              fixedCount++;
            }
            break;
            
          case 'missing_instance':
            if (inconsistency.instanceId) {
              await this.fixMissingInstanceReference(inconsistency.clientId, inconsistency.instanceId);
              fixedCount++;
            }
            break;
        }
      } catch (error) {
        console.error(`❌ Erro ao corrigir inconsistência:`, inconsistency, error);
      }
    }
    
    console.log(`✅ ${fixedCount}/${inconsistencies.length} inconsistências corrigidas`);
    return fixedCount;
  }
}

export const dataConsistencyService = new DataConsistencyService();
