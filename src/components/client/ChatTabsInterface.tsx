
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User, Settings } from "lucide-react";
import ConversationsPanel from './ConversationsPanel';
import ContactsManager from './ContactsManager';

interface ChatTabsInterfaceProps {
  clientId: string;
}

const ChatTabsInterface = ({ clientId }: ChatTabsInterfaceProps) => {
  const [activeTab, setActiveTab] = useState("conversations");

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b bg-background">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Contatos
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 min-h-0">
          <TabsContent value="conversations" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <ConversationsPanel clientId={clientId} />
          </TabsContent>
          
          <TabsContent value="contacts" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <ContactsManager clientId={clientId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ChatTabsInterface;
