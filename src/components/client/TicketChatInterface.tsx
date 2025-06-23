
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { useMessageListener } from '@/hooks/useMessageListener';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Hooks para mensagens e processamento
  const { messages, isLoading } = useTicketMessages(ticketId);
  const { isProcessing } = useMessageListener(
    clientId,
    ticketId,
    ticket?.assigned_assistant_id
  );

  // Carregar dados do ticket
  useEffect(() => {
    if (ticketId) {
      loadTicketData();
    }
  }, [ticketId]);

  const loadTicketData = async () => {
    try {
      const ticketData = await ticketsService.getTicketById(ticketId);
      setTicket(ticketData);
      console.log('🎫 Ticket carregado:', {
        id: ticketData?.id,
        assistantId: ticketData?.assigned_assistant_id,
        chatId: ticketData?.chat_id
      });
    } catch (error) {
      console.error('❌ Erro ao carregar ticket:', error);
    }
  };

  // Auto scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractPhoneNumber = (chatId: string): string => {
    if (!chatId) return '';
    
    // Remover @c.us do final se existir
    const cleanId = chatId.replace('@c.us', '');
    
    // Validar se é um número válido (só dígitos)
    if (!/^\d+$/.test(cleanId)) {
      console.error('❌ Chat ID inválido:', chatId);
      return '';
    }
    
    return cleanId;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !ticket?.chat_id || isSending) return;

    const phoneNumber = extractPhoneNumber(ticket.chat_id);
    if (!phoneNumber) {
      toast({
        title: "Erro",
        description: "Número de telefone inválido",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSending(true);
      console.log('📤 Enviando mensagem:', {
        to: phoneNumber,
        message: newMessage.substring(0, 50)
      });

      // Enviar via WhatsApp
      const success = await whatsappService.sendMessage(clientId, phoneNumber, newMessage);
      
      if (success) {
        console.log('✅ Mensagem enviada com sucesso');
        
        // Adicionar mensagem ao ticket
        await ticketsService.addMessageToTicket(ticketId, {
          message_id: `manual_${Date.now()}`,
          content: newMessage,
          message_type: 'text',
          from_me: true,
          is_ai_response: false,
          timestamp: new Date().toISOString(),
          sender_name: 'Operador'
        });

        setNewMessage('');
        toast({
          title: "Sucesso",
          description: "Mensagem enviada"
        });
      } else {
        throw new Error('Falha ao enviar mensagem');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Área de mensagens */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.from_me
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                  {message.is_ai_response && ' • IA'}
                </p>
              </div>
            </div>
          ))}
          
          {/* Indicador de processamento */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-sm">Assistente está processando...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input de mensagem */}
      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isSending}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TicketChatInterface;
