
import { useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import ChatTabsInterface from "@/components/client/ChatTabsInterface";
import CampaignsManager from "@/components/client/CampaignsManager";
import AutomationCenter from "@/components/client/AutomationCenter";
import AnalyticsDashboard from "@/components/client/AnalyticsDashboard";
import WhatsAppConnection from "@/components/client/WhatsAppConnection";
import AssistantsManager from "@/components/client/AssistantsManager";
import BookingManager from "@/components/booking/BookingManager";
import FunnelKanban from "@/components/client/FunnelKanban";
import QueuesManager from "@/components/client/QueuesManager";
import QueueConnectionManager from "@/components/client/QueueConnectionManager";

const ClientDashboard = () => {
  const { clientId } = useParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <ClientSidebar clientId={clientId} />
        <div className="flex-1 flex flex-col">
          <ClientHeader clientId={clientId} />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="connect" replace />} />
              <Route path="connect" element={<WhatsAppConnection />} />
              <Route 
                path="chat" 
                element={
                  <ChatTabsInterface 
                    clientId={clientId} 
                    selectedChatId={selectedChatId}
                    onSelectChat={handleSelectChat}
                  />
                } 
              />
              <Route 
                path="chat/:chatId" 
                element={
                  <ChatTabsInterface 
                    clientId={clientId} 
                    selectedChatId={selectedChatId}
                    onSelectChat={handleSelectChat}
                  />
                } 
              />
              <Route path="funnel" element={<FunnelKanban clientId={clientId} />} />
              <Route path="assistants" element={<AssistantsManager />} />
              <Route path="queues" element={<QueuesManager />} />
              <Route path="instances" element={<QueueConnectionManager clientId={clientId} />} />
              <Route path="booking" element={<BookingManager clientId={clientId} />} />
              <Route path="automation" element={<AutomationCenter />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              <Route path="settings" element={<div>Configurações em desenvolvimento</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ClientDashboard;
