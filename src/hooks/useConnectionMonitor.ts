
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService, WhatsAppInstanceData } from '@/services/whatsappInstancesService';

export const useConnectionMonitor = (clientId: string) => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const checkInstanceStatus = useCallback(async (instance: WhatsAppInstanceData) => {
    try {
      console.log(`🔍 Verificando status da instância: ${instance.instance_id}`);
      
      // Verificar status real no servidor WhatsApp
      const serverStatus = await whatsappService.getClientStatus(instance.instance_id);
      console.log(`📊 Status do servidor: ${serverStatus.status}, Status local: ${instance.status}`);
      
      // Se o status for diferente, atualizar no banco
      if (serverStatus.status !== instance.status) {
        console.log(`🔄 Atualizando status de ${instance.status} para ${serverStatus.status}`);
        
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: serverStatus.status,
          phone_number: serverStatus.phoneNumber || instance.phone_number,
          has_qr_code: !!serverStatus.qrCode,
          qr_code: serverStatus.qrCode || null
        });
        
        return {
          ...instance,
          status: serverStatus.status,
          phone_number: serverStatus.phoneNumber || instance.phone_number,
          has_qr_code: !!serverStatus.qrCode,
          qr_code: serverStatus.qrCode || null
        };
      }
      
      return instance;
    } catch (error) {
      console.error(`❌ Erro ao verificar instância ${instance.instance_id}:`, error);
      
      // Se não conseguir conectar com o servidor, marcar como desconectado
      if (instance.status !== 'disconnected') {
        console.log(`📴 Marcando instância como desconectada: ${instance.instance_id}`);
        
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null
        });
        
        return {
          ...instance,
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null
        };
      }
      
      return instance;
    }
  }, []);

  const monitorInstances = useCallback(async () => {
    if (!clientId || isMonitoring) return;
    
    try {
      setIsMonitoring(true);
      console.log('🔍 Iniciando monitoramento de instâncias...');
      
      // Buscar instâncias do cliente
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      // Verificar status de cada instância
      const updatedInstances = await Promise.all(
        instancesData.map(instance => checkInstanceStatus(instance))
      );
      
      setInstances(updatedInstances);
      console.log(`✅ Monitoramento concluído - ${updatedInstances.length} instâncias verificadas`);
      
    } catch (error) {
      console.error('❌ Erro no monitoramento:', error);
    } finally {
      setIsMonitoring(false);
    }
  }, [clientId, isMonitoring, checkInstanceStatus]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      // Desconectar no servidor WhatsApp
      await whatsappService.disconnectClient(instanceId);
      
      // Atualizar status no banco
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null
        });
      }
      
      // Atualizar estado local
      setInstances(prev => prev.map(inst => 
        inst.instance_id === instanceId 
          ? { ...inst, status: 'disconnected', has_qr_code: false, qr_code: null }
          : inst
      ));
      
      console.log(`✅ Instância desconectada: ${instanceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao desconectar ${instanceId}:`, error);
      return false;
    }
  }, [instances]);

  const reconnectInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 Reconectando instância: ${instanceId}`);
      
      // Atualizar status para "connecting"
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'connecting',
          has_qr_code: false,
          qr_code: null
        });
      }
      
      // Conectar no servidor WhatsApp
      await whatsappService.connectClient(instanceId);
      
      // Aguardar um pouco e verificar status
      setTimeout(() => {
        checkInstanceStatus(instance!);
      }, 3000);
      
      console.log(`✅ Reconexão iniciada: ${instanceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao reconectar ${instanceId}:`, error);
      return false;
    }
  }, [instances, checkInstanceStatus]);

  // Monitoramento automático a cada 30 segundos
  useEffect(() => {
    if (!clientId) return;

    // Monitoramento inicial
    monitorInstances();

    // Monitoramento periódico
    const interval = setInterval(monitorInstances, 30000);

    return () => clearInterval(interval);
  }, [clientId, monitorInstances]);

  // Escutar mudanças em tempo real
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel('whatsapp_instances_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('🔄 Mudança detectada na instância:', payload);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            setInstances(prev => prev.map(inst => 
              inst.id === payload.new.id ? payload.new as WhatsAppInstanceData : inst
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  return {
    instances,
    isMonitoring,
    monitorInstances,
    disconnectInstance,
    reconnectInstance,
    checkInstanceStatus
  };
};
