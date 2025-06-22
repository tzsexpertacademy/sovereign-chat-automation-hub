
import { supabase } from "@/integrations/supabase/client";
import { clientsService, ClientData } from "./clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "./whatsappInstancesService";
import whatsappService from "./whatsappMultiClient";

export interface DataInconsistency {
  type: 'orphaned_client_reference' | 'orphaned_instance' | 'missing_instance' | 'server_instance_mismatch' | 'client_count_mismatch' | 'ghost_instance';
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
      
      // Buscar todas as instâncias do banco
      const { data: allInstancesInDB, error } = await supabase
        .from("whatsapp_instances")
        .select("*");
        
      if (error) throw error;
      
      // Buscar instâncias ativas no servidor WhatsApp
      let serverInstances: any[] = [];
      try {
        serverInstances = await whatsappService.getAllClients();
        console.log('📱 Instâncias no servidor:', serverInstances);
      } catch (error) {
        console.log('⚠️ Não foi possível conectar ao servidor WhatsApp:', error);
      }
      
      for (const client of clients) {
        // Verificar se cliente tem instance_id mas a instância não existe no banco
        if (client.instance_id) {
          const instanceInDB = allInstancesInDB?.find(i => i.instance_id === client.instance_id);
          
          if (!instanceInDB) {
            inconsistencies.push({
              type: 'orphaned_client_reference',
              clientId: client.id,
              clientName: client.name,
              instanceId: client.instance_id,
              description: `Cliente ${client.name} referencia instância ${client.instance_id} que não existe no banco`
            });
          } else {
            // Verificar se a instância existe no servidor
            const instanceInServer = serverInstances.find(s => s.clientId === client.instance_id);
            
            if (!instanceInServer && client.instance_status !== 'disconnected') {
              inconsistencies.push({
                type: 'ghost_instance',
                clientId: client.id,
                clientName: client.name,
                instanceId: client.instance_id,
                description: `Cliente ${client.name} tem instância ${client.instance_id} no banco mas não no servidor WhatsApp`
              });
            }
          }
        }
        
        // Verificar contagem de instâncias
        const clientInstancesInDB = allInstancesInDB?.filter(i => i.client_id === client.id) || [];
        if (client.current_instances !== clientInstancesInDB.length) {
          inconsistencies.push({
            type: 'client_count_mismatch',
            clientId: client.id,
            clientName: client.name,
            description: `Cliente ${client.name} mostra ${client.current_instances} instâncias mas tem ${clientInstancesInDB.length} no banco`
          });
        }
      }
      
      // Buscar instâncias órfãs (que referenciam clientes que não existem)
      for (const instance of allInstancesInDB || []) {
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
      // Para o caso específico do Thalis, vamos limpar a referência e atualizar a contagem
      await clientsService.updateClient(clientId, {
        instance_id: null,
        instance_status: 'disconnected'
      });
      
      // Recalcular a contagem de instâncias
      await this.fixClientCountMismatch(clientId);
      
      console.log('✅ Referência faltante corrigida');
    } catch (error) {
      console.error('❌ Erro ao corrigir referência faltante:', error);
      throw error;
    }
  }

  async fixGhostInstance(clientId: string, instanceId?: string): Promise<void> {
    console.log(`🔧 Corrigindo instância fantasma para cliente ${clientId}`);
    
    try {
      // Limpar referência do cliente e marcar como desconectado
      await clientsService.updateClient(clientId, {
        instance_id: null,
        instance_status: 'disconnected'
      });
      
      // Se temos o instanceId, vamos atualizar o status da instância no banco
      if (instanceId) {
        try {
          await whatsappInstancesService.updateInstance(instanceId, {
            status: 'disconnected'
          });
        } catch (error) {
          console.log('⚠️ Instância pode não existir mais no banco:', error);
        }
      }
      
      // Recalcular a contagem de instâncias
      await this.fixClientCountMismatch(clientId);
      
      console.log('✅ Instância fantasma corrigida');
    } catch (error) {
      console.error('❌ Erro ao corrigir instância fantasma:', error);
      throw error;
    }
  }

  async fixClientCountMismatch(clientId: string): Promise<void> {
    console.log(`🔧 Corrigindo contagem de instâncias para cliente ${clientId}`);
    
    try {
      // Recalcular contagem real de instâncias
      const { data: instances, error } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("client_id", clientId);
        
      if (error) throw error;
      
      const realCount = instances?.length || 0;
      
      await clientsService.updateClient(clientId, {
        current_instances: realCount
      });
      
      console.log(`✅ Contagem de instâncias corrigida para ${realCount}`);
    } catch (error) {
      console.error('❌ Erro ao corrigir contagem:', error);
      throw error;
    }
  }

  async fixAllInconsistencies(): Promise<number> {
    console.log('🔧 Iniciando correção automática de todas as inconsistências...');
    
    const inconsistencies = await this.findInconsistencies();
    let fixedCount = 0;
    
    for (const inconsistency of inconsistencies) {
      try {
        console.log(`🔧 Corrigindo: ${inconsistency.type} - ${inconsistency.description}`);
        
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
            
          case 'ghost_instance':
            await this.fixGhostInstance(inconsistency.clientId, inconsistency.instanceId);
            fixedCount++;
            break;
            
          case 'client_count_mismatch':
            await this.fixClientCountMismatch(inconsistency.clientId);
            fixedCount++;
            break;
        }
        
        // Pequena pausa entre correções para evitar conflitos
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Erro ao corrigir inconsistência:`, inconsistency, error);
      }
    }
    
    console.log(`✅ ${fixedCount}/${inconsistencies.length} inconsistências corrigidas`);
    return fixedCount;
  }
}

export const dataConsistencyService = new DataConsistencyService();
