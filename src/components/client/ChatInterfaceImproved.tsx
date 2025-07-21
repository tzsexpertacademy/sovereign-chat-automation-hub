
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, MessageSquare, Download, Bot, User, Wifi, Tag, RotateCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import TicketChatInterface from './TicketChatInterface';
import TicketActionsMenu from './TicketActionsMenu';
import { useTicketRealtimeImproved } from '@/hooks/useTicketRealtimeImproved';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceImprovedProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatInterfaceImproved = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceImprovedProps) => {
  const [selectedChat, setSelectedChat] = useState<ConversationTicket | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { chatId } = useParams();

  // Hook melhorado para tempo real 
  const {
    tickets,
    isLoading: ticketsLoading,
    syncStatus,
    lastSyncTime,
    reloadTickets,
    forceSyncMessages
  } = useTicketRealtimeImproved(clientId);

  // Simulando funcionalidades das próximas fases
  const unreadTotal = 0;
  const markTicketAsRead = (id: string) => console.log('Mark as read:', id);
  const getDisplayName = (customer: any, phone?: string) => customer?.name || phone || 'Contato';

  const currentChatId = chatId || selectedChatId;

  useEffect(() => {
    if (currentChatId && tickets.length > 0) {
      const chat = tickets.find(ticket => ticket.id === currentChatId);
      setSelectedChat(chat || null);
      
      // Marcar como lido quando selecionar (simulado)
      // if (chat && chat.has_unread) {
      //   markTicketAsRead(chat.id);
      // }
    } else if (!currentChatId) {
      setSelectedChat(null);
    }
  }, [currentChatId, tickets, markTicketAsRead]);

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

  const getDisplayNameForTicket = useCallback((ticket: ConversationTicket) => {
    // Usar função melhorada do hook
    return getDisplayName(ticket.customer, ticket.customer?.phone);
  }, [getDisplayName]);

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

  // Renderizar status de sincronização
  const renderSyncStatus = () => {
    const getStatusColor = () => {
      switch (syncStatus) {
        case 'syncing': return 'text-blue-600';
        case 'success': return 'text-green-600';
        case 'error': return 'text-red-600';
        default: return 'text-gray-600';
      }
    };

    const getStatusIcon = () => {
      switch (syncStatus) {
        case 'syncing': return <RefreshCw className="w-3 h-3 animate-spin" />;
        case 'success': return <RotateCw className="w-3 h-3" />;
        case 'error': return <RefreshCw className="w-3 h-3" />;
        default: return <Clock className="w-3 h-3" />;
      }
    };

    const getStatusText = () => {
      switch (syncStatus) {
        case 'syncing': return 'Sincronizando...';
        case 'success': return lastSyncTime ? `Última sinc: ${lastSyncTime.toLocaleTimeString()}` : 'Sincronizado';
        case 'error': return 'Erro na sincronização';
        default: return 'Aguardando';
      }
    };

    return (
      <div className={`flex items-center space-x-1 text-xs ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white">
      {/* Lista de Chats */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-gray-900">Conversas</h2>
              {unreadTotal > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                  {unreadTotal}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={reloadTickets}
                disabled={ticketsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${ticketsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={forceSyncMessages}
                disabled={syncStatus === 'syncing'}
                title="Forçar sincronização de mensagens"
              >
                <RotateCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Status de sincronização */}
          <div className="mb-3">
            {renderSyncStatus()}
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
              <Button
                size="sm"
                variant="outline"
                onClick={forceSyncMessages}
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Sincronizar Mensagens
                  </>
                )}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tickets.map((chat) => (
                <li
                  key={chat.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors relative ${
                    currentChatId === chat.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayNameForTicket(chat)}`} />
                          <AvatarFallback className="text-xs">
                            {getDisplayNameForTicket(chat).substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getDisplayNameForTicket(chat)}
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
                      {/* Placeholder para contador de não lidas */}
                      {false && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                          0
                        </span>
                      )}
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
      <div className="flex-1 flex flex-col h-full min-w-0">
        {currentChatId ? (
          <>
            {/* Cabeçalho do Chat */}
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedChat ? getDisplayNameForTicket(selectedChat) : ''}`} />
                    <AvatarFallback>
                      {selectedChat ? getDisplayNameForTicket(selectedChat).substring(0, 2).toUpperCase() : 'UN'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {selectedChat ? getDisplayNameForTicket(selectedChat) : 'Chat'}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="truncate">{selectedChat?.customer?.phone}</span>
                      <span>•</span>
                      {renderSyncStatus()}
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
              <div className="mt-4">
                {renderSyncStatus()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterfaceImproved;
