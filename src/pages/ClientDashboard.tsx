
import { useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import ChatTabsInterface from "@/components/client/ChatTabsInterface";
import TicketTabsInterface from "@/components/client/TicketTabsInterface";
import CampaignsManager from "@/components/client/CampaignsManager";
import AutomationCenter from "@/components/client/AutomationCenter";
import AnalyticsDashboard from "@/components/client/AnalyticsDashboard";
import WhatsAppConnectionManagerV2 from "@/components/client/WhatsAppConnectionManagerV2";
import AssistantsManager from "@/components/client/AssistantsManager";
import BookingManager from "@/components/booking/BookingManager";
import FunnelTicketsKanban from "@/components/client/FunnelTicketsKanban";
import QueueManagementCenter from "@/components/client/QueueManagementCenter";
import QueueConnectionManager from "@/components/client/QueueConnectionManager";
import ClientDashboardOverview from "@/components/client/ClientDashboardOverview";
import ClientSettingsPage from "@/pages/ClientSettingsPage";
import SafeComponent from "@/components/SafeComponent";

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
            <SafeComponent 
              fallbackTitle="Erro no Dashboard Cliente"
              fallbackMessage="Houve um problema ao carregar o dashboard do cliente."
            >
              <Routes>
                <Route path="/" element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboardOverview clientId={clientId} />} />
                <Route path="tickets" element={<TicketTabsInterface />} />
                <Route path="connect" element={<WhatsAppConnectionManagerV2 />} />
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
                <Route path="funnel" element={<FunnelTicketsKanban clientId={clientId} />} />
                <Route path="assistants" element={<AssistantsManager />} />
                <Route path="queues" element={<QueueManagementCenter clientId={clientId} />} />
                <Route path="campaigns" element={<CampaignsManager clientId={clientId} />} />
                <Route path="instances" element={<QueueConnectionManager />} />
                <Route path="booking" element={<BookingManager clientId={clientId} />} />
                <Route path="automation" element={<AutomationCenter />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="settings/*" element={<ClientSettingsPage />} />
                <Route path="settings" element={<ClientSettingsPage />} />
              </Routes>
            </SafeComponent>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ClientDashboard;
