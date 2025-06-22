
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
      
      // Verificar status real no servidor WhatsApp com timeout mais longo
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Aumentar timeout
      
      const serverStatus = await Promise.race([
        whatsappService.getClientStatus(instance.instance_id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na verificação de status')), 15000)
        )
      ]) as any;
      
      clearTimeout(timeoutId);
      
      console.log(`📊 Status do servidor: ${serverStatus.status}, Status local: ${instance.status}`);
      
      // Só atualizar se o status for realmente diferente E não for uma conexão ativa
      if (serverStatus.status !== instance.status && instance.status !== 'connected') {
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
      
      // NÃO marcar como desconectado automaticamente para evitar interferência
      return instance;
    }
  }, []);

  // Remover auto-reconexão automática - só fazer quando solicitado
  const monitorInstances = useCallback(async () => {
    if (!clientId || isMonitoring) return;
    
    try {
      setIsMonitoring(true);
      console.log('🔍 Verificação de status das instâncias...');
      
      // Buscar instâncias do cliente
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      // Verificar status com menos agressividade
      const statusChecks = await Promise.allSettled(
        instancesData.map(instance => {
          // Só verificar instâncias que não estão conectadas
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
      console.log(`✅ Verificação concluída - ${updatedInstances.length} instâncias`);
      
      // Configurar listeners apenas para instâncias conectadas (sem interferir)
      updatedInstances.forEach(instance => {
        if (instance.status === 'connected') {
          try {
            const socket = whatsappService.connectSocket();
            if (socket && socket.connected) {
              whatsappService.joinClientRoom(instance.instance_id);
              
              whatsappService.onClientMessage(instance.instance_id, (message) => {
                console.log(`📨 Nova mensagem na instância ${instance.instance_id}`);
              });
            }
          } catch (error) {
            console.error(`❌ Erro ao configurar listener para ${instance.instance_id}:`, error);
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erro no monitoramento:', error);
    } finally {
      setIsMonitoring(false);
    }
  }, [clientId, isMonitoring, checkInstanceStatus]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      // Parar tentativas de reconexão
      setReconnectAttempts(prev => ({
        ...prev,
        [instanceId]: 0
      }));
      
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
      
      setReconnectAttempts(prev => ({
        ...prev,
        [instanceId]: 0
      }));
      
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
      
      // Verificar resultado após delay
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
      }, 8000); // Aumentar delay
      
      console.log(`✅ Reconexão iniciada: ${instanceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao reconectar ${instanceId}:`, error);
      return false;
    }
  }, [instances, checkInstanceStatus]);

  // Monitoramento menos frequente - apenas quando solicitado
  useEffect(() => {
    if (!clientId) return;

    // Carregar inicialmente
    monitorInstances();

    // Monitoramento muito menos frequente para não interferir
    const interval = setInterval(monitorInstances, 60000); // A cada 1 minuto apenas

    return () => clearInterval(interval);
  }, [clientId, monitorInstances]);

  // Escutar mudanças em tempo real (menos intrusivo)
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
