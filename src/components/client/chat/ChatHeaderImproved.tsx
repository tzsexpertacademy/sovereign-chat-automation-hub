import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Smartphone, Bot, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import TicketActionsMenu from '../TicketActionsMenu';
import { useTicketData } from './useTicketData';
import { useTicketMessages } from '@/hooks/useTicketMessages';

interface ChatHeaderImprovedProps {
  ticket: any;
  clientId: string;
  onTicketUpdate: () => void;
}

const ChatHeaderImproved = ({ ticket, clientId, onTicketUpdate }: ChatHeaderImprovedProps) => {
  const { toast } = useToast();
  const { queueInfo, connectedInstance } = useTicketData(ticket?.id || '', clientId);
  const { messages } = useTicketMessages(ticket?.id || '');
  const [isClearing, setIsClearing] = React.useState(false);

  if (!ticket) return null;

  const getDisplayName = (customer: any, phone?: string) => customer?.name || phone || 'Contato';

  const handleClearHistory = async () => {
    if (!ticket?.id || isClearing) return;

    try {
      setIsClearing(true);
      console.log('🗑️ Limpando histórico do ticket:', ticket.id);

      const { error } = await supabase
        .from('ticket_messages')
        .delete()
        .eq('ticket_id', ticket.id);

      if (error) {
        console.error('❌ Erro ao limpar histórico:', error);
        throw error;
      }

      console.log('✅ Histórico do ticket limpo com sucesso');
      
      toast({
        title: "Histórico Limpo",
        description: "Todas as mensagens do ticket foram removidas com sucesso"
      });

    } catch (error) {
      console.error('❌ Erro ao limpar histórico:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar histórico do ticket",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const renderConnectionInfo = () => {
    const infoParts = [];

    // Informação da conexão
    if (connectedInstance) {
      infoParts.push(
        <div key="connection" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Smartphone className="w-3 h-3" />
          <span>{connectedInstance}</span>
        </div>
      );
    }

    // Informação da fila
    if (queueInfo) {
      infoParts.push(
        <div key="queue" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{queueInfo.name}</span>
        </div>
      );
    }

    // Informação do assistente (se houver)
    if (queueInfo?.assistants) {
      infoParts.push(
        <div key="assistant" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bot className="w-3 h-3" />
          <span>{queueInfo.assistants.name}</span>
        </div>
      );
    }

    return infoParts;
  };

  return (
    <div className="p-4 border-b border-border bg-background flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(ticket.customer, ticket.customer?.phone)}`} />
            <AvatarFallback>
              {getDisplayName(ticket.customer, ticket.customer?.phone).substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate">
              {getDisplayName(ticket.customer, ticket.customer?.phone)}
            </h3>
            <div className="text-sm text-muted-foreground truncate mb-1">
              {ticket.customer?.phone}
            </div>
            
            {/* Linha com informações de conexão, fila e assistente */}
            <div className="flex items-center gap-3 flex-wrap">
              {renderConnectionInfo()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {/* Botão de limpar histórico */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={isClearing || messages.length === 0}
            className="text-destructive hover:text-destructive"
          >
            {isClearing ? (
              <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isClearing ? 'Limpando...' : 'Limpar'}
          </Button>

          {/* Menu de ações do ticket */}
          <TicketActionsMenu 
            ticket={ticket} 
            onTicketUpdate={onTicketUpdate}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatHeaderImproved;