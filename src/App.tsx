import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ClientsManagement from '@/pages/ClientsManagement';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminOverview from '@/pages/AdminOverview';
import ServerConfiguration from '@/pages/ServerConfiguration';
import ClientDashboard from '@/pages/ClientDashboard';
import Chat from '@/pages/Chat';
import WhatsAppConnection from '@/components/client/WhatsAppConnection';
import Queues from '@/pages/Queues';
import { ToastProvider } from "@/components/ui/use-toast"
import PricingPage from '@/pages/PricingPage';
import PublicPage from '@/pages/PublicPage';
import CleanInstancesManager from "@/components/admin/CleanInstancesManager";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          
          <Route path="/client/:clientId" element={<ClientDashboard />}>
            <Route index element={<WhatsAppConnection />} />
            <Route path="chat" element={<Chat />} />
            <Route path="queues" element={<Queues />} />
          </Route>

          <Route path="/admin" element={<AdminDashboard />}>
            <Route index element={<AdminOverview />} />
            <Route path="clients" element={<ClientsManagement />} />
            <Route path="instances" element={<CleanInstancesManager />} />
            <Route path="server-config" element={<ServerConfiguration />} />
          </Route>
        </Routes>
      </div>
      <ToastProvider />
    </Router>
  );
}

export default App;
