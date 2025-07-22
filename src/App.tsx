
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { InstanceManagerProvider } from "./contexts/InstanceManagerContext";
import Index from "./pages/Index";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import ClientDashboardFixed from "./pages/ClientDashboardFixed";
import ClientDashboardImproved from "./pages/ClientDashboardImproved";
import ClientAssistants from "./pages/ClientAssistants";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <InstanceManagerProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/client/:clientId" element={<ClientDashboardImproved />} />
            <Route path="/client/:clientId/assistants" element={<ClientAssistants />} />
            <Route path="/client/assistants" element={<ClientAssistants />} />
            <Route path="/dashboard/:clientId" element={<ClientDashboardFixed />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </InstanceManagerProvider>
  </QueryClientProvider>
);

export default App;
