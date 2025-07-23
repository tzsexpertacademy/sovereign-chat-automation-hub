
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ClientsManagement from "@/components/admin/ClientsManagement";
import PlansManagement from "@/components/admin/PlansManagement";
import SystemLogs from "@/components/admin/SystemLogs";
import YumerApiManager from "@/components/admin/YumerApiManager";
import { Users, CreditCard, Activity, Settings, Server } from "lucide-react";

const AdminDashboard = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center border-b border-border bg-background">
            <SidebarTrigger className="ml-4" />
            <div className="flex-1 px-4">
              <h1 className="text-xl font-semibold">Painel Administrativo</h1>
            </div>
          </header>
          
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
                <p className="text-gray-600 mt-2">
                  Gerencie clientes, planos e monitore o sistema Yumer v2
                </p>
              </div>

              <Tabs defaultValue="api" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="api" className="flex items-center space-x-2">
                    <Server className="w-4 h-4" />
                    <span>API Yumer v2</span>
                  </TabsTrigger>
                  <TabsTrigger value="clients" className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Clientes</span>
                  </TabsTrigger>
                  <TabsTrigger value="plans" className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Planos</span>
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="flex items-center space-x-2">
                    <Activity className="w-4 h-4" />
                    <span>Logs</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex items-center space-x-2">
                    <Settings className="w-4 h-4" />
                    <span>Configurações</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="api">
                  <YumerApiManager />
                </TabsContent>

                <TabsContent value="clients">
                  <ClientsManagement />
                </TabsContent>

                <TabsContent value="plans">
                  <PlansManagement />
                </TabsContent>

                <TabsContent value="logs">
                  <SystemLogs />
                </TabsContent>

                <TabsContent value="settings">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configurações do Sistema</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
                        Configurações avançadas do sistema serão implementadas aqui.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
