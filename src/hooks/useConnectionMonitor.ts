
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService, WhatsAppInstanceData } from '@/services/whatsappInstancesService';

export const useConnectionMonitor = (clientId: string) => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Função simplificada apenas para buscar instâncias do banco
  const loadInstances = useCallback(async () => {
    if (!clientId) return;
    
    try {
      console.log('🔍 Carregando instâncias do banco...');
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
      console.log(`✅ ${instancesData.length} instâncias carregadas`);
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
    }
  }, [clientId]);

  // Verificação manual de status (apenas quando solicitado)
  const checkInstanceStatus = useCallback(async (instance: WhatsAppInstanceData) => {
    try {
      console.log(`🔍 Verificando status da instância: ${instance.instance_id}`);
      
      const serverStatus = await whatsappService.getClientStatus(instance.instance_id);
      
      console.log(`📊 Status do servidor: ${serverStatus.status}, Status local: ${instance.status}`);
      
      // Atualizar apenas se houver diferença significativa
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
      return instance;
    }
  }, []);

  // Monitoramento manual (apenas quando o usuário solicita)
  const monitorInstances = useCallback(async () => {
    if (!clientId || isMonitoring) return;
    
    try {
      setIsMonitoring(true);
      console.log('🔍 Verificação manual de status das instâncias...');
      
      // Buscar instâncias atuais do banco
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      // Verificar status apenas para instâncias que não estão conectadas
      const statusChecks = await Promise.allSettled(
        instancesData.map(instance => {
          if (instance.status === 'connected') {
            return Promise.resolve(instance);
          }
          return checkInstanceStatus(instance);
        })
      );
      
      const updatedInstances = statusChecks
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`Erro ao verificar instância ${instancesData[index].instance_id}:`, result.reason);
            return instancesData[index];
          }
        });
      
      setInstances(updatedInstances);
      console.log(`✅ Verificação manual concluída - ${updatedInstances.length} instâncias`);
      
    } catch (error) {
      console.error('❌ Erro no monitoramento manual:', error);
    } finally {
      setIsMonitoring(false);
    }
  }, [clientId, isMonitoring, checkInstanceStatus]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      await whatsappService.disconnectClient(instanceId);
      
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'disconnected',
          has_qr_code: false,
          qr_code: null,
          updated_at: new Date().toISOString()
        });
      }
      
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
      
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'connecting',
          has_qr_code: false,
          qr_code: null,
          updated_at: new Date().toISOString()
        });
        
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
      
      await whatsappService.connectClient(instanceId);
      
      // Verificar resultado após um delay maior
      setTimeout(async () => {
        if (instance) {
          try {
            const updatedInstance = await checkInstanceStatus(instance);
            setInstances(prev => prev.map(inst => 
              inst.instance_id === instanceId ? updatedInstance : inst
            ));
          } catch (error) {
            console.error('Erro ao verificar status após reconexão:', error);
          }
        }
      }, 10000); // 10 segundos
      
      console.log(`✅ Reconexão iniciada: ${instanceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao reconectar ${instanceId}:`, error);
      return false;
    }
  }, [instances, checkInstanceStatus]);

  // Carregar instâncias apenas uma vez ao montar
  useEffect(() => {
    if (!clientId) return;

    loadInstances();
  }, [clientId, loadInstances]);

  // Escutar mudanças em tempo real do Supabase (sem verificações externas)
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
          console.log('🔄 Mudança detectada na instância via realtime:', payload);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            setInstances(prev => prev.map(inst => 
              inst.id === payload.new.id ? payload.new as WhatsAppInstanceData : inst
            ));
          } else if (payload.eventType === 'INSERT' && payload.new) {
            setInstances(prev => [...prev, payload.new as WhatsAppInstanceData]);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setInstances(prev => prev.filter(inst => inst.id !== payload.old.id));
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
    monitorInstances, // Apenas verificação manual
    disconnectInstance,
    reconnectInstance,
    checkInstanceStatus,
    loadInstances // Função para recarregar do banco
  };
};
