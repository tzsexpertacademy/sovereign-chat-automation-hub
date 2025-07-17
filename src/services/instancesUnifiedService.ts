import { supabase } from "@/integrations/supabase/client";
import { whatsappInstancesService } from "./whatsappInstancesService";
import { clientsService } from "./clientsService";
import { codechatQRService } from "./codechatQRService";

/**
 * Serviço Unificado de Instâncias
 * Corrige problemas de arquitetura e sincronização entre tabelas
 */
export class InstancesUnifiedService {
  
  /**
   * Buscar todas as instâncias de um cliente de forma unificada
   */
  async getClientInstances(clientId: string) {
    console.log('🔍 [UNIFIED-SERVICE] Buscando instâncias para cliente:', clientId);
    
    try {
      // SEMPRE buscar da tabela whatsapp_instances (source of truth)
      const instances = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      console.log('✅ [UNIFIED-SERVICE] Instâncias encontradas:', instances.length);
      return instances;
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao buscar instâncias:', error);
      throw error;
    }
  }

  /**
   * Criar nova instância seguindo o padrão correto da API
   */
  async createInstanceForClient(clientId: string, customName?: string) {
    console.log('🚀 [UNIFIED-SERVICE] Criando instância seguindo padrão correto da API:', clientId);
    
    try {
      // 1. Verificar se cliente pode criar mais instâncias
      const canCreate = await clientsService.canCreateInstance(clientId);
      if (!canCreate) {
        throw new Error('Cliente atingiu o limite de instâncias');
      }

      // 2. Gerar instance_id único
      const timestamp = Date.now();
      const instanceId = `${clientId}_${timestamp}`;
      
      // 3. Criar no banco de dados primeiro (source of truth)
      const newInstance = await whatsappInstancesService.createInstance({
        instance_id: instanceId,
        client_id: clientId,
        custom_name: customName,
        status: 'disconnected',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log('✅ [UNIFIED-SERVICE] Instância criada no banco:', newInstance);

      // 4. Criar instância no YUMER seguindo padrão correto (POST /instance/create)
      console.log('🔗 [UNIFIED-SERVICE] Criando instância no YUMER...');
      const yumerResult = await codechatQRService.createInstance(instanceId, customName);
      
      if (!yumerResult.success) {
        console.warn('⚠️ [UNIFIED-SERVICE] Falha ao criar no YUMER:', yumerResult.error);
        // Não vamos falhar o processo, apenas logar
      } else {
        console.log('✅ [UNIFIED-SERVICE] Instância criada no YUMER com Bearer token salvo');
        
        // ============ VERIFICAR E CORRIGIR NOMENCLATURA ============
        if (yumerResult.actualName && yumerResult.actualName !== instanceId) {
          console.log(`🔄 [UNIFIED-SERVICE] YUMER retornou nome diferente!`);
          console.log(`📝 [UNIFIED-SERVICE] Nome enviado: ${instanceId}`);
          console.log(`📝 [UNIFIED-SERVICE] Nome real no YUMER: ${yumerResult.actualName}`);
          
          // Atualizar o banco com o nome real que o YUMER está usando
          await whatsappInstancesService.updateInstanceByInstanceId(instanceId, {
            yumer_instance_name: yumerResult.actualName,
            updated_at: new Date().toISOString()
          });
          
          console.log(`✅ [UNIFIED-SERVICE] Nome real salvo no banco: ${yumerResult.actualName}`);
        }
      }
      
      // 5. O trigger sincronizará automaticamente com clients table
      
      return newInstance;
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao criar instância:', error);
      throw error;
    }
  }

  /**
   * Conectar instância usando estratégia híbrida (REST + Webhook)
   */
  async connectInstance(instanceId: string) {
    console.log('🔗 [UNIFIED-SERVICE] Conectando instância seguindo padrão correto:', instanceId);
    
    try {
      // Usar nova estratégia híbrida que combina polling REST + webhook
      const result = await codechatQRService.connectInstanceHybrid(instanceId);
      
      if (result.success) {
        // Atualizar status no banco
        const updateData: any = { status: result.status };
        if (result.data?.phoneNumber) {
          updateData.phone_number = result.data.phoneNumber;
        }
        
        await whatsappInstancesService.updateInstanceStatus(instanceId, result.status, updateData);
        console.log(`✅ [UNIFIED-SERVICE] Status atualizado no banco: ${result.status}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao conectar instância:', error);
      throw error;
    }
  }

  /**
   * Remover instância com sincronização automática
   */
  async deleteInstance(instanceId: string) {
    console.log('🗑️ [UNIFIED-SERVICE] Removendo instância:', instanceId);
    
    try {
      // 1. Buscar instância para validar cliente
      const instance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
      if (!instance) {
        console.warn('⚠️ [UNIFIED-SERVICE] Instância não encontrada no banco');
        return;
      }

      // 2. Tentar desconectar no YUMER (se possível)
      try {
        await codechatQRService.deleteInstance(instanceId);
        console.log('✅ [UNIFIED-SERVICE] Instância removida do YUMER');
      } catch (error) {
        console.warn('⚠️ [UNIFIED-SERVICE] Erro ao remover do YUMER (continuando):', error);
      }

      // 3. Remover do banco (trigger sincronizará clients automaticamente)
      await whatsappInstancesService.deleteInstance(instanceId);
      
      console.log('✅ [UNIFIED-SERVICE] Instância removida com sucesso');
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao remover instância:', error);
      throw error;
    }
  }

  /**
   * Verificar se instância existe (usando busca na lista)
   */
  async checkInstanceExists(instanceId: string): Promise<{ exists: boolean; inDatabase: boolean; inYumer: boolean }> {
    console.log('🔍 [UNIFIED-SERVICE] Verificando existência de instância:', instanceId);
    
    try {
      // 1. Verificar no banco de dados
      const dbInstance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
      const inDatabase = !!dbInstance;
      
      // 2. Verificar no YUMER usando fetchInstances (lista)
      let inYumer = false;
      try {
        const yumerCheck = await codechatQRService.checkInstanceExists(instanceId);
        inYumer = yumerCheck.exists;
      } catch (error) {
        console.warn('⚠️ [UNIFIED-SERVICE] Erro ao verificar YUMER:', error);
        inYumer = false;
      }
      
      const exists = inDatabase || inYumer;
      
      console.log('📊 [UNIFIED-SERVICE] Status de existência:', {
        instanceId,
        exists,
        inDatabase,
        inYumer
      });
      
      return { exists, inDatabase, inYumer };
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao verificar existência:', error);
      return { exists: false, inDatabase: false, inYumer: false };
    }
  }

  /**
   * Sincronizar status entre YUMER e banco
   */
  async syncInstanceStatus(instanceId: string) {
    console.log('🔄 [UNIFIED-SERVICE] Sincronizando status:', instanceId);
    
    try {
      // 1. Buscar status no YUMER
      const yumerStatus = await codechatQRService.getInstanceStatus(instanceId);
      
      // 2. Mapear status
      let mappedStatus = 'disconnected';
      if (yumerStatus.state === 'open') {
        mappedStatus = 'connected';
      } else if (yumerStatus.state === 'connecting') {
        mappedStatus = 'connecting';
      } else if (yumerStatus.state === 'close') {
        mappedStatus = 'disconnected';
      }
      
      // 3. Buscar detalhes se conectado
      let phoneNumber = undefined;
      if (mappedStatus === 'connected') {
        try {
          const details = await codechatQRService.getInstanceDetails(instanceId);
          phoneNumber = details.ownerJid;
        } catch (error) {
          console.warn('⚠️ [UNIFIED-SERVICE] Erro ao buscar detalhes:', error);
        }
      }
      
      // 4. Atualizar banco (trigger sincronizará clients)
      await whatsappInstancesService.updateInstanceStatus(instanceId, mappedStatus, {
        phone_number: phoneNumber,
        updated_at: new Date().toISOString()
      });
      
      console.log('✅ [UNIFIED-SERVICE] Status sincronizado:', {
        instanceId,
        status: mappedStatus,
        phoneNumber
      });
      
      return { status: mappedStatus, phoneNumber };
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao sincronizar status:', error);
      throw error;
    }
  }

  /**
   * Dashboard de saúde do sistema
   */
  async getSystemHealth() {
    try {
      // 1. Estatísticas do banco
      const { data: dbStats, error } = await supabase
        .from('whatsapp_instances')
        .select('status, client_id')
        .not('client_id', 'is', null);

      if (error) throw error;

      // 2. Estatísticas por status
      const statusCounts = dbStats.reduce((acc, instance) => {
        acc[instance.status] = (acc[instance.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 3. Estatísticas por cliente
      const clientCounts = dbStats.reduce((acc, instance) => {
        acc[instance.client_id] = (acc[instance.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalInstances: dbStats.length,
        statusBreakdown: statusCounts,
        clientsWithInstances: Object.keys(clientCounts).length,
        averageInstancesPerClient: dbStats.length / Math.max(Object.keys(clientCounts).length, 1),
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao verificar saúde:', error);
      throw error;
    }
  }

  /**
   * Operação de limpeza e sincronização
   */
  async cleanupAndSync() {
    console.log('🧹 [UNIFIED-SERVICE] Iniciando limpeza e sincronização');
    
    try {
      // 1. Limpar QR codes expirados
      const { data: expiredQRs, error } = await supabase
        .from('whatsapp_instances')
        .update({
          qr_code: null,
          has_qr_code: false,
          qr_expires_at: null
        })
        .lt('qr_expires_at', new Date().toISOString())
        .select('instance_id');

      if (error) throw error;

      console.log('🧹 [UNIFIED-SERVICE] QR codes expirados limpos:', expiredQRs?.length || 0);

      // 2. Verificar consistência de dados
      const health = await this.getSystemHealth();
      
      return {
        expiredQRsCleared: expiredQRs?.length || 0,
        systemHealth: health
      };
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro na limpeza:', error);
      throw error;
    }
  }

  /**
   * Diagnóstico de consistência entre banco e YUMER
   */
  async diagnoseSyncConsistency() {
    try {
      // 1. Buscar instâncias do banco
      const { data: dbInstances, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, status')
        .not('client_id', 'is', null);

      if (error) throw error;

      // 2. Buscar instâncias do YUMER
      let yumerInstances: any[] = [];
      try {
        const yumerResponse = await codechatQRService.getAllInstances();
        yumerInstances = Array.isArray(yumerResponse) ? yumerResponse : [];
      } catch (error) {
        console.warn('⚠️ [UNIFIED-SERVICE] Erro ao buscar instâncias YUMER:', error);
      }

      // 3. Identificar órfãs
      const dbInstanceIds = dbInstances.map(i => i.instance_id);
      const yumerInstanceIds = yumerInstances.map(i => i.name || i.instanceName);

      const orphanedInSupabase = dbInstances.filter(
        db => !yumerInstanceIds.includes(db.instance_id)
      );

      const orphanedInYumer = yumerInstances.filter(
        yumer => !dbInstanceIds.includes(yumer.name || yumer.instanceName)
      );

      const synchronized = orphanedInSupabase.length === 0 && orphanedInYumer.length === 0;

      return {
        synchronized,
        dbInstances: dbInstances.length,
        yumerInstances: yumerInstances.length,
        orphanedInSupabase,
        orphanedInYumer,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro no diagnóstico:', error);
      throw error;
    }
  }

  /**
   * Buscar todas as instâncias do YUMER
   */
  async getAllYumerInstances() {
    try {
      return await codechatQRService.getAllInstances();
    } catch (error) {
      console.error('❌ [UNIFIED-SERVICE] Erro ao buscar instâncias YUMER:', error);
      throw error;
    }
  }

  /**
   * Extermínio total - remover todas as instâncias
   */
  async totalExtermination() {
    console.log('💀 [UNIFIED-SERVICE] INICIANDO EXTERMÍNIO TOTAL');
    
    const errors: string[] = [];
    let yumerDeleted = 0;
    let supabaseDeleted = 0;

    try {
      // 1. Buscar todas as instâncias do YUMER
      let yumerInstances: any[] = [];
      try {
        const yumerResponse = await codechatQRService.getAllInstances();
        yumerInstances = Array.isArray(yumerResponse) ? yumerResponse : [];
      } catch (error) {
        console.warn('⚠️ [EXTERMÍNIO] Erro ao buscar YUMER:', error);
      }

      // 2. Deletar do YUMER
      for (const instance of yumerInstances) {
        try {
          const instanceName = instance.name || instance.instanceName;
          if (instanceName) {
            await codechatQRService.deleteInstance(instanceName);
            yumerDeleted++;
            console.log(`💀 [EXTERMÍNIO] YUMER deletado: ${instanceName}`);
          }
        } catch (error: any) {
          errors.push(`YUMER ${instance.name}: ${error.message}`);
        }
      }

      // 3. Deletar do Supabase
      try {
        const { error } = await supabase
          .from('whatsapp_instances')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos

        if (error) throw error;

        const { count } = await supabase
          .from('whatsapp_instances')
          .select('id', { count: 'exact', head: true });

        supabaseDeleted = count || 0;
        console.log(`💀 [EXTERMÍNIO] Supabase: todas as instâncias removidas`);
      } catch (error: any) {
        errors.push(`Supabase: ${error.message}`);
      }

      return {
        yumerDeleted,
        supabaseDeleted,
        errors
      };
    } catch (error: any) {
      console.error('❌ [EXTERMÍNIO] Erro geral:', error);
      throw error;
    }
  }

  /**
   * Sincronização forçada a partir do Supabase
   */
  async forceSyncFromSupabase() {
    console.log('🔄 [UNIFIED-SERVICE] Sincronização forçada do Supabase');
    
    const errors: string[] = [];
    let created = 0;
    let deleted = 0;

    try {
      // 1. Buscar instâncias do banco
      const { data: dbInstances, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, custom_name')
        .not('client_id', 'is', null);

      if (error) throw error;

      // 2. Para cada instância do banco, garantir que existe no YUMER
      for (const dbInstance of dbInstances) {
        try {
          const exists = await codechatQRService.checkInstanceExists(dbInstance.instance_id);
          
          if (!exists.exists) {
            // Criar no YUMER
            const createResponse = await codechatQRService.createInstance(
              dbInstance.instance_id,
              dbInstance.custom_name || `Synced: ${dbInstance.instance_id}`
            );
            
            if (createResponse.success) {
              created++;
              console.log(`🔄 [SYNC] Criado no YUMER: ${dbInstance.instance_id}`);
            }
          }
        } catch (error: any) {
          errors.push(`${dbInstance.instance_id}: ${error.message}`);
        }
      }

      return {
        created,
        deleted,
        errors
      };
    } catch (error: any) {
      console.error('❌ [SYNC] Erro geral:', error);
      throw error;
    }
  }

  /**
   * Limpeza de instâncias órfãs
   */
  async cleanupOrphanedInstances() {
    console.log('🧹 [UNIFIED-SERVICE] Limpando instâncias órfãs');
    
    const errors: string[] = [];
    let cleaned = 0;

    try {
      const diagnosis = await this.diagnoseSyncConsistency();

      // 1. Remover órfãs do YUMER
      for (const orphan of diagnosis.orphanedInYumer) {
        try {
          const instanceName = orphan.name || orphan.instanceName;
          if (instanceName) {
            await codechatQRService.deleteInstance(instanceName);
            cleaned++;
            console.log(`🧹 [ORPHANS] YUMER órfã removida: ${instanceName}`);
          }
        } catch (error: any) {
          errors.push(`YUMER ${orphan.name}: ${error.message}`);
        }
      }

      // 2. Remover órfãs do Supabase
      for (const orphan of diagnosis.orphanedInSupabase) {
        try {
          await whatsappInstancesService.deleteInstance(orphan.instance_id);
          cleaned++;
          console.log(`🧹 [ORPHANS] Supabase órfã removida: ${orphan.instance_id}`);
        } catch (error: any) {
          errors.push(`Supabase ${orphan.instance_id}: ${error.message}`);
        }
      }

      return {
        cleaned,
        errors
      };
    } catch (error: any) {
      console.error('❌ [ORPHANS] Erro geral:', error);
      throw error;
    }
  }
}

export const instancesUnifiedService = new InstancesUnifiedService();