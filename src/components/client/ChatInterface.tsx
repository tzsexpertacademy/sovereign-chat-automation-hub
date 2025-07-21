
import React from 'react';
import ConversationsPanel from './ConversationsPanel';

interface ChatInterfaceProps {
  clientId: string;
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

const ChatInterface = ({ clientId }: ChatInterfaceProps) => {
  return <ConversationsPanel clientId={clientId} />;
};

export default ChatInterface;
