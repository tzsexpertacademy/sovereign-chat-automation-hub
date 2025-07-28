import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAutoQueueConnection = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const connectInstanceToAvailableQueue = useCallback(async (instanceId: string, clientId: string) => {
    setIsConnecting(true);
    try {
      console.log('🔧 [AUTO-QUEUE] Iniciando conexão automática para instância:', instanceId);
      
      // 1. Buscar o UUID da instância
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, custom_name')
        .eq('instance_id', instanceId)
        .eq('client_id', clientId)
        .single();

      if (instanceError || !instance) {
        throw new Error('Instância não encontrada');
      }

      // 2. Verificar se já existe conexão (ativa ou inativa)
      const { data: existingConnection } = await supabase
        .from('instance_queue_connections')
        .select('id, queue_id, is_active')
        .eq('instance_id', instance.id)
        .maybeSingle();

      if (existingConnection?.is_active) {
        console.log('✅ [AUTO-QUEUE] Instância já conectada a uma fila');
        return { success: true, message: 'Instância já conectada' };
      }

      // 3. Buscar fila ativa com assistente ativo
      const { data: availableQueue, error: queueError } = await supabase
        .from('queues')
        .select(`
          id,
          name,
          assistants:assistant_id (
            id,
            name,
            is_active
          )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .not('assistant_id', 'is', null)
        .single();

      if (queueError || !availableQueue) {
        throw new Error('Nenhuma fila com assistente ativo encontrada');
      }

      if (!availableQueue.assistants?.is_active) {
        throw new Error('Assistente da fila não está ativo');
      }

      // 4. Reativar conexão existente ou criar nova
      if (existingConnection && !existingConnection.is_active) {
        console.log('🔄 [AUTO-QUEUE] Reativando conexão existente');
        const { error: updateError } = await supabase
          .from('instance_queue_connections')
          .update({
            queue_id: availableQueue.id,
            is_active: true
          })
          .eq('id', existingConnection.id);

        if (updateError) {
          throw new Error('Erro ao reativar conexão: ' + updateError.message);
        }
      } else {
        console.log('➕ [AUTO-QUEUE] Criando nova conexão');
        const { error: connectionError } = await supabase
          .from('instance_queue_connections')
          .insert({
            instance_id: instance.id,
            queue_id: availableQueue.id,
            is_active: true
          });

        if (connectionError) {
          throw new Error('Erro ao criar conexão: ' + connectionError.message);
        }
      }

      console.log(`✅ [AUTO-QUEUE] Instância ${instance.custom_name || instance.instance_id} conectada à fila ${availableQueue.name}`);
      
      toast({
        title: "Conexão Automática Realizada",
        description: `Instância conectada à fila "${availableQueue.name}" com assistente "${availableQueue.assistants.name}"`,
      });

      return { 
        success: true, 
        message: `Conectado à fila ${availableQueue.name}`,
        queueName: availableQueue.name,
        assistantName: availableQueue.assistants.name
      };

    } catch (error: any) {
      console.error('❌ [AUTO-QUEUE] Erro na conexão automática:', error);
      
      toast({
        title: "Erro na Conexão Automática",
        description: error.message,
        variant: "destructive",
      });

      return { success: false, error: error.message };
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const checkAndCreateAutoConnections = useCallback(async (clientId: string) => {
    try {
      console.log('🔍 [AUTO-QUEUE] Verificando instâncias desconectadas para cliente:', clientId);
      
      // Buscar instâncias sem conexão ativa (corrigindo query)
      const { data: disconnectedInstances, error } = await supabase
        .from('whatsapp_instances')
        .select(`
          id,
          instance_id,
          custom_name,
          status
        `)
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .filter('id', 'not.in', `(
          SELECT instance_id 
          FROM instance_queue_connections 
          WHERE is_active = true
        )`);

      if (error) {
        console.error('Erro ao buscar instâncias desconectadas:', error);
        return { success: false, error: error.message };
      }

      if (!disconnectedInstances || disconnectedInstances.length === 0) {
        console.log('ℹ️ [AUTO-QUEUE] Todas as instâncias já estão conectadas a filas');
        return { success: true, message: 'Todas as instâncias já conectadas' };
      }

      console.log(`🔧 [AUTO-QUEUE] Encontradas ${disconnectedInstances.length} instâncias para conectar automaticamente`);

      const results = [];
      for (const instance of disconnectedInstances) {
        const result = await connectInstanceToAvailableQueue(instance.instance_id, clientId);
        results.push({ ...result, instanceId: instance.instance_id });
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: successful > 0,
        message: `${successful} instâncias conectadas, ${failed} falharam`,
        results
      };

    } catch (error: any) {
      console.error('❌ [AUTO-QUEUE] Erro na verificação automática:', error);
      return { success: false, error: error.message };
    }
  }, [connectInstanceToAvailableQueue]);

  return {
    connectInstanceToAvailableQueue,
    checkAndCreateAutoConnections,
    isConnecting
  };
};