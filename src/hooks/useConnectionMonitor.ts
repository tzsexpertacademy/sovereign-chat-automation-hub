
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService, WhatsAppInstanceData } from '@/services/whatsappInstancesService';

export const useConnectionMonitor = (clientId: string) => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState<Record<string, number>>({});

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
          qr_code: serverStatus.qrCode || null,
          updated_at: new Date().toISOString()
        });
        
        return {
          ...instance,
          status: serverStatus.status,
          phone_number: serverStatus.phoneNumber || instance.phone_number,
          has_qr_code: !!serverStatus.qrCode,
          qr_code: serverStatus.qrCode || null,
          updated_at: new Date().toISOString()
        };
      }
      
      return instance;
    } catch (error) {
      console.error(`❌ Erro ao verificar instância ${instance.instance_id}:`, error);
      
      // Se não conseguir conectar com o servidor, marcar como desconectado
      if (instance.status !== 'disconnected') {
        console.log(`📴 Marcando instância como desconectada: ${instance.instance_id}`);
        
        try {
          await whatsappInstancesService.updateInstanceById(instance.id, {
            status: 'disconnected',
            has_qr_code: false,
            qr_code: null,
            updated_at: new Date().toISOString()
          });
        } catch (updateError) {
          console.error('Erro ao atualizar status para desconectado:', updateError);
        }
        
        return {
          ...instance,
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null,
          updated_at: new Date().toISOString()
        };
      }
      
      return instance;
    }
  }, []);

  const autoReconnectInstance = useCallback(async (instanceId: string) => {
    const attempts = reconnectAttempts[instanceId] || 0;
    const maxAttempts = 3;
    
    if (attempts >= maxAttempts) {
      console.log(`❌ Máximo de tentativas de reconexão atingido para ${instanceId}`);
      return false;
    }
    
    try {
      console.log(`🔄 Auto-reconexão tentativa ${attempts + 1}/${maxAttempts} para ${instanceId}`);
      
      // Incrementar contador de tentativas
      setReconnectAttempts(prev => ({
        ...prev,
        [instanceId]: attempts + 1
      }));
      
      // Tentar reconectar
      await whatsappService.connectClient(instanceId);
      
      // Aguardar um pouco e verificar se conectou
      setTimeout(async () => {
        try {
          const instance = instances.find(i => i.instance_id === instanceId);
          if (instance) {
            await checkInstanceStatus(instance);
          }
        } catch (error) {
          console.error('Erro ao verificar status após reconexão:', error);
        }
      }, 5000);
      
      return true;
    } catch (error) {
      console.error(`❌ Erro na auto-reconexão de ${instanceId}:`, error);
      
      // Tentar novamente após um tempo
      if (attempts < maxAttempts - 1) {
        setTimeout(() => {
          autoReconnectInstance(instanceId);
        }, 30000); // Tentar novamente em 30 segundos
      }
      
      return false;
    }
  }, [instances, reconnectAttempts, checkInstanceStatus]);

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
      
      // Verificar se há instâncias que precisam de reconexão automática
      const disconnectedInstances = updatedInstances.filter(i => 
        ['disconnected', 'error'].includes(i.status)
      );
      
      if (disconnectedInstances.length > 0) {
        console.log(`🔄 Detectadas ${disconnectedInstances.length} instâncias desconectadas`);
        
        // Tentar reconectar automaticamente após um pequeno delay
        setTimeout(() => {
          disconnectedInstances.forEach(instance => {
            const attempts = reconnectAttempts[instance.instance_id] || 0;
            if (attempts < 3) { // Máximo 3 tentativas
              autoReconnectInstance(instance.instance_id);
            }
          });
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Erro no monitoramento:', error);
    } finally {
      setIsMonitoring(false);
    }
  }, [clientId, isMonitoring, checkInstanceStatus, reconnectAttempts, autoReconnectInstance]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      // Resetar contador de tentativas
      setReconnectAttempts(prev => ({
        ...prev,
        [instanceId]: 0
      }));
      
      // Desconectar no servidor WhatsApp
      await whatsappService.disconnectClient(instanceId);
      
      // Atualizar status no banco
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null,
          updated_at: new Date().toISOString()
        });
      }
      
      // Atualizar estado local
      setInstances(prev => prev.map(inst => 
        inst.instance_id === instanceId 
          ? { 
              ...inst, 
              status: 'disconnected', 
              has_qr_code: false, 
              qr_code: null,
              updated_at: new Date().toISOString()
            }
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
      
      // Resetar contador de tentativas
      setReconnectAttempts(prev => ({
        ...prev,
        [instanceId]: 0
      }));
      
      // Atualizar status para "connecting"
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'connecting',
          has_qr_code: false,
          qr_code: null,
          updated_at: new Date().toISOString()
        });
        
        // Atualizar estado local imediatamente
        setInstances(prev => prev.map(inst => 
          inst.instance_id === instanceId 
            ? { 
                ...inst, 
                status: 'connecting', 
                has_qr_code: false, 
                qr_code: null,
                updated_at: new Date().toISOString()
              }
            : inst
        ));
      }
      
      // Conectar no servidor WhatsApp
      await whatsappService.connectClient(instanceId);
      
      // Aguardar um pouco e verificar status
      setTimeout(async () => {
        if (instance) {
          try {
            const updatedInstance = await checkInstanceStatus(instance);
            setInstances(prev => prev.map(inst => 
              inst.instance_id === instanceId ? updatedInstance : inst
            ));
          } catch (error) {
            console.error('Erro ao verificar status após reconexão manual:', error);
          }
        }
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

  // Resetar tentativas quando instância conecta com sucesso
  useEffect(() => {
    instances.forEach(instance => {
      if (instance.status === 'connected' && reconnectAttempts[instance.instance_id] > 0) {
        setReconnectAttempts(prev => ({
          ...prev,
          [instance.instance_id]: 0
        }));
      }
    });
  }, [instances, reconnectAttempts]);

  return {
    instances,
    isMonitoring,
    monitorInstances,
    disconnectInstance,
    reconnectInstance,
    checkInstanceStatus
  };
};
