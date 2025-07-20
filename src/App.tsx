import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ClientsManagement from '@/components/admin/ClientsManagement';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminOverview from '@/components/admin/AdminOverview';
import ServerConfiguration from '@/components/admin/ServerConfiguration';
import ClientDashboard from '@/pages/ClientDashboard';
import WhatsAppConnection from '@/components/client/WhatsAppConnection';
import { Toaster } from "@/components/ui/toaster";
import CleanInstancesManager from "@/components/admin/CleanInstancesManager";
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
          
          <Route path="/client/:clientId" element={<ClientDashboard />}>
            <Route index element={<WhatsAppConnection />} />
          </Route>

          <Route path="/admin" element={<AdminDashboard />}>
            <Route index element={<AdminOverview />} />
            <Route path="clients" element={<ClientsManagement />} />
            <Route path="instances" element={<CleanInstancesManager />} />
            <Route path="server-config" element={<ServerConfiguration />} />
          </Route>
        </Routes>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;
