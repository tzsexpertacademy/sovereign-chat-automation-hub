
import React from 'react';
import ImprovedConversationImport from './ImprovedConversationImport';

interface ChatInterfaceProps {
  clientId: string;
}

const ChatInterface = ({ clientId }: ChatInterfaceProps) => {
  return <ImprovedConversationImport clientId={clientId} />;
};

export default ChatInterface;
