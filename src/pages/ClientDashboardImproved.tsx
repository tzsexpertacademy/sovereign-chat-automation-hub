
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import ClientHeader from '@/components/client/ClientHeader';
import ClientSidebar from '@/components/client/ClientSidebar';
import ChatInterfaceImproved from '@/components/client/ChatInterfaceImproved';
import QueuesManager from '@/components/client/QueuesManager';
import ContactsManager from '@/components/client/ContactsManager';
import AnalyticsDashboard from '@/components/client/AnalyticsDashboard';
import AutomationCenter from '@/components/client/AutomationCenter';
import CampaignsManager from '@/components/client/CampaignsManager';
import FunnelKanban from '@/components/client/FunnelKanban';
import BookingManager from '@/components/booking/BookingManager';
import { MultipleInstancesManagerFixed } from '@/components/client/MultipleInstancesManagerFixed';
import { QueueConnectionManagerFixed } from '@/components/client/QueueConnectionManagerFixed';
import AIConfigForm from '@/components/client/AIConfigForm';

const ClientDashboardImproved = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatInterfaceImproved
            clientId={clientId}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
          />
        );
      case 'instances':
        return (
          <div className="p-6 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Gerenciar Instâncias WhatsApp</h2>
              <MultipleInstancesManagerFixed clientId={clientId} />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Conectar Filas às Instâncias</h2>
              <QueueConnectionManagerFixed clientId={clientId} />
            </div>
          </div>
        );
      case 'queues':
        return <QueuesManager clientId={clientId} />;
      case 'ai-config':
        return <AIConfigForm clientId={clientId} />;
      case 'contacts':
        return <ContactsManager clientId={clientId} />;
      case 'analytics':
        return <AnalyticsDashboard clientId={clientId} />;
      case 'automation':
        return <AutomationCenter clientId={clientId} />;
      case 'campaigns':
        return <CampaignsManager clientId={clientId} />;
      case 'funnel':
        return <FunnelKanban clientId={clientId} />;
      case 'booking':
        return <BookingManager clientId={clientId} />;
      default:
        return (
          <ChatInterfaceImproved
            clientId={clientId}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <ClientHeader />
      <div className="flex">
        <ClientSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          clientId={clientId}
        />
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default ClientDashboardImproved;
