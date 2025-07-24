
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MessageSquare,
  Settings,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  Activity,
  RefreshCw,
  ExternalLink,
  Database,
  Globe
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessManagement from "./BusinessManagement";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData, CreateClientData } from "@/services/clientsService";

const ClientsManagement = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClient, setNewClient] = useState<CreateClientData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    plan: "basic"
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load clients from Supabase on component mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);
      console.log('Clientes carregados do Supabase:', clientsData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar clientes do banco de dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim() || !newClient.email.trim()) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const clientData = await clientsService.createClient({
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        phone: newClient.phone?.trim(),
        company: newClient.company?.trim(),
        plan: newClient.plan || 'basic',
      });

      toast({
        title: "Sucesso",
        description: `Cliente ${clientData.name} criado com sucesso! Business: ${clientData.business_id?.slice(0, 8)}...`,
      });

      // Reset form and reload clients
      setNewClient({ name: "", email: "", phone: "", company: "", plan: "basic" });
      setShowCreateForm(false);
      await loadClients();

    } catch (error: any) {
      console.error("Erro ao criar cliente:", error);
      
      let errorMessage = "Falha ao criar cliente";
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        errorMessage = "Cliente com este email já existe";
      }
      
      toast({
        title: "Erro ao Criar Cliente",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClientBusiness = async (clientId: string) => {
    try {
      setLoading(true);
      
      await clientsService.syncClientWithBusiness(clientId);
      
      toast({
        title: "Sincronização Concluída",
        description: "Cliente sincronizado com business",
      });
      
      await loadClients();
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast({
        title: "Erro de Sincronização",
        description: error.message || "Falha ao sincronizar cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await clientsService.deleteClient(clientId);
      
      toast({
        title: "Cliente Removido",
        description: "Cliente foi removido com sucesso",
      });
      
      await loadClients();
    } catch (error) {
      console.error("Erro ao deletar cliente:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover cliente",
        variant: "destructive",
      });
    }
  };

  const handleOpenChat = (client: ClientData) => {
    if (client.instance_id && client.instance_status === 'connected') {
      navigate(`/client/${client.id}/chat`);
    } else {
      toast({
        title: "Instância não conectada",
        description: "Este cliente precisa de uma instância WhatsApp conectada",
        variant: "destructive",
      });
    }
  };

  const handleOpenClientPanel = (client: ClientData) => {
    window.open(`/client/${client.id}`, '_blank');
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.company && client.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      default: return 'Sem Instância';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-gray-100 text-gray-800';
      case 'standard': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-gold-100 text-gold-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMaxInstancesForPlan = (plan: string) => {
    switch (plan) {
      case 'basic': return 1;
      case 'standard': return 3;
      case 'premium': return 10;
      case 'enterprise': return 50;
      default: return 1;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="businesses" className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span>Businesses</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Clientes</h1>
              <p className="text-gray-600">Gerencie clientes e suas instâncias WhatsApp</p>
            </div>
        <div className="flex space-x-2">
          <Button onClick={loadClients} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-gray-500">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Instâncias Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {clients.reduce((sum, c) => sum + (c.current_instances || 0), 0)}
            </div>
            <p className="text-xs text-green-600">Conectadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Plano Básico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {clients.filter(c => c.plan === 'basic').length}
            </div>
            <p className="text-xs text-blue-600">Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Plano Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {clients.filter(c => c.plan === 'premium' || c.plan === 'enterprise').length}
            </div>
            <p className="text-xs text-purple-600">Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ativos Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {clients.filter(c => {
                const today = new Date().toDateString();
                return new Date(c.last_activity).toDateString() === today;
              }).length}
            </div>
            <p className="text-xs text-orange-600">Atividade hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar clientes por nome, email ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Create Client Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Cliente</CardTitle>
            <CardDescription>Preencha os dados do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  placeholder="Nome completo"
                  value={newClient.name}
                  onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={newClient.phone}
                  onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input
                  placeholder="Nome da empresa"
                  value={newClient.company}
                  onChange={(e) => setNewClient(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Plano</label>
                <select
                  value={newClient.plan}
                  onChange={(e) => setNewClient(prev => ({ ...prev, plan: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Básico (1 instância)</option>
                  <option value="standard">Padrão (3 instâncias)</option>
                  <option value="premium">Premium (10 instâncias)</option>
                  <option value="enterprise">Enterprise (50 instâncias)</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleCreateClient} disabled={loading}>
                {loading ? "Criando..." : "Criar Cliente"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients List */}
      <div className="grid gap-4">
        {filteredClients.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {clients.length === 0 ? "Nenhum cliente criado" : "Nenhum cliente encontrado"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {clients.length === 0 
                    ? "Crie seu primeiro cliente usando o botão 'Novo Cliente'"
                    : "Tente ajustar os termos de busca"
                  }
                </p>
                {clients.length === 0 && (
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Cliente
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>{client.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{client.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {client.email}
                        </div>
                        {client.phone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {client.phone}
                          </div>
                        )}
                        {client.company && (
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-1" />
                            {client.company}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                   <div className="flex items-center space-x-4">
                     {/* Plan and Instance Info */}
                     <div className="text-center">
                       <div className="flex items-center space-x-2 mb-1">
                         <Badge className={getPlanColor(client.plan)}>
                           {client.plan.toUpperCase()}
                         </Badge>
                         <Badge variant="outline">
                           {client.current_instances || 0}/{getMaxInstancesForPlan(client.plan)} instâncias
                         </Badge>
                       </div>
                       <div className="flex items-center space-x-2 text-xs text-gray-500">
                         <span>ID: {client.id.slice(0, 8)}...</span>
                         {client.business_id && (
                           <Badge variant="secondary" className="text-xs">
                             <Building2 className="w-3 h-3 mr-1" />
                             Business: {client.business_id.slice(0, 8)}...
                           </Badge>
                         )}
                       </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex space-x-2">
                       {!client.business_id && (
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleSyncClientBusiness(client.id)}
                           className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                           disabled={loading}
                         >
                           <Database className="w-4 h-4 mr-1" />
                           Sincronizar
                         </Button>
                       )}
                       
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleOpenClientPanel(client)}
                         className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                       >
                         <ExternalLink className="w-4 h-4 mr-1" />
                         Painel Cliente
                       </Button>
                       
                       <Button
                         size="sm"
                         onClick={() => handleOpenChat(client)}
                         className="bg-green-600 hover:bg-green-700"
                         disabled={!client.current_instances || client.current_instances === 0}
                       >
                         <MessageSquare className="w-4 h-4 mr-1" />
                         Chat
                       </Button>
                       
                       <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    Última atividade: {new Date(client.last_activity).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
          </div>
        </TabsContent>

        <TabsContent value="businesses" className="space-y-6">
          <BusinessManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientsManagement;
