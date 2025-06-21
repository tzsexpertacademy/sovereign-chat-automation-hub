
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import ClientSidebar from '@/components/client/ClientSidebar';
import ClientHeader from '@/components/client/ClientHeader';
import ClientInstancesOverview from '@/components/client/ClientInstancesOverview';
import WhatsAppConnection from '@/components/client/WhatsAppConnection';
import TicketsInterface from '@/components/client/TicketsInterface';
import AssistantsManager from '@/components/client/AssistantsManager';
import QueuesManager from '@/components/client/QueuesManager';
import AutomationCenter from '@/components/client/AutomationCenter';
import CampaignsManager from '@/components/client/CampaignsManager';
import AnalyticsDashboard from '@/components/client/AnalyticsDashboard';
import BookingManager from '@/components/booking/BookingManager';
import { clientsService, ClientData } from '@/services/clientsService';

const ClientDashboard = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    const loadClient = async () => {
      try {
        setLoading(true);
        const clientData = await clientsService.getClientById(clientId);
        setClient(clientData);
      } catch (error) {
        console.error('Erro ao carregar cliente:', error);
        setClient(null);
      } finally {
        setLoading(false);
      }
    };

    loadClient();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client || !clientId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Cliente não encontrado</h1>
          <Button onClick={() => navigate('/admin')}>
            Voltar ao Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50">
        <ClientSidebar clientId={clientId} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ClientHeader />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <Routes>
                <Route path="/" element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ClientInstancesOverview />} />
                <Route path="connect" element={<WhatsAppConnection clientId={clientId} />} />
                <Route path="chat" element={<TicketsInterface />} />
                <Route path="assistants" element={<AssistantsManager />} />
                <Route path="queues" element={<QueuesManager />} />
                <Route path="automation" element={<AutomationCenter />} />
                <Route path="campaigns" element={<CampaignsManager />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="booking" element={<BookingManager clientId={clientId} />} />
                <Route path="*" element={<Navigate to="overview" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ClientDashboard;
