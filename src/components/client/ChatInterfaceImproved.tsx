
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
import { useTicketRealtimeSync } from '@/hooks/useTicketRealtimeSync';
import TypingIndicator from './TypingIndicator';
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

  const handleStatusChange = useCallback((ticketId: string, oldStatus: string, newStatus: string) => {
    console.log('🔄 [CHAT-INTERFACE] Status do ticket alterado:', { ticketId, oldStatus, newStatus });
    
    // Atualizar ticket na sidebar
    setSidebarTickets(prev => 
      prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: newStatus }
          : ticket
      )
    );
    
    // Se o ticket foi fechado, mostrar toast
    if (newStatus === 'closed' && oldStatus !== 'closed') {
      toast({
        title: "Ticket fechado",
        description: "O ticket foi fechado automaticamente",
      });
    }
  }, [toast]);

  useRealtimeSidebar({
    clientId,
    onTicketUpdate: handleTicketUpdate,
    onNewMessage: handleNewMessage,
    onStatusChange: handleStatusChange
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

  // 🎯 SINCRONIZAÇÃO ESPECÍFICA PARA DETECÇÃO DE MUDANÇAS
  useTicketRealtimeSync({
    clientId,
    onTicketUpdate: () => {
      console.log('🔄 [CHAT-INTERFACE] Forçando reload por mudança detectada');
      reloadTickets();
    },
    onTicketReopen: (ticketId, newQueueId) => {
      console.log('🔓 [CHAT-INTERFACE] Ticket reaberto:', { ticketId, newQueueId });
      // Atualizar estado local imediatamente
      setSidebarTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId 
            ? { 
                ...ticket, 
                status: 'open',
                assigned_queue_id: newQueueId
              }
            : ticket
        )
      );
      reloadTickets();
    },
    onQueueTransfer: (ticketId, fromQueueId, toQueueId) => {
      console.log('🔄 [CHAT-INTERFACE] Transferência de fila:', { ticketId, fromQueueId, toQueueId });
      // Atualizar estado local imediatamente
      setSidebarTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, assigned_queue_id: toQueueId }
            : ticket
        )
      );
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
    const isHumanTakeover = ticket.status === 'pending';
    
    if (isHumanTakeover) {
      badges.push(
        <Badge key="human" variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/20 transition-colors">
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
        <Badge key="queue" variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
          <Bot className="w-3 h-3 mr-1" />
          {queueName}
        </Badge>
      );
    }

    // Badge do assistente - apenas se tiver assistente ativo na fila E não estiver em atendimento humano
    if (ticket.assigned_assistant_id && !isHumanTakeover) {
      badges.push(
        <Badge key="assistant" variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/20 hover:bg-purple-500/20 transition-colors">
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-background">
      {/* Lista de Chats - Design dashboard */}
      <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-border flex flex-col h-[40vh] lg:h-full max-h-[40vh] lg:max-h-none bg-card">
        <div className="p-4 border-b border-border bg-gradient-to-r from-background to-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Conversas</h2>
                {unreadTotal > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {unreadTotal} não lidas
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={reloadTickets}
                disabled={ticketsLoading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-3 h-3 ${ticketsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={forceSyncMessages}
                disabled={syncStatus === 'syncing'}
                title="Sincronizar mensagens"
                className="h-8 w-8 p-0"
              >
                <RotateCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Status simplificado */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Wifi className="h-3 w-3 mr-1" />
              Online
            </Badge>
            {renderSyncStatus()}
          </div>
        </div>

        {/* Lista de conversas - limpa */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {ticketsLoading ? (
            <div className="p-3 text-center text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
              <span className="text-xs">Carregando...</span>
            </div>
          ) : sidebarTickets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-1">Nenhuma conversa</p>
              <p className="text-xs opacity-70">
                Aguardando mensagens...
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sidebarTickets.map((chat) => (
                 <div
                  key={chat.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-all duration-150 relative ${
                    currentChatId === chat.id 
                      ? 'bg-primary/5 border-r-2 border-primary' 
                      : ''
                  }`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayNameForTicket(chat)}`} />
                          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                            {getDisplayNameForTicket(chat).substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {getDisplayNameForTicket(chat)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(chat.last_message_at).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {chat.status === 'open' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>

      </div>

      {/* Área de Chat - Responsivo */}
      <div className="flex-1 flex flex-col h-[60vh] lg:h-full min-w-0">
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
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/20 to-background">
            <div className="text-center p-8 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
              <MessageSquare className="w-16 h-16 text-muted-foreground/60 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Selecione uma conversa</h3>
              <p className="text-muted-foreground mb-4">
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
