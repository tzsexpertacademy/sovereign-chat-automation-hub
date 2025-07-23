import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ClientHeader from "@/components/client/ClientHeader";
import ClientSidebar from "@/components/client/ClientSidebar";
import ContactsManager from "@/components/client/ContactsManager";
import QueuesManager from "@/components/client/QueuesManager";
import FunnelKanban from "@/components/client/FunnelKanban";
import AssistantsManager from "@/components/client/AssistantsManager";
import AutomationCenter from "@/components/client/AutomationCenter";
import AnalyticsDashboard from "@/components/client/AnalyticsDashboard";

const ClientDashboard = () => {
  const { clientId, tab } = useParams();
  const activeTab = tab || "overview";

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      <ClientSidebar clientId={clientId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ClientHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="assistants">Assistentes</TabsTrigger>
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="funnel">Funil</TabsTrigger>
              <TabsTrigger value="queues">Filas</TabsTrigger>
              <TabsTrigger value="automation">Automação</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard do Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Sistema integrado com API Yumer para gestão completa.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assistants" className="space-y-6">
              <AssistantsManager />
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6">
              <ContactsManager clientId={clientId} />
            </TabsContent>

            <TabsContent value="funnel" className="space-y-6">
              <FunnelKanban clientId={clientId} />
            </TabsContent>

            <TabsContent value="queues" className="space-y-6">
              <QueuesManager />
            </TabsContent>

            <TabsContent value="automation" className="space-y-6">
              <AutomationCenter />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default ClientDashboard;