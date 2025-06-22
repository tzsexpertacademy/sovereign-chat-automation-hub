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
  AlertTriangle,
  Eye,
  EyeOff,
  Smartphone,
  Wifi,
  WifiOff,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData, CreateClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

const ClientsManagement = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [allInstances, setAllInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDisconnectedInstances, setShowDisconnectedInstances] = useState(false);
  const [showAllInstances, setShowAllInstances] = useState(false);
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
    loadAllInstances();
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

  const loadAllInstances = async () => {
    try {
      // Load all instances from all clients
      const allClientInstances: WhatsAppInstanceData[] = [];
      const clientsData = await clientsService.getAllClients();
      
      for (const client of clientsData) {
        const instances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allClientInstances.push(...instances);
      }
      
      setAllInstances(allClientInstances);
      console.log('Todas as instâncias carregadas:', allClientInstances);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Instância Removida",
        description: "Instância foi removida com sucesso",
      });
      
      await loadAllInstances();
      await loadClients();
    } catch (error) {
      console.error("Erro ao deletar instância:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive",
      });
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
        description: `Cliente ${clientData.name} criado com sucesso!`,
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

  const getClientForInstance = (instanceClientId: string) => {
    return clients.find(client => client.id === instanceClientId);
  };

  const disconnectedInstances = allInstances.filter(instance => 
    ['disconnected', 'error', 'auth_failed'].includes(instance.status || '')
  );

  const connectedInstances = allInstances.filter(instance => 
    ['connected', 'qr_ready', 'connecting', 'authenticated'].includes(instance.status || '')
  );

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
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': case 'auth_failed': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      case 'auth_failed': return 'Falha na Auth';
      default: return 'Sem Instância';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'qr_ready': return <Smartphone className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      case 'error': case 'auth_failed': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Clientes</h1>
          <p className="text-gray-600">Gerencie clientes e suas instâncias WhatsApp</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowAllInstances(!showAllInstances)}
            variant="outline"
            className={showAllInstances ? "bg-blue-50 text-blue-700 border-blue-200" : ""}
          >
            <Database className="w-4 h-4 mr-2" />
            Todas as Instâncias ({allInstances.length})
          </Button>
          <Button 
            onClick={() => setShowDisconnectedInstances(!showDisconnectedInstances)}
            variant="outline"
            className={showDisconnectedInstances ? "bg-red-50 text-red-700 border-red-200" : ""}
          >
            {showDisconnectedInstances ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Instâncias Desconectadas ({disconnectedInstances.length})
          </Button>
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

      {/* All Instances Section */}
      {showAllInstances && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Todas as Instâncias WhatsApp ({allInstances.length})
            </CardTitle>
            <CardDescription className="text-blue-700">
              Visualização completa de todas as instâncias no sistema, conectadas e desconectadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allInstances.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <p className="text-blue-600">Nenhuma instância encontrada no sistema</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Connected Instances */}
                {connectedInstances.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                      <Wifi className="w-4 h-4 mr-2" />
                      Instâncias Conectadas ({connectedInstances.length})
                    </h4>
                    <div className="space-y-2">
                      {connectedInstances.map((instance) => {
                        const client = getClientForInstance(instance.client_id || '');
                        return (
                          <div key={instance.id} className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(instance.status)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  ID: {instance.instance_id}
                                  {instance.custom_name && (
                                    <span className="ml-2 text-sm text-gray-600">({instance.custom_name})</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Cliente: {client ? client.name : 'Cliente não encontrado'}
                                  {instance.phone_number && (
                                    <span className="ml-2">| Tel: {instance.phone_number}</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Criado em: {new Date(instance.created_at).toLocaleDateString('pt-BR')} às {new Date(instance.created_at).toLocaleTimeString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="default" className="bg-green-500">
                                {getStatusText(instance.status)}
                              </Badge>
                              {client && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/client/${client.id}/tickets`)}
                                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                                >
                                  <MessageSquare className="w-4 h-4 mr-1" />
                                  Chat
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Disconnected Instances */}
                {disconnectedInstances.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                      <WifiOff className="w-4 h-4 mr-2" />
                      Instâncias Desconectadas ({disconnectedInstances.length})
                    </h4>
                    <div className="space-y-2">
                      {disconnectedInstances.map((instance) => {
                        const client = getClientForInstance(instance.client_id || '');
                        return (
                          <div key={instance.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(instance.status)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  ID: {instance.instance_id}
                                  {instance.custom_name && (
                                    <span className="ml-2 text-sm text-gray-600">({instance.custom_name})</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Cliente: {client ? client.name : 'Cliente não encontrado'}
                                  {instance.phone_number && (
                                    <span className="ml-2">| Tel: {instance.phone_number}</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Criado em: {new Date(instance.created_at).toLocaleDateString('pt-BR')} às {new Date(instance.created_at).toLocaleTimeString('pt-BR')}
                                  {instance.updated_at !== instance.created_at && (
                                    <span className="ml-2">| Atualizado: {new Date(instance.updated_at).toLocaleDateString('pt-BR')}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="destructive">
                                {getStatusText(instance.status)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteInstance(instance.instance_id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disconnected Instances Section (Legacy - keep for compatibility) */}
      {showDisconnectedInstances && disconnectedInstances.length > 0 && !showAllInstances && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Instâncias Desconectadas ({disconnectedInstances.length})
            </CardTitle>
            <CardDescription className="text-red-700">
              Estas instâncias estão desconectadas e podem ser removidas se não forem mais necessárias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {disconnectedInstances.map((instance) => {
                const client = getClientForInstance(instance.client_id || '');
                return (
                  <div key={instance.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                      <div>
                        <p className="font-medium text-gray-900">
                          ID: {instance.instance_id}
                        </p>
                        <p className="text-sm text-gray-600">
                          Cliente: {client ? client.name : 'Cliente não encontrado'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Status: {getStatusText(instance.status)} | 
                          Criado em: {new Date(instance.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant="destructive">
                        {getStatusText(instance.status)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteInstance(instance.instance_id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Total Instâncias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{allInstances.length}</div>
            <p className="text-xs text-blue-600">No sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{connectedInstances.length}</div>
            <p className="text-xs text-green-600">Online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Desconectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{disconnectedInstances.length}</div>
            <p className="text-xs text-red-600">Offline</p>
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
                      <p className="text-xs text-gray-500">
                        ID: {client.id.slice(0, 8)}...
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
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
    </div>
  );
};

export default ClientsManagement;
