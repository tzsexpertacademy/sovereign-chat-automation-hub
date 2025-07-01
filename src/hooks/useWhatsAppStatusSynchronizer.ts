
import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  instanceId: string;
  dbStatus: string;
  serverStatus: string;
  wasUpdated: boolean;
  phoneNumber?: string;
  error?: string;
}

export const useWhatsAppStatusSynchronizer = (clientId: string) => {
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const syncInstanceStatus = useCallback(async (instanceId: string): Promise<SyncResult> => {
    try {
      console.log(`🔄 [SYNC] Sincronizando ${instanceId}...`);

      // 1. Obter status do servidor
      const serverStatus = await whatsappService.getClientStatus(instanceId);
      
      // 2. Obter status do banco
      const dbInstance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
      
      if (!dbInstance) {
        console.warn(`⚠️ [SYNC] Instância ${instanceId} não encontrada no banco`);
        return {
          instanceId,
          dbStatus: 'not_found',
          serverStatus: serverStatus.status,
          wasUpdated: false,
          error: 'Instância não encontrada no banco'
        };
      }

      const result: SyncResult = {
        instanceId,
        dbStatus: dbInstance.status || 'unknown',
        serverStatus: serverStatus.status,
        wasUpdated: false,
        phoneNumber: serverStatus.phoneNumber
      };

      // 3. Verificar se precisa atualizar
      const needsUpdate = (
        dbInstance.status !== serverStatus.status ||
        dbInstance.phone_number !== serverStatus.phoneNumber ||
        dbInstance.has_qr_code !== (serverStatus.hasQrCode || false)
      );

      if (needsUpdate) {
        console.log(`📝 [SYNC] Atualizando banco: ${instanceId}`);
        console.log(`   Status: ${dbInstance.status} → ${serverStatus.status}`);
        console.log(`   Phone: ${dbInstance.phone_number} → ${serverStatus.phoneNumber}`);
        
        await whatsappInstancesService.updateInstance(instanceId, {
          status: serverStatus.status,
          phone_number: serverStatus.phoneNumber,
          has_qr_code: serverStatus.hasQrCode || false,
          qr_code: serverStatus.qrCode,
          updated_at: new Date().toISOString()
        });

        result.wasUpdated = true;
        console.log(`✅ [SYNC] Banco atualizado: ${instanceId}`);
      } else {
        console.log(`✅ [SYNC] Já sincronizado: ${instanceId}`);
      }

      return result;
    } catch (error: any) {
      console.error(`❌ [SYNC] Erro ao sincronizar ${instanceId}:`, error);
      return {
        instanceId,
        dbStatus: 'error',
        serverStatus: 'error',
        wasUpdated: false,
        error: error.message
      };
    }
  }, []);

  const syncAllInstances = useCallback(async () => {
    setIsSyncing(true);
    const results: SyncResult[] = [];

    try {
      console.log('🔄 [SYNC] Iniciando sincronização completa...');

      // 1. Obter instâncias do banco
      const dbInstances = await whatsappInstancesService.getInstancesByClientId(clientId);
      console.log(`📋 [SYNC] Encontradas ${dbInstances.length} instâncias no banco`);

      // 2. Obter instâncias do servidor
      const serverInstances = await whatsappService.getAllClients();
      console.log(`🖥️ [SYNC] Encontradas ${serverInstances.length} instâncias no servidor`);

      // 3. Sincronizar cada instância do banco
      for (const dbInstance of dbInstances) {
        const result = await syncInstanceStatus(dbInstance.instance_id);
        results.push(result);
      }

      // 4. Verificar instâncias órfãs no servidor
      for (const serverInstance of serverInstances) {
        const existsInDb = dbInstances.some(db => db.instance_id === serverInstance.clientId);
        if (!existsInDb) {
          console.log(`⚠️ [SYNC] Instância órfã no servidor: ${serverInstance.clientId}`);
          results.push({
            instanceId: serverInstance.clientId,
            dbStatus: 'not_in_db',
            serverStatus: serverInstance.status,
            wasUpdated: false,
            error: 'Instância existe no servidor mas não no banco'
          });
        }
      }

      setSyncResults(results);
      setLastSync(new Date());

      const updatedCount = results.filter(r => r.wasUpdated).length;
      const errorCount = results.filter(r => r.error).length;

      console.log(`✅ [SYNC] Sincronização concluída:`);
      console.log(`   • ${results.length} instâncias verificadas`);
      console.log(`   • ${updatedCount} atualizadas`);
      console.log(`   • ${errorCount} com erro`);

      if (updatedCount > 0) {
        toast({
          title: "Sincronização Concluída",
          description: `${updatedCount} instâncias foram atualizadas`,
        });
      }

      return results;
    } catch (error: any) {
      console.error('❌ [SYNC] Erro na sincronização:', error);
      toast({
        title: "Erro na Sincronização",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [clientId, syncInstanceStatus, toast]);

  // Auto-sincronização a cada 30 segundos
  useEffect(() => {
    if (!clientId) return;

    const interval = setInterval(() => {
      console.log('🔄 [SYNC] Auto-sincronização agendada');
      syncAllInstances().catch(console.error);
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [clientId, syncAllInstances]);

  return {
    syncInstanceStatus,
    syncAllInstances,
    syncResults,
    isSyncing,
    lastSync
  };
};
