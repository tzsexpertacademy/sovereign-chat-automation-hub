
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquare } from "lucide-react";
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

interface ChatData {
  id: string;
  name: string;
  lastMessage: string;
  unreadCount: number;
}

const ChatInterface = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceProps) => {
  const [chats, setChats] = useState<ChatData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ConversationTicket | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    tickets,
    isLoading: ticketsLoading,
    isTyping: assistantTyping,
    isOnline: assistantOnline,
    reloadTickets
  } = useTicketRealtime(clientId);

  useEffect(() => {
    if (selectedChatId) {
      const chat = tickets.find(ticket => ticket.id === selectedChatId);
      setSelectedChat(chat || null);
    } else {
      setSelectedChat(null);
    }
  }, [selectedChatId, tickets]);

  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    navigate(`/client/${clientId}/chat/${chatId}`);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Lista de Chats */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Conversas</h2>
            <div className="flex items-center space-x-2">
              {assistantOnline && (
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs">Online</span>
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {ticketsLoading ? (
            <div className="p-4 text-center text-gray-500">
              Carregando conversas...
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tickets.map((chat) => (
                <li
                  key={chat.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedChatId === chat.id ? 'bg-gray-100' : ''}`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${chat.customer?.name || 'User'}`} />
                          <AvatarFallback>
                            {chat.customer?.name?.substring(0, 2).toUpperCase() || 'UN'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-gray-900">{chat.customer?.name || 'Usuário Desconhecido'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {chat.last_message_preview?.substring(0, 50) || 'Nenhuma mensagem'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Simulando unread messages baseado no status */}
                    {chat.status === 'open' && (
                      <div className="ml-2">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          1
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <>
            {/* Cabeçalho do Chat */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedChat?.customer?.name || 'User'}`} />
                    <AvatarFallback>
                      {selectedChat?.customer?.name?.substring(0, 2).toUpperCase() || 'UN'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedChat?.customer?.name || 'Chat'}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{selectedChat?.customer?.phone}</span>
                      {assistantOnline && (
                        <>
                          <span>•</span>
                          <div className="flex items-center space-x-1 text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span>Online</span>
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
                ticketId={selectedChatId} 
              />
              
              {/* Indicador de Digitação com Status Online */}
              <TypingIndicator 
                isTyping={assistantTyping}
                isOnline={assistantOnline}
                userName="Assistente IA"
                showOnlineStatus={true}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma conversa</h3>
              <p className="text-gray-600">
                Escolha uma conversa da lista para começar a responder mensagens
              </p>
              {assistantOnline && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-green-600">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Sistema Online - Pronto para Atender</span>
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
