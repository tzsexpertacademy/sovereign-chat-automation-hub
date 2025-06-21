
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquare, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import TicketChatInterface from './TicketChatInterface';
import { useTicketRealtime } from '@/hooks/useTicketRealtime';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatInterface = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceProps) => {
  const [selectedChat, setSelectedChat] = useState<ConversationTicket | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { chatId } = useParams();

  // Hook para tempo real com assistente integrado
  const {
    tickets,
    isLoading: ticketsLoading,
    isTyping: assistantTyping,
    isOnline: assistantOnline,
    reloadTickets
  } = useTicketRealtime(clientId);

  const currentChatId = chatId || selectedChatId;

  useEffect(() => {
    if (currentChatId && tickets.length > 0) {
      const chat = tickets.find(ticket => ticket.id === currentChatId);
      setSelectedChat(chat || null);
    } else if (!currentChatId) {
      setSelectedChat(null);
    }
  }, [currentChatId, tickets]);

  const handleSelectChat = useCallback((ticketId: string) => {
    onSelectChat(ticketId);
    navigate(`/client/${clientId}/chat/${ticketId}`);
  }, [onSelectChat, navigate, clientId]);

  // Importar conversas do WhatsApp
  const handleImportConversations = async () => {
    try {
      setIsImporting(true);
      
      toast({
        title: "Importando conversas",
        description: "Aguarde enquanto importamos suas conversas do WhatsApp..."
      });

      const result = await ticketsService.importConversationsFromWhatsApp(clientId);
      
      toast({
        title: "Importação concluída",
        description: `${result.success} conversas importadas com sucesso. ${result.errors > 0 ? `${result.errors} erros encontrados.` : ''}`
      });

      // Recarregar tickets após importação
      setTimeout(() => {
        reloadTickets();
      }, 2000);

    } catch (error: any) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: error.message || "Falha ao importar conversas",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getDisplayName = useCallback((ticket: ConversationTicket) => {
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
  }, []);

  return (
    <div className="flex h-full bg-white">
      {/* Lista de Chats */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Conversas</h2>
            <div className="flex items-center space-x-2">
              {assistantOnline && (
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">Online</span>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={reloadTickets}
                disabled={ticketsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${ticketsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Botão de importação */}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleImportConversations}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Importar Conversas
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {ticketsLoading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando conversas...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm mb-2">Nenhuma conversa encontrada</p>
              <p className="text-xs text-gray-400 mb-3">
                Importe suas conversas do WhatsApp ou aguarde novas mensagens
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tickets.map((chat) => (
                <li
                  key={chat.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    currentChatId === chat.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(chat)}`} />
                          <AvatarFallback className="text-xs">
                            {getDisplayName(chat).substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getDisplayName(chat)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {chat.last_message_preview?.substring(0, 40) || 'Nenhuma mensagem'}
                            {chat.last_message_preview && chat.last_message_preview.length > 40 && '...'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                      <span className="text-xs text-gray-500">
                        {new Date(chat.last_message_at).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {chat.status === 'open' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {currentChatId ? (
          <>
            {/* Cabeçalho do Chat */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedChat ? getDisplayName(selectedChat) : ''}`} />
                    <AvatarFallback>
                      {selectedChat ? getDisplayName(selectedChat).substring(0, 2).toUpperCase() : 'UN'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedChat ? getDisplayName(selectedChat) : 'Chat'}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{selectedChat?.customer?.phone}</span>
                      {assistantOnline && (
                        <>
                          <span>•</span>
                          <div className="flex items-center space-x-1 text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>Assistente Online</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interface de Chat do Ticket */}
            <div className="flex-1 flex flex-col">
              <TicketChatInterface 
                clientId={clientId} 
                ticketId={currentChatId} 
              />
              
              {/* Indicador de Digitação do Assistente */}
              {assistantTyping && (
                <div className="px-4 py-2 bg-gray-50 border-t">
                  <TypingIndicator 
                    isTyping={true}
                    isRecording={false}
                    userName="🤖 Assistente IA"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma conversa</h3>
              <p className="text-gray-600 mb-4">
                Escolha uma conversa da lista para começar a responder mensagens
              </p>
              {assistantOnline && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-green-600">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">🤖 Assistente Online - Pronto para Atender</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
