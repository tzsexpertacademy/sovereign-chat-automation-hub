
import { useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import TicketChatInterface from "@/components/client/TicketChatInterface";
import CampaignsManager from "@/components/client/CampaignsManager";
import AutomationCenter from "@/components/client/AutomationCenter";
import AnalyticsDashboard from "@/components/client/AnalyticsDashboard";
import WhatsAppConnection from "@/components/client/WhatsAppConnection";
import AssistantsManager from "@/components/client/AssistantsManager";
import BookingManager from "@/components/booking/BookingManager";
import FunnelKanban from "@/components/client/FunnelKanban";
import QueuesManager from "@/components/client/QueuesManager";

const ClientDashboard = () => {
  const { clientId } = useParams();

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

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
              <Route path="chat" element={<TicketChatInterface />} />
              <Route path="funnel" element={<FunnelKanban clientId={clientId} />} />
              <Route path="assistants" element={<AssistantsManager />} />
              <Route path="queues" element={<QueuesManager />} />
              <Route path="instances" element={<div>Instâncias em desenvolvimento</div>} />
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
