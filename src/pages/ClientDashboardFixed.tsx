
import { useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";

// Lazy load components to prevent blocking
const ChatTabsInterface = lazy(() => import("@/components/client/ChatTabsInterface"));
const CampaignsManager = lazy(() => import("@/components/client/CampaignsManager"));
const AutomationCenter = lazy(() => import("@/components/client/AutomationCenter"));
const AnalyticsDashboard = lazy(() => import("@/components/client/AnalyticsDashboard"));
const WhatsAppConnection = lazy(() => import("@/components/client/WhatsAppConnection"));
const AssistantsManager = lazy(() => import("@/components/client/AssistantsManager"));
const BookingManager = lazy(() => import("@/components/booking/BookingManager"));
const FunnelKanban = lazy(() => import("@/components/client/FunnelKanban"));
const QueueManagementCenter = lazy(() => import("@/components/client/QueueManagementCenter"));


const ClientDashboardFixed = () => {
  const { clientId } = useParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  console.log('🔍 [ClientDashboard] Iniciando com clientId:', clientId);

  if (!clientId) {
    console.log('🚨 [ClientDashboard] ClientId não encontrado');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Cliente não encontrado</h2>
          <p className="text-muted-foreground mt-2">Verifique a URL e tente novamente</p>
        </div>
      </div>
    );
  }

  const handleSelectChat = (chatId: string) => {
    console.log('🔍 [ClientDashboard] Selecionando chat:', chatId);
    setSelectedChatId(chatId);
  };

  return (
    <ErrorBoundary>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gray-50">
          <ClientSidebar clientId={clientId} />
          <div className="flex-1 flex flex-col">
            <ClientHeader clientId={clientId} />
            <main className="flex-1 p-6">
              <Suspense fallback={<LoadingSpinner fullScreen text="Carregando módulo..." />}>
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
                  <Route path="campaigns" element={<CampaignsManager clientId={clientId} />} />
                  <Route path="queues" element={<QueueManagementCenter />} />
                  
                  <Route path="booking" element={<BookingManager clientId={clientId} />} />
                  <Route path="automation" element={<AutomationCenter />} />
                  <Route path="analytics" element={<AnalyticsDashboard />} />
                  <Route path="settings" element={<div>Configurações em desenvolvimento</div>} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ErrorBoundary>
  );
};

export default ClientDashboardFixed;
