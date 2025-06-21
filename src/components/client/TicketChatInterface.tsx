
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, RefreshCw, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { whatsappService } from "@/services/whatsappMultiClient";
import { useTicketMessages } from "@/hooks/useTicketMessages";
import { useMessageStatus } from "@/hooks/useMessageStatus";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import MessageStatus from './MessageStatus';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const { toast } = useToast();
  
  const [selectedTicket, setSelectedTicket] = useState<ConversationTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Hooks para tempo real
  const { messages: ticketMessages, isLoading: loadingMessages } = useTicketMessages(ticketId || null);
  const { getMessageStatus, updateMessageStatus, markMessageAsRead, markMessageAsFailed } = useMessageStatus();
  const { isTyping, startTyping, stopTyping } = useTypingStatus();

  // Mount ref para evitar atualizações desnecessárias
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto scroll para última mensagem
  const scrollToBottom = useCallback(() => {
    if (mountedRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages, scrollToBottom]);

  // Buscar ticket específico apenas quando necessário
  useEffect(() => {
    if (ticketId && mountedRef.current) {
      loadTicketDetails();
    }
  }, [ticketId]);

  const loadTicketDetails = async () => {
    try {
      const ticket = await ticketsService.getTicketById(ticketId);
      if (mountedRef.current) {
        setSelectedTicket(ticket);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do ticket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !clientId) return;

    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('📤 Enviando mensagem:', newMessage);
      
      // Marcar como enviando
      updateMessageStatus(tempMessageId, 'sending');
      
      // Parar indicador de digitação
      stopTyping();
      
      await whatsappService.sendMessage(clientId, selectedTicket.chat_id, newMessage);
      
      // Marcar como enviada
      updateMessageStatus(tempMessageId, 'sent');
      
      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: selectedTicket.id,
        message_id: tempMessageId,
        from_me: true,
        sender_name: "Operador",
        content: newMessage,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'sent',
        timestamp: new Date().toISOString()
      });

      setNewMessage("");
      
      // Simular entrega após 2 segundos
      setTimeout(() => {
        updateMessageStatus(tempMessageId, 'delivered');
        console.log('📦 Mensagem marcada como entregue');
      }, 2000);
      
      // Simular leitura após 5 segundos
      setTimeout(() => {
        markMessageAsRead(tempMessageId);
        console.log('👁️ Mensagem marcada como lida (V azul)');
      }, 5000);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    } catch (error: any) {
      updateMessageStatus(tempMessageId, 'failed');
      stopTyping();
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDisplayName = (ticket: ConversationTicket) => {
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          nameFromTitle !== ticket.customer?.phone) {
        return nameFromTitle;
      }
    }
    
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        return formattedPhone;
      }
    }
    
    return 'Contato sem nome';
  };

  return (
    <div className="flex-1 flex flex-col">
      {selectedTicket ? (
        <>
          {/* Área de Mensagens */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {loadingMessages ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Carregando mensagens...</p>
                </div>
              ) : ticketMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Inicie a conversa enviando uma mensagem
                  </p>
                </div>
              ) : (
                ticketMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-md px-4 py-2 rounded-lg ${
                      message.from_me
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}>
                      {!message.from_me && message.sender_name && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {message.sender_name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      
                      {/* Status da mensagem - só aparece para mensagens enviadas por mim */}
                      {message.from_me && (
                        <MessageStatus 
                          status={getMessageStatus(message.message_id)}
                          timestamp={message.timestamp}
                          fromMe={message.from_me}
                        />
                      )}
                      
                      {message.is_ai_response && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-xs">
                            🤖 IA
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input de Mensagem */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (e.target.value.trim() && !isTyping) {
                    startTyping();
                  } else if (!e.target.value.trim() && isTyping) {
                    stopTyping();
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
                onBlur={() => {
                  // Delay para não parar digitação imediatamente
                  setTimeout(() => stopTyping(), 1000);
                }}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim()} 
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Indicador de digitação do usuário */}
            {isTyping && (
              <div className="mt-2 text-xs text-gray-500">
                Digitando...
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Carregando conversa...</h3>
            <p className="text-sm">Aguarde enquanto carregamos as mensagens</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketChatInterface;
