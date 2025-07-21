
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, MessageSquare, Download, Bot, User, Wifi, Tag, RotateCw, Clock, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { conversationImportService } from "@/services/conversationImportService";
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

  // Log de debug melhorado
  useEffect(() => {
    console.log('🔄 [CHAT-INTERFACE] Iniciando ChatInterfaceImproved...', { 
      clientId, 
      selectedChatId, 
      currentChatId: chatId 
    });
  }, [clientId, selectedChatId, chatId]);

  // Hook melhorado para tempo real 
  const {
    tickets,
    isLoading: ticketsLoading,
    syncStatus,
    lastSyncTime,
    reloadTickets,
    forceSyncMessages
  } = useTicketRealtimeImproved(clientId);

  // Debug de tickets carregados
  useEffect(() => {
    console.log('📊 [CHAT-INTERFACE] Tickets atualizados:', {
      count: tickets.length,
      tickets: tickets.slice(0, 3).map(t => ({
        id: t.id,
        title: t.title,
        customerName: t.customer?.name,
        lastMessage: t.last_message_preview?.substring(0, 50)
      }))
    });
  }, [tickets]);

  // Simulando funcionalidades das próximas fases
  const unreadTotal = 0;
  const markTicketAsRead = (id: string) => console.log('Mark as read:', id);
  const getDisplayName = (customer: any, phone?: string) => customer?.name || phone || 'Contato';

  const currentChatId = chatId || selectedChatId;

  useEffect(() => {
    if (currentChatId && tickets.length > 0) {
      const chat = tickets.find(ticket => ticket.id === currentChatId);
      setSelectedChat(chat || null);
      
      console.log('📋 [CHAT-INTERFACE] Chat selecionado:', {
        chatId: currentChatId,
        found: !!chat,
        chatTitle: chat?.title
      });
    } else if (!currentChatId) {
      setSelectedChat(null);
    }
  }, [currentChatId, tickets, markTicketAsRead]);

  const handleSelectChat = useCallback((ticketId: string) => {
    onSelectChat(ticketId);
    navigate(`/client/${clientId}/chat/${ticketId}`);
  }, [onSelectChat, navigate, clientId]);

  // Importar conversas usando o novo serviço
  const handleImportConversations = async () => {
    try {
      setIsImporting(true);
      
      toast({
        title: "Importando conversas",
        description: "Aguarde enquanto importamos suas conversas do WhatsApp..."
      });

      const result = await conversationImportService.importConversationsFromWhatsApp(clientId);
      
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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  // Auto-refresh a cada 30 segundos para não sobrecarregar
  useEffect(() => {
    const interval = setInterval(() => {
      if (!ticketsLoading && !isImporting) {
        reloadTickets();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [ticketsLoading, isImporting, reloadTickets]);

  if (ticketsLoading && tickets.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conversas...</p>
          <p className="text-sm text-gray-500 mt-2">Sistema moderno ativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Lista de Conversas */}
      <div className="col-span-5 flex flex-col bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversas ({tickets.length})
                {(ticketsLoading || isImporting) && <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
              </h2>
              <p className="text-sm text-gray-600">Sistema moderno ativo - LOCAL FIRST</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={reloadTickets}
                disabled={ticketsLoading || isImporting}
              >
                <RefreshCw className={`w-4 h-4 ${ticketsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleImportConversations}
                disabled={isImporting}
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {isImporting ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isImporting && (
            <div className="p-4 bg-blue-50 border-b">
              <div className="flex items-center gap-2 text-blue-700">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Importando conversas...</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Usando dados locais + extração inteligente de nomes
              </p>
            </div>
          )}
          
          {tickets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>Nenhuma conversa encontrada</p>
              <p className="text-sm">
                {tickets.length === 0 
                  ? "Importe conversas do WhatsApp para começar"
                  : "Nenhuma conversa corresponde aos filtros"
                }
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleImportConversations}
                disabled={isImporting}
                className="mt-2"
              >
                {isImporting ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Download className="w-3 h-3 mr-1" />
                )}
                {isImporting ? 'Importando...' : 'Importar Conversas'}
              </Button>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleSelectChat(ticket.id)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedChat?.id === ticket.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                      {ticket.customer?.name?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate">
                        {ticket.customer?.name || ticket.title}
                      </h3>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {ticket.last_message_at ? formatTime(ticket.last_message_at) : 'Sem data'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate">
                      {ticket.last_message_preview || 'Sem mensagens'}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>{ticket.customer?.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ticket.assigned_assistant_id && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Bot className="w-3 h-3" />
                            <span>IA</span>
                          </div>
                        )}
                        {ticket.priority > 1 && (
                          <Badge variant="outline" className="text-xs">
                            P{ticket.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Interface de Chat */}
      <div className="col-span-7 flex flex-col bg-white rounded-lg border">
        {selectedChat ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Chat com {selectedChat.customer?.name || 'Contato'}</h2>
              <p className="text-sm text-gray-600">
                Sistema moderno ativo - Integração perfeita
              </p>
            </div>
            <div className="flex-1 p-4">
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Interface de chat em desenvolvimento</p>
                  <p className="text-sm">Em breve: visualização de mensagens, histórico e ações</p>
                  <p className="text-xs mt-2 text-green-600">
                    ✅ Sistema LOCAL FIRST funcionando - importação corrigida
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista para ver os detalhes</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Zap className="h-4 w-4" />
                  <span>Sistema moderno ativo</span>
                </div>
                <p className="text-xs text-gray-500">
                  Arquitetura LOCAL FIRST - Instâncias locais funcionando
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleImportConversations}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                    ) : (
                      <Download className="w-3 h-3 mr-1" />
                    )}
                    {isImporting ? 'Importando...' : 'Importar Conversas'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterfaceImproved;
