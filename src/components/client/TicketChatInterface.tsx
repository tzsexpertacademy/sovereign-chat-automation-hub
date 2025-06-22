import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, AlertCircle, Users } from 'lucide-react';
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';
import { queuesService } from '@/services/queuesService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const [queueInfo, setQueueInfo] = useState<any>(null);
  const [connectedInstance, setConnectedInstance] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading } = useTicketMessages(ticketId);
  const { toast } = useToast();

  // Carregar dados do ticket e verificar instância conectada
  useEffect(() => {
    const loadTicketData = async () => {
      try {
        console.log('🎫 Carregando dados do ticket:', ticketId);
        
        // Carregar dados do ticket
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

        // Carregar informações da fila se estiver atribuída
        if (ticketData.assigned_queue_id) {
          try {
            const queues = await queuesService.getClientQueues(clientId);
            const assignedQueue = queues.find(q => q.id === ticketData.assigned_queue_id);
            if (assignedQueue) {
              setQueueInfo(assignedQueue);
              console.log('📋 Fila encontrada:', assignedQueue.name);
            }
          } catch (error) {
            console.error('❌ Erro ao carregar informações da fila:', error);
          }
        }

        // Verificar instâncias conectadas do cliente
        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, phone_number, status')
          .eq('client_id', clientId)
          .eq('status', 'connected');

        if (error) {
          console.error('❌ Erro ao buscar instâncias:', error);
          return;
        }

        console.log('📱 Instâncias encontradas:', instances);

        if (instances && instances.length > 0) {
          // Preferir a instância específica do ticket, ou usar a primeira conectada
          const preferredInstance = instances.find(i => i.instance_id === ticketData.instance_id) || instances[0];
          setConnectedInstance(preferredInstance.instance_id);
          
          console.log('📱 Instância selecionada para envio:', {
            instanceId: preferredInstance.instance_id,
            phoneNumber: preferredInstance.phone_number,
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

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket || !connectedInstance || isSending) {
      if (!connectedInstance) {
        toast({
          title: "Erro",
          description: "Nenhuma instância WhatsApp conectada",
          variant: "destructive"
        });
      }
      return;
    }

    try {
      setIsSending(true);
      console.log('📤 Enviando mensagem:', {
        instanceId: connectedInstance,
        chatId: ticket.chat_id,
        message: newMessage.substring(0, 50) + '...',
        customerPhone: ticket.customer?.phone
      });

      // Enviar mensagem via WhatsApp
      const response = await whatsappService.sendMessage(
        connectedInstance,
        ticket.chat_id,
        newMessage
      );

      console.log('📡 Resposta do envio:', response);

      if (response.success) {
        console.log('✅ Mensagem enviada com sucesso via WhatsApp');

        // Registrar mensagem no ticket
        console.log('💾 Salvando mensagem manual no ticket:', {
          ticketId,
          content: newMessage.substring(0, 50)
        });
        
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: 'Atendente',
          content: newMessage,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('💾 Mensagem manual registrada no ticket');
        setNewMessage('');
        
        toast({
          title: "Sucesso",
          description: "Mensagem enviada com sucesso"
        });
      } else {
        console.error('❌ Erro ao enviar mensagem via WhatsApp:', response.error);
        toast({
          title: "Erro",
          description: response.error || "Erro ao enviar mensagem",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessageContent = (message: any) => {
    let content = message.content;
    
    // Detectar links e torná-los clicáveis
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part: string, index: number) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Informações da fila ativa */}
      {queueInfo && (
        <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-blue-800">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">Fila Ativa: {queueInfo.name}</span>
          {queueInfo.assistants && (
            <Badge variant="secondary" className="text-xs">
              🤖 {queueInfo.assistants.name}
            </Badge>
          )}
        </div>
      )}

      {/* Status da conexão */}
      {!connectedInstance && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2 text-yellow-800">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Nenhuma instância WhatsApp conectada. As mensagens não poderão ser enviadas.</span>
        </div>
      )}

      {connectedInstance && (
        <div className="p-2 bg-green-50 border-b border-green-200 flex items-center gap-2 text-green-800">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs">Conectado via: {connectedInstance}</span>
        </div>
      )}

      {/* Área de mensagens */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>Nenhuma mensagem nesta conversa</p>
              <p className="text-sm">Inicie uma conversa enviando uma mensagem</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.from_me ? 'justify-end' : 'justify-start'}`}
              >
                {!message.from_me && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback>
                      {message.is_ai_response ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-[70%] ${message.from_me ? 'order-1' : 'order-2'}`}>
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      message.from_me
                        ? 'bg-blue-500 text-white'
                        : message.is_ai_response
                        ? 'bg-green-100 text-green-900 border border-green-200'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {!message.from_me && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium">
                          {message.sender_name}
                        </span>
                        {message.is_ai_response && (
                          <Bot className="w-3 h-3" />
                        )}
                      </div>
                    )}
                    
                    <div className="text-sm break-words whitespace-pre-wrap">
                      {renderMessageContent(message)}
                    </div>
                  </div>
                  
                  <div
                    className={`text-xs text-gray-500 mt-1 ${
                      message.from_me ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                    {message.is_ai_response && (
                      <span className="ml-1 text-green-600">• IA</span>
                    )}
                  </div>
                </div>
                
                {message.from_me && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Campo de entrada */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              connectedInstance 
                ? "Digite sua mensagem..." 
                : "Conecte uma instância WhatsApp para enviar mensagens"
            }
            disabled={!connectedInstance || isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !connectedInstance || isSending}
            size="sm"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TicketChatInterface;
