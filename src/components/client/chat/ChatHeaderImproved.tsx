import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Smartphone, Bot, Users } from "lucide-react";
import TicketActionsMenu from '../TicketActionsMenu';
import { useTicketData } from './useTicketData';

interface ChatHeaderImprovedProps {
  ticket: any;
  clientId: string;
  onTicketUpdate: () => void;
}

const ChatHeaderImproved = ({ ticket, clientId, onTicketUpdate }: ChatHeaderImprovedProps) => {
  const { queueInfo, connectedInstance } = useTicketData(ticket?.id || '', clientId);

  if (!ticket) return null;

  const getDisplayName = (customer: any, phone?: string) => customer?.name || phone || 'Contato';

  const renderConnectionInfo = () => {
    const infoParts = [];

    // Informação da conexão - nome da instância
    if (connectedInstance) {
      infoParts.push(
        <div key="connection" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Smartphone className="w-3 h-3" />
          <span>{connectedInstance}</span>
        </div>
      );
    }

    // Informação da fila - apenas se ticket estiver atribuído à fila
    if (queueInfo && ticket?.assigned_queue_id) {
      infoParts.push(
        <div key="queue" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{queueInfo.name}</span>
        </div>
      );
    }

    // Informação do assistente - apenas se assistente estiver ativo na fila
    if (queueInfo?.assistant_name && ticket?.assigned_assistant_id) {
      infoParts.push(
        <div key="assistant" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bot className="w-3 h-3" />
          <span>{queueInfo.assistant_name}</span>
        </div>
      );
    }

    return infoParts;
  };

  return (
    <div className="p-4 border-b border-border bg-gradient-to-r from-background to-muted/20 flex-shrink-0">
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