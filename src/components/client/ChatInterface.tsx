
import React from 'react';
import ImprovedConversationImport from './ImprovedConversationImport';

interface ChatInterfaceProps {
  clientId: string;
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

const ChatInterface = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceProps) => {
  return <ImprovedConversationImport clientId={clientId} />;
};

export default ChatInterface;
