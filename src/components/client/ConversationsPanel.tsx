
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useTicketRealtimeImproved } from '@/hooks/useTicketRealtimeImproved';
import { realTimeMessageSyncService } from '@/services/realTimeMessageSync';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Search, RefreshCw, Wifi, WifiOff, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationsPanelProps {
  clientId: string;
}

const ConversationsPanel = ({ clientId }: ConversationsPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    tickets,
    isLoading,
    syncStatus,
    lastSyncTime,
    reloadTickets,
    forceSyncMessages
  } = useTicketRealtimeImproved(clientId);

  // Inicializar tempo real na primeira vez
  React.useEffect(() => {
    const initializeRealTime = async () => {
      if (isInitializing) return;
      
      setIsInitializing(true);
      try {
        // Buscar instâncias do cliente
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('client_id', clientId)
          .eq('status', 'connected');

        if (instances && instances.length > 0) {
          const instanceIds = instances.map(i => i.instance_id);
          
          await realTimeMessageSyncService.initialize({
            clientId,
            instanceIds,
            enabled: true,
            syncInterval: 30000
          });

          console.log('✅ [CONVERSATIONS] Tempo real inicializado');
        }
      } catch (error) {
        console.error('❌ [CONVERSATIONS] Erro ao inicializar tempo real:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeRealTime();

    return () => {
      realTimeMessageSyncService.stop();
    };
  }, [clientId, isInitializing]);

  // Filtrar tickets por busca
  const filteredTickets = tickets.filter(ticket => {
    const searchLower = searchTerm.toLowerCase();
    return (
      ticket.title?.toLowerCase().includes(searchLower) ||
      ticket.customer?.name?.toLowerCase().includes(searchLower) ||
      ticket.customer?.phone?.includes(searchTerm) ||
      ticket.last_message_preview?.toLowerCase().includes(searchLower)
    );
  });

  // Abrir chat do ticket
  const handleOpenChat = useCallback((ticketId: string) => {
    navigate(`/client/${clientId}/chat/${ticketId}`);
  }, [navigate, clientId]);

  // Sincronização manual
  const handleForceSync = useCallback(async () => {
    try {
      await forceSyncMessages();
      toast({
        title: "Sincronização Completa",
        description: "Mensagens sincronizadas com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro na Sincronização",
        description: "Não foi possível sincronizar as mensagens",
        variant: "destructive"
      });
    }
  }, [forceSyncMessages, toast]);

  // Renderizar status de sincronização
  const renderSyncStatus = () => {
    const statusConfig = {
      idle: { icon: Clock, color: 'text-gray-500', text: 'Aguardando' },
      syncing: { icon: RefreshCw, color: 'text-blue-500', text: 'Sincronizando' },
      success: { icon: Wifi, color: 'text-green-500', text: 'Conectado' },
      error: { icon: WifiOff, color: 'text-red-500', text: 'Erro' }
    };

    const { icon: StatusIcon, color, text } = statusConfig[syncStatus];

    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={`w-4 h-4 ${color} ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        <span className={color}>{text}</span>
        {lastSyncTime && (
          <span className="text-xs text-gray-400">
            • {format(lastSyncTime, 'HH:mm', { locale: ptBR })}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header com busca e controles */}
      <div className="flex-shrink-0 space-y-4 p-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Conversas</h2>
            <Badge variant="secondary">{filteredTickets.length}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {renderSyncStatus()}
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceSync}
              disabled={syncStatus === 'syncing'}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conversa encontrada</p>
                {searchTerm && (
                  <p className="text-sm mt-2">Tente ajustar sua busca</p>
                )}
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <Card 
                  key={ticket.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleOpenChat(ticket.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <CardTitle className="text-base truncate">
                          {ticket.customer?.name || 'Contato sem nome'}
                        </CardTitle>
                      </div>
                      {ticket.last_message_at && (
                        <span className="text-xs text-gray-500">
                          {format(new Date(ticket.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    {ticket.customer?.phone && (
                      <p className="text-sm text-gray-600">{ticket.customer.phone}</p>
                    )}
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {ticket.last_message_preview || 'Nenhuma mensagem'}
                    </p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="outline" className="text-xs">
                        {ticket.status || 'Ativo'}
                      </Badge>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenChat(ticket.id);
                        }}
                      >
                        Abrir Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ConversationsPanel;
