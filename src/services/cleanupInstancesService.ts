import { supabase } from "@/integrations/supabase/client";

// Serviço para limpeza de instâncias do Supabase
export const cleanupInstancesService = {
  
  // Deletar instância específica do Supabase
  async deleteInstanceFromSupabase(instanceId?: number, instanceName?: string) {
    try {
      console.log(`🗑️ [SUPABASE-CLEANUP] Deletando instância:`, { instanceId, instanceName });
      
      let query = supabase.from('whatsapp_instances').delete();
      
      if (instanceId) {
        query = query.eq('id', instanceId.toString());
      } else if (instanceName) {
        query = query.eq('instance_id', instanceName);
      } else {
        throw new Error('ID ou nome da instância é obrigatório');
      }
      
      const { error, count } = await query;
      
      if (error) {
        console.error(`❌ [SUPABASE-CLEANUP] Erro:`, error);
        throw error;
      }
      
      console.log(`✅ [SUPABASE-CLEANUP] Deletado com sucesso. Linhas afetadas: ${count}`);
      return { success: true, deletedCount: count };
      
    } catch (error) {
      console.error(`❌ [SUPABASE-CLEANUP] Erro ao deletar:`, error);
      throw error;
    }
  },

  // Limpeza em massa de instâncias de teste
  async bulkCleanupTestInstances() {
    try {
      console.log(`🧹 [SUPABASE-CLEANUP] Iniciando limpeza em massa de instâncias de teste...`);
      
      // Buscar instâncias de teste
      const { data: testInstances, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, status, client_id')
        .or(
          'instance_id.like.%test_%,' +
          'instance_id.like.%qr_test_%,' +
          'instance_id.like.%Clean Instance%,' +
          'instance_id.like.%diagnostic%'
        );

      if (fetchError) {
        throw fetchError;
      }

      console.log(`📊 [SUPABASE-CLEANUP] Encontradas ${testInstances?.length || 0} instâncias de teste`);

      if (!testInstances || testInstances.length === 0) {
        return { success: true, deletedCount: 0, message: 'Nenhuma instância de teste encontrada' };
      }

      // Deletar em massa
      const idsToDelete = testInstances.map(i => i.id);
      
      const { error: deleteError, count } = await supabase
        .from('whatsapp_instances')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      console.log(`✅ [SUPABASE-CLEANUP] Limpeza concluída. ${count} instâncias deletadas`);
      
      return { 
        success: true, 
        deletedCount: count,
        deletedInstances: testInstances.map(i => i.instance_id)
      };

    } catch (error) {
      console.error(`❌ [SUPABASE-CLEANUP] Erro na limpeza em massa:`, error);
      throw error;
    }
  },

  // Limpeza de instâncias offline sem conexão WhatsApp
  async cleanupOfflineInstances() {
    try {
      console.log(`🧹 [SUPABASE-CLEANUP] Limpando instâncias offline...`);
      
      // Buscar instâncias offline sem WhatsApp conectado
      const { data: offlineInstances, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, status, phone_number')
        .eq('status', 'disconnected')
        .is('phone_number', null);

      if (fetchError) {
        throw fetchError;
      }

      console.log(`📊 [SUPABASE-CLEANUP] Encontradas ${offlineInstances?.length || 0} instâncias offline`);

      if (!offlineInstances || offlineInstances.length === 0) {
        return { success: true, deletedCount: 0, message: 'Nenhuma instância offline encontrada' };
      }

      // Deletar instâncias offline
      const idsToDelete = offlineInstances.map(i => i.id);
      
      const { error: deleteError, count } = await supabase
        .from('whatsapp_instances')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      console.log(`✅ [SUPABASE-CLEANUP] ${count} instâncias offline removidas`);
      
      return { 
        success: true, 
        deletedCount: count,
        deletedInstances: offlineInstances.map(i => i.instance_id)
      };

    } catch (error) {
      console.error(`❌ [SUPABASE-CLEANUP] Erro na limpeza de offline:`, error);
      throw error;
    }
  },

  // Estatísticas de limpeza
  async getCleanupStats() {
    try {
      // Total de instâncias
      const { count: totalCount } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true });

      // Instâncias de teste
      const { count: testCount } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .or(
          'instance_id.like.%test_%,' +
          'instance_id.like.%qr_test_%,' +
          'instance_id.like.%Clean Instance%,' +
          'instance_id.like.%diagnostic%'
        );

      // Instâncias offline
      const { count: offlineCount } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'disconnected')
        .is('phone_number', null);

      return {
        total: totalCount || 0,
        test: testCount || 0,
        offline: offlineCount || 0
      };

    } catch (error) {
      console.error(`❌ [SUPABASE-CLEANUP] Erro ao obter estatísticas:`, error);
      return { total: 0, test: 0, offline: 0 };
    }
  },

  // Limpeza FORÇA BRUTA - Remove TUDO do Supabase
  async forceCleanupAll() {
    try {
      console.log(`💀 [FORCE-CLEANUP] Iniciando limpeza força bruta...`);
      
      // Deletar TODAS as instâncias do Supabase sem exceção
      const { error, count } = await supabase
        .from('whatsapp_instances')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (usando condição que sempre é verdadeira)

      if (error) {
        throw error;
      }

      console.log(`💀 [FORCE-CLEANUP] TODAS as instâncias removidas do Supabase. Total: ${count}`);
      
      return { 
        success: true, 
        deletedCount: count,
        message: `Limpeza força bruta concluída. ${count} registros removidos do Supabase.`
      };

    } catch (error) {
      console.error(`❌ [FORCE-CLEANUP] Erro na limpeza força bruta:`, error);
      throw error;
    }
  }
};

export default cleanupInstancesService;