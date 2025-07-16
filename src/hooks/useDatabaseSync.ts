import { useState, useEffect, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface SyncStatus {
  database_instances: number;
  server_instances: number;
  missing_in_server: string[];
  missing_in_database: string[];
  is_synchronized: boolean;
}

interface UseDatabaseSyncReturn {
  syncStatus: SyncStatus | null;
  loading: boolean;
  error: string | null;
  executeSync: () => Promise<boolean>;
  checkStatus: () => Promise<void>;
  lastCheck: Date | null;
}

export const useDatabaseSync = (): UseDatabaseSyncReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://yumer.yumerflow.app:8083/sync/status', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.sync_status) {
        setSyncStatus(data.sync_status);
        setLastCheck(new Date());
        console.log('📊 [SYNC-HOOK] Status atualizado:', data.sync_status);
      } else {
        throw new Error(data.error || 'Resposta inválida');
      }
    } catch (err: any) {
      console.error('❌ [SYNC-HOOK] Erro ao verificar status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const executeSync = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 [SYNC-HOOK] Executando sincronização...');
      
      const response = await fetch('https://yumer.yumerflow.app:8083/sync/database', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [SYNC-HOOK] Sincronização executada com sucesso');
        
        // Verificar status após sincronização
        await checkStatus();
        
        return true;
      } else {
        throw new Error(data.error || 'Falha na sincronização');
      }
    } catch (err: any) {
      console.error('❌ [SYNC-HOOK] Erro na sincronização:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [checkStatus]);

  // Verificar status inicialmente
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    syncStatus,
    loading,
    error,
    executeSync,
    checkStatus,
    lastCheck
  };
};