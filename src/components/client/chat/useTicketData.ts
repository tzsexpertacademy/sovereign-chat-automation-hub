
import { useState, useEffect } from 'react';
import { ticketsService } from '@/services/ticketsService';
import { queuesService } from '@/services/queuesService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { onlineStatusManager } from '@/services/onlineStatusManager';

export const useTicketData = (ticketId: string, clientId: string) => {
  const [ticket, setTicket] = useState<any>(null);
  const [queueInfo, setQueueInfo] = useState<any>(null);
  const [connectedInstance, setConnectedInstance] = useState<string | null>(null);
  const [actualInstanceId, setActualInstanceId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadTicketData = async () => {
      try {
        console.log('🎫 Carregando dados do ticket:', ticketId);
        
        const ticketData = await ticketsService.getTicketById(ticketId);
        setTicket(ticketData);
        
        console.log('📋 Dados do ticket carregados:', {
          id: ticketData.id,
          chatId: ticketData.chat_id,
          customerName: ticketData.customer?.name,
          phone: ticketData.customer?.phone,
          instanceId: ticketData.instance_id,
          assignedQueueId: ticketData.assigned_queue_id
        });

        if (ticketData.assigned_queue_id) {
          try {
            const queues = await queuesService.getClientQueues(clientId);
            const assignedQueue = queues.find(q => q.id === ticketData.assigned_queue_id);
            if (assignedQueue) {
              // Buscar informações do assistente se houver
              let assistantName = null;
              if (assignedQueue.assistant_id) {
                const { data: assistant } = await supabase
                  .from('assistants')
                  .select('name')
                  .eq('id', assignedQueue.assistant_id)
                  .single();
                
                if (assistant) {
                  assistantName = assistant.name;
                }
              }
              
              setQueueInfo({
                ...assignedQueue,
                assistant_name: assistantName
              });
              console.log('📋 Fila encontrada:', assignedQueue.name, 'Assistente:', assistantName);
            }
          } catch (error) {
            console.error('❌ Erro ao carregar informações da fila:', error);
          }
        }

        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, phone_number, status, custom_name')
          .eq('client_id', clientId);

        if (error) {
          console.error('❌ Erro ao buscar instâncias:', error);
          return;
        }

        console.log('📱 Instâncias encontradas:', instances);

        if (instances && instances.length > 0) {
          // Priorizar instância do ticket, mesmo que não esteja 'connected'
          const preferredInstance = instances.find(i => i.instance_id === ticketData.instance_id) || 
                                   instances.find(i => i.status === 'connected') || 
                                   instances[0];
          
          // Criar nome amigável para exibição
          const displayName = preferredInstance.custom_name || 
                             (preferredInstance.phone_number ? `WhatsApp ${preferredInstance.phone_number}` : '') ||
                             preferredInstance.instance_id;
          
          setConnectedInstance(displayName);
          setActualInstanceId(preferredInstance.instance_id);
          
          console.log('📱 Instância selecionada para envio:', {
            instanceId: preferredInstance.instance_id,
            displayName: displayName,
            phoneNumber: preferredInstance.phone_number,
            customName: preferredInstance.custom_name,
            status: preferredInstance.status,
            isPreferred: preferredInstance.instance_id === ticketData.instance_id
          });

          // Configurar presença online para instância conectada
          if (preferredInstance.status === 'connected' && preferredInstance.instance_id) {
            console.log('🔵 [TICKET-DATA] Configurando presença online para instância conectada');
            onlineStatusManager.configureOnlinePresence(
              preferredInstance.instance_id, 
              clientId, 
              'auto-trigger'
            ).catch(error => {
              console.error('❌ Erro ao configurar presença:', error);
            });
          }
        } else {
          console.log('⚠️ Nenhuma instância WhatsApp encontrada');
          // Fallback: usar instance_id diretamente do ticket se não encontrou instância
          if (ticketData.instance_id) {
            console.log('🔄 Usando instance_id do ticket como fallback:', ticketData.instance_id);
            setConnectedInstance(`WhatsApp ${ticketData.instance_id}`);
            setActualInstanceId(ticketData.instance_id);
          } else {
            setConnectedInstance(null);
            setActualInstanceId(null);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao carregar dados do ticket:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados do ticket",
          variant: "destructive"
        });
      }
    };

    if (ticketId && clientId) {
      loadTicketData();
    }
  }, [ticketId, clientId, toast]);

  return { ticket, queueInfo, connectedInstance, actualInstanceId };
};
