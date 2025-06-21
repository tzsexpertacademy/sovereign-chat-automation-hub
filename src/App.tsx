
import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "@/pages/Index";
import AdminDashboard from "@/pages/AdminDashboard";
import ClientDashboard from "@/pages/ClientDashboard";
import NotFound from "@/pages/NotFound";
import FunnelPage from "@/pages/FunnelPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/client/:clientId" element={<ClientDashboard />} />
            <Route path="/client/:clientId/chat" element={<ClientDashboard />} />
            <Route path="/client/:clientId/funnel" element={<FunnelPage />} />
            <Route path="/client/:clientId/assistants" element={<ClientDashboard />} />
            <Route path="/client/:clientId/queues" element={<ClientDashboard />} />
            <Route path="/client/:clientId/instances" element={<ClientDashboard />} />
            <Route path="/client/:clientId/booking" element={<ClientDashboard />} />
            <Route path="/client/:clientId/automation" element={<ClientDashboard />} />
            <Route path="/client/:clientId/analytics" element={<ClientDashboard />} />
            <Route path="/client/:clientId/settings" element={<ClientDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
