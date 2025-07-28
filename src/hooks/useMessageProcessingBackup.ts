/**
 * Hook para sistema de backup de processamento de mensagens
 * PARTE 3: Implementar sistema de backup
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { unprocessedMessageProcessor } from '@/services/unprocessedMessageProcessor';

interface BackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxAge: number; // Idade máxima em minutos para considerar mensagem "perdida"
  batchSize: number;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalMinutes: 5, // Verificar a cada 5 minutos
  maxAge: 10, // Mensagens com mais de 10 minutos são consideradas perdidas
  batchSize: 20 // Processar até 20 mensagens por vez
};

export const useMessageProcessingBackup = (clientId: string, config: Partial<BackupConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheck = useRef<Date>(new Date());
  const isRunning = useRef<boolean>(false);

  /**
   * Verificar e processar mensagens "perdidas"
   */
  const checkAndProcessLostMessages = useCallback(async () => {
    if (isRunning.current || !finalConfig.enabled) {
      return;
    }

    isRunning.current = true;

    try {
      console.log('🔍 [BACKUP] Verificando mensagens perdidas...');

      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (!instances || instances.length === 0) {
        console.log('ℹ️ [BACKUP] Nenhuma instância conectada');
        return;
      }

      const instanceIds = instances.map(i => i.instance_id);
      const cutoffTime = new Date(Date.now() - finalConfig.maxAge * 60 * 1000);

      // Buscar mensagens não processadas antigas
      const { data: lostMessages } = await supabase
        .from('whatsapp_messages')
        .select('id, message_id, chat_id, created_at')
        .eq('is_processed', false)
        .eq('from_me', false)
        .in('instance_id', instanceIds)
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true })
        .limit(finalConfig.batchSize);

      if (!lostMessages || lostMessages.length === 0) {
        console.log('✅ [BACKUP] Nenhuma mensagem perdida encontrada');
        lastCheck.current = new Date();
        return;
      }

      console.log(`⚠️ [BACKUP] ${lostMessages.length} mensagens perdidas encontradas`);

      // Processar mensagens perdidas
      const result = await unprocessedMessageProcessor.processUnprocessedMessages(clientId);
      
      console.log('✅ [BACKUP] Processamento de backup concluído:', {
        found: lostMessages.length,
        processed: result.processed,
        errors: result.errors
      });

      lastCheck.current = new Date();

      // Enviar alerta se muitas mensagens foram perdidas
      if (lostMessages.length > 10) {
        console.warn(`🚨 [BACKUP] ALERTA: ${lostMessages.length} mensagens perdidas processadas!`);
        
        // Aqui você poderia enviar uma notificação para o cliente
        // Por exemplo: toast, email, webhook, etc.
      }

    } catch (error) {
      console.error('❌ [BACKUP] Erro na verificação de backup:', error);
    } finally {
      isRunning.current = false;
    }
  }, [clientId, finalConfig]);

  /**
   * Iniciar sistema de backup
   */
  const startBackupSystem = useCallback(() => {
    if (!finalConfig.enabled || intervalRef.current) {
      return;
    }

    console.log('🚀 [BACKUP] Sistema de backup iniciado:', {
      interval: `${finalConfig.intervalMinutes} minutos`,
      maxAge: `${finalConfig.maxAge} minutos`,
      batchSize: finalConfig.batchSize
    });

    // Verificação inicial
    checkAndProcessLostMessages();

    // Configurar intervalo
    intervalRef.current = setInterval(
      checkAndProcessLostMessages,
      finalConfig.intervalMinutes * 60 * 1000
    );
  }, [finalConfig, checkAndProcessLostMessages]);

  /**
   * Parar sistema de backup
   */
  const stopBackupSystem = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('⏹️ [BACKUP] Sistema de backup parado');
    }
  }, []);

  /**
   * Verificação manual
   */
  const runManualCheck = useCallback(async () => {
    console.log('🔧 [BACKUP] Verificação manual iniciada');
    await checkAndProcessLostMessages();
  }, [checkAndProcessLostMessages]);

  /**
   * Configurar listener para novas mensagens suspeitas
   */
  useEffect(() => {
    if (!finalConfig.enabled || !clientId) return;

    // Listener para detectar mensagens que ficaram muito tempo sem processar
    const suspiciousMessageCheck = setInterval(async () => {
      try {
        const recentTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutos atrás
        
        const { data: recentUnprocessed } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('is_processed', false)
          .eq('from_me', false)
          .lt('created_at', recentTime.toISOString())
          .limit(1);

        if (recentUnprocessed && recentUnprocessed.length > 0) {
          console.log('🔍 [BACKUP] Mensagens suspeitas detectadas, executando verificação...');
          await checkAndProcessLostMessages();
        }

      } catch (error) {
        console.error('❌ [BACKUP] Erro na verificação de mensagens suspeitas:', error);
      }
    }, 2 * 60 * 1000); // Verificar a cada 2 minutos

    return () => clearInterval(suspiciousMessageCheck);
  }, [clientId, finalConfig.enabled, checkAndProcessLostMessages]);

  // Inicializar e limpar
  useEffect(() => {
    if (clientId && finalConfig.enabled) {
      startBackupSystem();
    }

    return () => {
      stopBackupSystem();
    };
  }, [clientId, finalConfig.enabled, startBackupSystem, stopBackupSystem]);

  return {
    isEnabled: finalConfig.enabled,
    isRunning: isRunning.current,
    lastCheck: lastCheck.current,
    config: finalConfig,
    
    // Actions
    startBackupSystem,
    stopBackupSystem,
    runManualCheck
  };
};