
import { useState, useEffect } from 'react';
import { ticketsService } from '@/services/ticketsService';
import { queuesService } from '@/services/queuesService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
          .eq('client_id', clientId)
          .eq('status', 'connected');

        if (error) {
          console.error('❌ Erro ao buscar instâncias:', error);
          return;
        }

        console.log('📱 Instâncias encontradas:', instances);

        if (instances && instances.length > 0) {
          const preferredInstance = instances.find(i => i.instance_id === ticketData.instance_id) || instances[0];
          
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
            isPreferred: preferredInstance.instance_id === ticketData.instance_id
          });
        } else {
          console.log('⚠️ Nenhuma instância WhatsApp conectada');
          setConnectedInstance(null);
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
