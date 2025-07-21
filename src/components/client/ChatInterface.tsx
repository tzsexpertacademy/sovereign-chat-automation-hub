
import React from 'react';
import { useParams } from 'react-router-dom';
import ChatTabsInterface from './ChatTabsInterface';
import TicketChatInterface from './TicketChatInterface';

interface ChatInterfaceProps {
  clientId: string;
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

const ChatInterface = ({ clientId }: ChatInterfaceProps) => {
  const { ticketId } = useParams<{ ticketId?: string }>();

  // Se há ticketId na URL, mostrar chat específico
  if (ticketId) {
    return <TicketChatInterface clientId={clientId} ticketId={ticketId} />;
  }

  // Caso contrário, mostrar lista de conversas/contatos
  return <ChatTabsInterface clientId={clientId} />;
};

export default ChatInterface;
