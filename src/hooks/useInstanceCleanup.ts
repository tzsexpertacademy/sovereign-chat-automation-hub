import { useEffect } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';

/**
 * Hook para limpeza automática de instâncias órfãs e inconsistentes
 */
export const useInstanceCleanup = () => {
  
  const cleanupOrphanedInstances = async () => {
    try {
      console.log('🧹 [CLEANUP] Iniciando limpeza de instâncias órfãs...');
      
      // Buscar todas as instâncias do banco
      const clients = await fetch('/api/clients').then(r => r.json()).catch(() => []);
      const allInstances = [];
      
      for (const client of clients) {
        const instances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...instances);
      }
      
      console.log(`🔍 [CLEANUP] Encontradas ${allInstances.length} instâncias no banco`);
      
      let cleanedCount = 0;
      
      for (const instance of allInstances) {
        try {
          // Verificar se a instância ainda existe no servidor
          const status = await codechatQRService.getInstanceStatus(instance.instance_id);
          
          // Se retornou erro 404, a instância não existe mais no servidor
          if (!status) {
            console.log(`🗑️ [CLEANUP] Removendo instância órfã: ${instance.instance_id}`);
            await whatsappInstancesService.deleteInstance(instance.instance_id);
            cleanedCount++;
          }
          
        } catch (error) {
          if (error.message?.includes('404')) {
            console.log(`🗑️ [CLEANUP] Removendo instância não encontrada: ${instance.instance_id}`);
            await whatsappInstancesService.deleteInstance(instance.instance_id);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ [CLEANUP] Limpeza concluída: ${cleanedCount} instâncias órfãs removidas`);
      } else {
        console.log(`✅ [CLEANUP] Nenhuma instância órfã encontrada`);
      }
      
    } catch (error) {
      console.error('❌ [CLEANUP] Erro na limpeza:', error);
    }
  };
  
  useEffect(() => {
    // Executar limpeza na inicialização
    cleanupOrphanedInstances();
    
    // Executar limpeza a cada 10 minutos
    const interval = setInterval(cleanupOrphanedInstances, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { cleanupOrphanedInstances };
};