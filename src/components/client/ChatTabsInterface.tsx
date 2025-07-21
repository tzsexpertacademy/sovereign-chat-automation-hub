
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User } from "lucide-react";
import ChatInterface from './ChatInterface';
import ContactsManager from './ContactsManager';

interface ChatTabsInterfaceProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatTabsInterface = ({ clientId, selectedChatId, onSelectChat }: ChatTabsInterfaceProps) => {
  const [activeTab, setActiveTab] = useState("conversations");

  return (
    <div className="h-[calc(100vh-120px)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Contatos
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="conversations" className="flex-1 mt-0">
          <ChatInterface 
            clientId={clientId}
            selectedChatId={selectedChatId}
            onSelectChat={onSelectChat}
          />
        </TabsContent>
        
        <TabsContent value="contacts" className="flex-1 mt-0">
          <ContactsManager clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatTabsInterface;
