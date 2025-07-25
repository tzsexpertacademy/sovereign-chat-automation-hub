
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
import MultipleInstancesManagerFixed from '@/components/client/MultipleInstancesManagerFixed';

import AIConfigForm from '@/components/client/AIConfigForm';

const ClientDashboardImproved = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showAIConfig, setShowAIConfig] = useState(false);

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
              <div>Componente MultipleInstancesManagerFixed necessário</div>
            </div>
          </div>
        );
      case 'queues':
        return <div>Queues Manager - {clientId}</div>;
      case 'ai-config':
        return showAIConfig ? (
          <AIConfigForm 
            clientId={clientId} 
            onSave={() => setShowAIConfig(false)}
            onCancel={() => setShowAIConfig(false)}
          />
        ) : (
          <div className="p-6">
            <button 
              onClick={() => setShowAIConfig(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Configurar IA
            </button>
          </div>
        );
      case 'contacts':
        return <div>Contacts Manager - {clientId}</div>;
      case 'analytics':
        return <div>Analytics Dashboard - {clientId}</div>;
      case 'automation':
        return <div>Automation Center - {clientId}</div>;
      case 'campaigns':
        return <div>Campaigns Manager - {clientId}</div>;
      case 'funnel':
        return <div>Funnel Kanban - {clientId}</div>;
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
        <ClientSidebar clientId={clientId} />
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default ClientDashboardImproved;
