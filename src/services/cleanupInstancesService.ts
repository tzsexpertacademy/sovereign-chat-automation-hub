import { supabase } from '@/integrations/supabase/client';
import unifiedYumerService from './unifiedYumerService';

export class CleanupInstancesService {
  /**
   * Remove instâncias órfãs que existem no banco mas não no servidor
   */
  async cleanupOrphanedInstances(): Promise<{ cleaned: number; errors: string[] }> {
    console.log('🧹 [CLEANUP] Iniciando limpeza de instâncias órfãs...');
    
    let cleaned = 0;
    const errors: string[] = [];
    
    try {
      // Buscar todas as instâncias do banco
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id');
        
      if (error) {
        console.error('❌ [CLEANUP] Erro ao buscar instâncias:', error);
        return { cleaned: 0, errors: [error.message] };
      }
      
      if (!instances || instances.length === 0) {
        console.log('✅ [CLEANUP] Nenhuma instância encontrada no banco');
        return { cleaned: 0, errors: [] };
      }
      
      console.log(`🔍 [CLEANUP] Verificando ${instances.length} instâncias...`);
      
      for (const instance of instances) {
        try {
          // Verificar se a instância existe no servidor
          const result = await unifiedYumerService.getInstance(instance.instance_id);
          
          if (!result.success) {
            console.log(`🗑️ [CLEANUP] Removendo instância órfã: ${instance.instance_id}`);
            
            // Remover do banco
            const { error: deleteError } = await supabase
              .from('whatsapp_instances')
              .delete()
              .eq('instance_id', instance.instance_id);
              
            if (deleteError) {
              errors.push(`Erro ao remover ${instance.instance_id}: ${deleteError.message}`);
            } else {
              cleaned++;
              
              // Atualizar contador do cliente
              if (instance.client_id) {
                await this.updateClientInstanceCount(instance.client_id);
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ [CLEANUP] Erro ao verificar ${instance.instance_id}:`, error);
          errors.push(`Erro ao verificar ${instance.instance_id}: ${error.message}`);
        }
      }
      
      console.log(`✅ [CLEANUP] Limpeza concluída: ${cleaned} instâncias removidas`);
      return { cleaned, errors };
      
    } catch (error: any) {
      console.error('❌ [CLEANUP] Erro geral na limpeza:', error);
      return { cleaned: 0, errors: [error.message] };
    }
  }
  
  /**
   * Remove webhooks órfãos do servidor (que apontam para URLs antigas)
   */
  async cleanupOrphanedWebhooks(): Promise<{ cleaned: number; errors: string[] }> {
    console.log('🧹 [WEBHOOK-CLEANUP] Iniciando limpeza de webhooks órfãos...');
    
    let cleaned = 0;
    const errors: string[] = [];
    
    try {
      // Buscar todas as instâncias do banco
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id');
        
      if (error || !instances) {
        return { cleaned: 0, errors: ['Erro ao buscar instâncias'] };
      }
      
      for (const instance of instances) {
        try {
          const webhooksResult = await unifiedYumerService.getWebhookConfig(instance.instance_id);
          
          if (webhooksResult.success && webhooksResult.data) {
            const webhooks = Array.isArray(webhooksResult.data) ? webhooksResult.data : [webhooksResult.data];
            
            for (const webhook of webhooks) {
              // Se o webhook aponta para URL antiga (webhook.site), remover
              if (webhook.url && webhook.url.includes('webhook.site')) {
                console.log(`🗑️ [WEBHOOK-CLEANUP] Removendo webhook órfão: ${webhook.url}`);
                
                // Reconfigurar webhook com URL correta
                const reConfigResult = await unifiedYumerService.configureWebhook(instance.instance_id);
                if (reConfigResult.success) {
                  cleaned++;
                } else {
                  errors.push(`Erro ao reconfigurar webhook ${instance.instance_id}: ${reConfigResult.error}`);
                }
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ [WEBHOOK-CLEANUP] Erro ao verificar webhooks de ${instance.instance_id}:`, error);
          errors.push(`Erro ao verificar webhooks de ${instance.instance_id}: ${error.message}`);
        }
      }
      
      console.log(`✅ [WEBHOOK-CLEANUP] Limpeza concluída: ${cleaned} webhooks reconfigurados`);
      return { cleaned, errors };
      
    } catch (error: any) {
      console.error('❌ [WEBHOOK-CLEANUP] Erro geral na limpeza:', error);
      return { cleaned: 0, errors: [error.message] };
    }
  }
  
  /**
   * Atualiza o contador de instâncias do cliente
   */
  private async updateClientInstanceCount(clientId: string): Promise<void> {
    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('client_id', clientId);
        
      const count = instances?.length || 0;
      
      await supabase
        .from('clients')
        .update({ current_instances: count })
        .eq('id', clientId);
        
    } catch (error) {
      console.error('❌ [CLEANUP] Erro ao atualizar contador do cliente:', error);
    }
  }
}

export const cleanupInstancesService = new CleanupInstancesService();