
import { useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import ChatInterface from "@/components/client/ChatInterface";
import CampaignsManager from "@/components/client/CampaignsManager";
import AutomationCenter from "@/components/client/AutomationCenter";
import AnalyticsDashboard from "@/components/client/AnalyticsDashboard";
import WhatsAppConnection from "@/components/client/WhatsAppConnection";
import AssistantsManager from "@/components/client/AssistantsManager";

const ClientDashboard = () => {
  const { clientId } = useParams();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <ClientSidebar />
        <div className="flex-1 flex flex-col">
          <ClientHeader clientId={clientId} />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to={`/client/${clientId}/connect`} replace />} />
              <Route path="/connect" element={<WhatsAppConnection />} />
              <Route path="/chat" element={<ChatInterface />} />
              <Route path="/assistants" element={<AssistantsManager />} />
              <Route path="/campaigns" element={<CampaignsManager />} />
              <Route path="/automation" element={<AutomationCenter />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ClientDashboard;
