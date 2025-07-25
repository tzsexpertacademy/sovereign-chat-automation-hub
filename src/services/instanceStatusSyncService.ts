/**
 * Serviço para sincronizar status real da instância WhatsApp
 * Corrige a dessincronia entre API Yumer e banco Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import yumerApiV2 from './yumerApiV2Service';
import unifiedYumerService from './unifiedYumerService';

export interface InstanceStatusInfo {
  instanceId: string;
  status: string;
  connectionState?: string;
  lastSync: Date;
  isConnected: boolean;
}

class InstanceStatusSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isManualSyncing = false;

  /**
   * Sincroniza status de uma instância específica com a API real
   */
  async syncInstanceStatus(instanceId: string, clientId?: string): Promise<InstanceStatusInfo | null> {
    try {
      console.log(`🔄 [STATUS-SYNC] Iniciando sync para instância: ${instanceId}`);

      // 1. Buscar status real da API Yumer
      const [connectionState, instanceInfo] = await Promise.allSettled([
        yumerApiV2.getConnectionState(instanceId),
        yumerApiV2.getInstance(instanceId)
      ]);

      let realStatus = 'unknown';
      let isConnected = false;

      // Processar resposta da conexão
      if (connectionState.status === 'fulfilled') {
        const state = connectionState.value;
        console.log('📊 [STATUS-SYNC] Connection state:', state);
        
        realStatus = state.state;
        isConnected = state.state === 'open';
      }

      // Processar informações da instância
      if (instanceInfo.status === 'fulfilled') {
        const info = instanceInfo.value;
        console.log('📋 [STATUS-SYNC] Instance info:', info);
        
        // Se a API retornar status, usar ele
        if (info.status) {
          realStatus = info.status;
          isConnected = info.status === 'open';
        }
      }

      // 2. Atualizar no Supabase se necessário
      const shouldUpdateDb = realStatus !== 'unknown';
      
      if (shouldUpdateDb) {
        const updateData: any = {
          status: realStatus,
          updated_at: new Date().toISOString()
        };

      // Se conectado, limpar QR code e configurar webhook
      if (isConnected) {
        updateData.has_qr_code = false;
        updateData.qr_code = null;
        updateData.qr_expires_at = null;
        updateData.webhook_enabled = true; // Marcar webhook como habilitado
        
        // Configurar webhook automaticamente
        try {
          console.log(`🔧 [STATUS-SYNC] Configurando webhook para instância conectada: ${instanceId}`);
          const webhookResult = await unifiedYumerService.ensureWebhookConfigured(instanceId);
          if (webhookResult.success) {
            console.log(`✅ [STATUS-SYNC] Webhook configurado automaticamente: ${instanceId}`);
          } else {
            console.warn(`⚠️ [STATUS-SYNC] Falha ao configurar webhook: ${instanceId}`, webhookResult.error);
          }
        } catch (webhookError) {
          console.error(`❌ [STATUS-SYNC] Erro ao configurar webhook: ${instanceId}`, webhookError);
        }
      }

      const { error } = await supabase
        .from('whatsapp_instances')
        .update(updateData)
        .eq('instance_id', instanceId);

      if (error) {
        console.error('❌ [STATUS-SYNC] Erro ao atualizar banco:', error);
      } else {
        console.log(`✅ [STATUS-SYNC] Status atualizado: ${instanceId} → ${realStatus}`);
      }

        // Atualizar também na tabela clients se necessário
        if (clientId && isConnected) {
          await supabase
            .from('clients')
            .update({ 
              instance_status: realStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', clientId);
        }
      }

      const statusInfo: InstanceStatusInfo = {
        instanceId,
        status: realStatus,
        connectionState: connectionState.status === 'fulfilled' ? connectionState.value.state : undefined,
        lastSync: new Date(),
        isConnected
      };

      console.log(`📊 [STATUS-SYNC] Sync completo:`, statusInfo);
      return statusInfo;

    } catch (error) {
      console.error('❌ [STATUS-SYNC] Erro no sync:', error);
      return null;
    }
  }

  /**
   * Monitora mudanças de status continuamente
   */
  startContinuousSync(instanceId: string, clientId?: string, intervalMs = 5000): void {
    // Limpar sync anterior se existir
    this.stopContinuousSync(instanceId);

    console.log(`🔄 [STATUS-SYNC] Iniciando monitoramento contínuo: ${instanceId}`);

    // Sync inicial imediato
    this.syncInstanceStatus(instanceId, clientId);

    // Sync periódico
    const interval = setInterval(async () => {
      const statusInfo = await this.syncInstanceStatus(instanceId, clientId);
      
      // Se estiver conectado, reduzir frequência
      if (statusInfo?.isConnected) {
        console.log('✅ [STATUS-SYNC] Instância conectada, reduzindo frequência');
        this.stopContinuousSync(instanceId);
        
        // Fazer sync final mais espaçado para confirmar
        setTimeout(() => {
          this.syncInstanceStatus(instanceId, clientId);
        }, 15000);
      }
    }, intervalMs);

    this.syncIntervals.set(instanceId, interval);

    // Auto cleanup após 2 minutos
    setTimeout(() => {
      this.stopContinuousSync(instanceId);
    }, 120000);
  }

  /**
   * Para o monitoramento contínuo
   */
  stopContinuousSync(instanceId: string): void {
    const interval = this.syncIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(instanceId);
      console.log(`🛑 [STATUS-SYNC] Parando monitoramento: ${instanceId}`);
    }
  }

  /**
   * Sync manual com feedback visual
   */
  async performManualSync(instanceId: string, clientId?: string): Promise<InstanceStatusInfo | null> {
    if (this.isManualSyncing) {
      console.log('⚠️ [STATUS-SYNC] Sync manual já em progresso');
      return null;
    }

    this.isManualSyncing = true;
    
    try {
      console.log('🔄 [STATUS-SYNC] Executando sync manual...');
      const result = await this.syncInstanceStatus(instanceId, clientId);
      
      // Se não conectou ainda, iniciar monitoramento
      if (result && !result.isConnected) {
        this.startContinuousSync(instanceId, clientId, 3000);
      }
      
      return result;
    } finally {
      this.isManualSyncing = false;
    }
  }

  /**
   * Verifica se uma instância está realmente conectada
   */
  async isInstanceConnected(instanceId: string): Promise<boolean> {
    try {
      const connectionState = await yumerApiV2.getConnectionState(instanceId);
      return connectionState.state === 'open';
    } catch (error) {
      console.error('❌ [STATUS-SYNC] Erro ao verificar conexão:', error);
      return false;
    }
  }

  /**
   * Cleanup de todos os syncs
   */
  cleanup(): void {
    console.log('🧹 [STATUS-SYNC] Limpando todos os syncs');
    this.syncIntervals.forEach((interval, instanceId) => {
      this.stopContinuousSync(instanceId);
    });
  }
}

// Export singleton
export const instanceStatusSyncService = new InstanceStatusSyncService();
export default instanceStatusSyncService;