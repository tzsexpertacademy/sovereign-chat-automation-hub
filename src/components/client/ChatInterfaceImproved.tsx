
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, MessageSquare, Download, Bot, User, Wifi, Tag, RotateCw, Clock, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { queuesService } from "@/services/queuesService";
import { yumerMessageSyncService } from "@/services/yumerMessageSyncService";
import TicketChatInterface from './TicketChatInterface';
import TicketActionsMenu from './TicketActionsMenu';
import ChatHeaderImproved from './chat/ChatHeaderImproved';
import { useTicketRealtimeImproved } from '@/hooks/useTicketRealtimeImproved';
import { useRealtimeSidebar } from '@/hooks/useRealtimeSidebar';
import { useWhatsAppMessageSync } from '@/hooks/useWhatsAppMessageSync';
import TypingIndicator from './TypingIndicator';
import AdvancedToolsPanel from './AdvancedToolsPanel';
import { supabase } from '@/integrations/supabase/client';
import { databaseResetService } from '@/services/databaseResetService';

interface ChatInterfaceImprovedProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatInterfaceImproved = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceImprovedProps) => {
  const [selectedChat, setSelectedChat] = useState<ConversationTicket | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
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

  // 📡 SIDEBAR EM TEMPO REAL
  const [sidebarTickets, setSidebarTickets] = useState(tickets);
  
  const handleTicketUpdate = useCallback((updatedTicket: any) => {
    setSidebarTickets(prev => 
      prev.map(ticket => 
        ticket.id === updatedTicket.id 
          ? { ...ticket, ...updatedTicket }
          : ticket
      )
    );
  }, []);

  const handleNewMessage = useCallback((ticketId: string, preview: string) => {
    setSidebarTickets(prev => 
      prev.map(ticket => 
        ticket.id === ticketId 
          ? { 
              ...ticket, 
              last_message_preview: preview,
              last_message_at: new Date().toISOString()
            }
          : ticket
      )
    );
  }, []);

  useRealtimeSidebar({
    clientId,
    onTicketUpdate: handleTicketUpdate,
    onNewMessage: handleNewMessage
  });

  // 🚀 SINCRONIZAÇÃO AUTOMÁTICA WhatsApp → Tickets
  useWhatsAppMessageSync({
    clientId,
    onMessageProcessed: (messageId) => {
      console.log('✅ [WA-SYNC] Mensagem processada:', messageId);
      // Forçar reload dos tickets para pegar novas mensagens
      reloadTickets();
    }
  });

  // Sincronizar sidebar com tickets principais
  useEffect(() => {
    setSidebarTickets(tickets);
  }, [tickets]);

  // Estado para armazenar informações das filas
  const [queuesMap, setQueuesMap] = useState<Map<string, any>>(new Map());

  // Carregar informações das filas para os badges
  useEffect(() => {
    const loadQueuesInfo = async () => {
      try {
        const queues = await queuesService.getClientQueues(clientId);
        const newQueuesMap = new Map();
        
        for (const queue of queues) {
          newQueuesMap.set(queue.id, queue);
        }
        
        setQueuesMap(newQueuesMap);
      } catch (error) {
        console.error('❌ Erro ao carregar filas:', error);
      }
    };

    if (clientId) {
      loadQueuesInfo();
    }
  }, [clientId]);

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
    if (currentChatId && sidebarTickets.length > 0) {
      const chat = sidebarTickets.find(ticket => ticket.id === currentChatId);
      setSelectedChat(chat || null);
    } else if (!currentChatId) {
      setSelectedChat(null);
    }
  }, [currentChatId, sidebarTickets, markTicketAsRead]);

  const handleSelectChat = useCallback((ticketId: string) => {
    onSelectChat(ticketId);
    navigate(`/client/${clientId}/chat/${ticketId}`);
  }, [onSelectChat, navigate, clientId]);

  // Importar conversas reais da API v2.2.1
  const handleConvertYumerMessages = async () => {
    try {
      setIsConverting(true);
      toast({
        title: "Importação iniciada",
        description: "Importando conversas reais da API v2.2.1...",
      });

      // Buscar instância conectada
      const { data: connectedInstance } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .single();

      if (!connectedInstance) {
        throw new Error('Nenhuma instância conectada encontrada');
      }

      // Importar conversas reais usando o novo serviço
      const { conversationImportService } = await import('@/services/conversationImportService');
      const result = await conversationImportService.syncRealConversations(
        clientId, 
        connectedInstance.instance_id
      );

      if (result.success) {
        reloadTickets();
        toast({
          title: "Importação concluída",
          description: `${result.imported} conversas reais importadas com sucesso!`,
          variant: "default",
        });
      } else {
        throw new Error(result.error || 'Erro na importação');
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na conversão",
        description: error.message || "Falha ao converter mensagens YUMER",
        variant: "destructive"
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Importar conversas do WhatsApp (legado)
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

  // Reset completo - apagar tudo e importar do zero
  const handleResetAndImport = async () => {
    try {
      setIsImporting(true);
      
      toast({
        title: "Iniciando reset completo",
        description: "Apagando todos os dados e importando do zero..."
      });

      // Reset completo usando o serviço existente
      const resetResult = await databaseResetService.resetClientData(clientId);
      
      if (!resetResult.success) {
        throw new Error(resetResult.error || 'Erro no reset dos dados');
      }

      // Importar conversas do zero após reset
      const result = await ticketsService.importConversationsFromWhatsApp(clientId);
      
      toast({
        title: "Reset completo concluído",
        description: `Dados apagados e ${result.success} conversas importadas com sucesso!`,
        variant: "default"
      });

      setTimeout(reloadTickets, 2000);

    } catch (error: any) {
      console.error('Erro no reset completo:', error);
      toast({
        title: "Erro no reset completo",
        description: error.message || "Falha ao executar reset",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getDisplayNameForTicket = useCallback((ticket: ConversationTicket) => {
    return getDisplayName(ticket.customer, ticket.customer?.phone);
  }, [getDisplayName]);

  // Renderizar badges do ticket
  const renderTicketBadges = (ticket: ConversationTicket) => {
    const badges = [];

    // Badge "Humano" - apenas se tiver atendimento humano assumido
    // (quando status = 'pending' e tem assigned_assistant_id ou similar)
    const isHumanTakeover = ticket.status === 'pending';
    
    if (isHumanTakeover) {
      badges.push(
        <Badge key="human" variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
          <User className="w-3 h-3 mr-1" />
          Humano
        </Badge>
      );
    }

    // Badge da fila - apenas se tiver fila atribuída E não estiver em atendimento humano
    if (ticket.assigned_queue_id && !isHumanTakeover) {
      const queueInfo = queuesMap.get(ticket.assigned_queue_id);
      const queueName = queueInfo?.name || 'Fila';
      
      badges.push(
        <Badge key="queue" variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Bot className="w-3 h-3 mr-1" />
          {queueName}
        </Badge>
      );
    }

    // Badge do assistente - apenas se tiver assistente ativo na fila E não estiver em atendimento humano
    if (ticket.assigned_assistant_id && !isHumanTakeover) {
      badges.push(
        <Badge key="assistant" variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
          <Bot className="w-3 h-3 mr-1" />
          Assistente
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
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {ticketsLoading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando conversas...
            </div>
          ) : sidebarTickets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm mb-2">Nenhuma conversa encontrada</p>
              <p className="text-xs text-gray-400 mb-3">
                Aguarde novas mensagens ou use as ferramentas de importação
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sidebarTickets.map((chat) => (
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

        {/* Painel de Ferramentas Avançadas */}
        <AdvancedToolsPanel
          clientId={clientId}
          isImporting={isImporting}
          isConverting={isConverting}
          onConvertYumerMessages={handleConvertYumerMessages}
          onImportConversations={handleImportConversations}
          onResetAndImport={handleResetAndImport}
        />
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {currentChatId ? (
          <>
            {/* Cabeçalho do Chat */}
            <ChatHeaderImproved 
              ticket={selectedChat}
              clientId={clientId}
              onTicketUpdate={reloadTickets}
            />

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
