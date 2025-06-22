import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, MessageSquare, Download, Bot, User, Wifi, Tag, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import TicketChatInterface from './TicketChatInterface';
import TicketActionsMenu from './TicketActionsMenu';
import ContactsManager from './ContactsManager';
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
  const [activeTab, setActiveTab] = useState("conversations");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { chatId } = useParams();

  // Hook para tempo real
  const {
    tickets,
    isLoading: ticketsLoading,
    isTyping: assistantTyping,
    isOnline: assistentOnline,
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
    setActiveTab("conversations");
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

      setTimeout(reloadTickets, 2000);

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
        !ticket.customer.name.startsWith('Contato ') &&
        !ticket.customer.name.match(/^\(\d+\)/)) {
      return ticket.customer.name;
    }
    
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          !nameFromTitle.match(/^\(\d+\)/) &&
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

  // Renderizar badges do ticket
  const renderTicketBadges = (ticket: ConversationTicket) => {
    const badges = [];

    // Status da conexão
    if (ticket.instance_id) {
      badges.push(
        <Badge key="connection" variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          <Wifi className="w-3 h-3 mr-1" />
          Conectado
        </Badge>
      );
    }

    // Status do atendimento
    const isHumanAssigned = ticket.status === 'pending' || 
                           ticket.status === 'resolved' ||
                           ticket.status === 'closed';

    // Mostrar fila ativa
    if (ticket.assigned_queue_id && !isHumanAssigned) {
      const queueName = ticket.assigned_queue_name || 'Fila Ativa';
      badges.push(
        <Badge key="queue" variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Bot className="w-3 h-3 mr-1" />
          {queueName}
        </Badge>
      );
    }

    // Atendimento humano
    if (isHumanAssigned) {
      badges.push(
        <Badge key="human" variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
          <User className="w-3 h-3 mr-1" />
          Humano
        </Badge>
      );
    }

    // Tags se houver
    if (ticket.tags && ticket.tags.length > 0) {
      badges.push(
        <Badge key="tags" variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
          <Tag className="w-3 h-3 mr-1" />
          {ticket.tags.length} tag{ticket.tags.length > 1 ? 's' : ''}
        </Badge>
      );
    }

    return badges;
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white">
      {/* Painel Esquerdo com Tabs */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-2 m-2">
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contatos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="flex-1 flex flex-col m-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Conversas Ativas</h2>
                <div className="flex items-center space-x-2">
                  {assistentOnline && (
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

            {/* Lista de conversas */}
            <div className="flex-1 overflow-y-auto min-h-0">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(chat)}`} />
                              <AvatarFallback className="text-xs">
                                {getDisplayName(chat).substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {getDisplayName(chat)}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {chat.last_message_preview?.substring(0, 35) || 'Nenhuma mensagem'}
                                {chat.last_message_preview && chat.last_message_preview.length > 35 && '...'}
                              </p>
                              
                              <div className="flex flex-wrap gap-1 mt-1">
                                {renderTicketBadges(chat)}
                              </div>
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
          </TabsContent>

          <TabsContent value="contacts" className="flex-1 m-0 overflow-hidden">
            <div className="h-full p-4 overflow-y-auto">
              <ContactsManager clientId={clientId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {currentChatId && activeTab === "conversations" ? (
          <>
            {/* Cabeçalho do Chat */}
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedChat ? getDisplayName(selectedChat) : ''}`} />
                    <AvatarFallback>
                      {selectedChat ? getDisplayName(selectedChat).substring(0, 2).toUpperCase() : 'UN'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {selectedChat ? getDisplayName(selectedChat) : 'Chat'}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="truncate">{selectedChat?.customer?.phone}</span>
                      {assistentOnline && (
                        <>
                          <span>•</span>
                          <div className="flex items-center space-x-1 text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="whitespace-nowrap">Assistente Online</span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {selectedChat && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {renderTicketBadges(selectedChat)}
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedChat && (
                  <div className="flex-shrink-0 ml-4">
                    <TicketActionsMenu 
                      ticket={selectedChat} 
                      onTicketUpdate={reloadTickets}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Interface de Chat */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TicketChatInterface 
                clientId={clientId} 
                ticketId={currentChatId} 
              />
              
              {assistantTyping && (
                <div className="px-4 py-2 bg-gray-50 border-t flex-shrink-0">
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
              {activeTab === "conversations" ? (
                <>
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma conversa</h3>
                  <p className="text-gray-600 mb-4">
                    Escolha uma conversa da lista para começar a responder mensagens
                  </p>
                  {assistentOnline && (
                    <div className="mt-4 flex items-center justify-center space-x-2 text-green-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">🤖 Assistente Online - Pronto para Atender</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Gerenciamento de Contatos</h3>
                  <p className="text-gray-600">
                    Gerencie seus contatos, adicione novos e importe listas
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
