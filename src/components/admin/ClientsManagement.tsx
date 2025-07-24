
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Plus, 
  Search, 
  Trash2, 
  MessageSquare,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  Activity,
  RefreshCw,
  ExternalLink,
  Filter,
  TrendingUp,
  Star,
  CheckCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessManagement from "./BusinessManagement";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData, CreateClientData } from "@/services/clientsService";
import { businessService } from "@/services/businessService";

const ClientsManagement = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const handleSyncAllInstances = async () => {
    try {
      setLoading(true);
      
      const result = await businessService.syncAllInstancesWithClients();
      
      toast({
        title: "Sincronização de Instâncias Concluída",
        description: `${result.synced} clientes sincronizados. ${result.failed.length > 0 ? `${result.failed.length} falharam.` : ''}`,
      });
      
      await loadClients();
    } catch (error: any) {
      console.error("Erro ao sincronizar instâncias:", error);
      toast({
        title: "Erro na Sincronização",
        description: error.message || "Falha ao sincronizar instâncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateInstanceCounts = async () => {
    try {
      setLoading(true);
      
      const result = await clientsService.recalculateAllInstanceCounts();
      
      toast({
        title: "Contadores Recalculados",
        description: `${result.updated} clientes atualizados. ${result.errors.length > 0 ? `${result.errors.length} erros encontrados.` : ''}`,
      });
      
      if (result.errors.length > 0) {
        console.warn('Erros durante recálculo:', result.errors);
      }
      
      await loadClients();
    } catch (error: any) {
      console.error("Erro ao recalcular contadores:", error);
      toast({
        title: "Erro no Recálculo",
        description: error.message || "Falha ao recalcular contadores",
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.company && client.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPlan = planFilter === "all" || client.plan === planFilter;
    
    const hasInstances = (client.current_instances || 0) > 0;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && hasInstances) ||
      (statusFilter === "inactive" && !hasInstances);
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const getStatusColor = (instanceCount: number) => {
    if (instanceCount > 0) return 'text-green-600';
    return 'text-gray-500';
  };

  const getStatusText = (instanceCount: number) => {
    if (instanceCount > 0) return 'Ativo';
    return 'Inativo';
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'default';
      case 'standard': return 'secondary';
      case 'premium': return 'outline';
      case 'enterprise': return 'destructive';
      default: return 'default';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'basic': return Users;
      case 'standard': return TrendingUp;
      case 'premium': return Star;
      case 'enterprise': return CheckCircle;
      default: return Users;
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
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Clientes</h1>
              <p className="text-muted-foreground">Gerencie clientes e suas instâncias WhatsApp</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={loadClients} variant="outline" disabled={loading} size="sm">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline ml-2">Atualizar</span>
              </Button>
              <Button onClick={() => setShowCreateForm(true)} size="sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Novo Cliente</span>
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="ml-2 text-sm font-medium">Total</span>
                </div>
                <div className="text-2xl font-bold">{clients.length}</div>
                <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="ml-2 text-sm font-medium">Instâncias</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {clients.reduce((sum, c) => sum + (c.current_instances || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">Ativas no total</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="ml-2 text-sm font-medium">Básico</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {clients.filter(c => c.plan === 'basic').length}
                </div>
                <p className="text-xs text-muted-foreground">Plano básico</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-purple-600" />
                  <span className="ml-2 text-sm font-medium">Premium+</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {clients.filter(c => c.plan === 'premium' || c.plan === 'enterprise').length}
                </div>
                <p className="text-xs text-muted-foreground">Planos premium</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-4 w-4 text-orange-600" />
                  <span className="ml-2 text-sm font-medium">Ativos</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {clients.filter(c => (c.current_instances || 0) > 0).length}
                </div>
                <p className="text-xs text-muted-foreground">Com instâncias</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar clientes por nome, email ou empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="all">Todos os planos</option>
                    <option value="basic">Básico</option>
                    <option value="standard">Padrão</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="all">Todos status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Client Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Criar Novo Cliente</CardTitle>
                <CardDescription>Preencha os dados do cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Nome *</label>
                    <Input
                      placeholder="Nome completo"
                      value={newClient.name}
                      onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Email *</label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={newClient.email}
                      onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Telefone</label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={newClient.phone}
                      onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Empresa</label>
                    <Input
                      placeholder="Nome da empresa"
                      value={newClient.company}
                      onChange={(e) => setNewClient(prev => ({ ...prev, company: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Plano</label>
                    <select
                      value={newClient.plan}
                      onChange={(e) => setNewClient(prev => ({ ...prev, plan: e.target.value as any }))}
                      className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="basic">Básico (1 instância)</option>
                      <option value="standard">Padrão (3 instâncias)</option>
                      <option value="premium">Premium (10 instâncias)</option>
                      <option value="enterprise">Enterprise (50 instâncias)</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleCreateClient} disabled={loading} className="flex-1 sm:flex-none">
                    {loading ? "Criando..." : "Criar Cliente"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)} className="flex-1 sm:flex-none">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clients List */}
          <div className="space-y-4">
            {filteredClients.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="text-center">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {clients.length === 0 ? "Nenhum cliente criado" : "Nenhum cliente encontrado"}
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                      {clients.length === 0 
                        ? "Crie seu primeiro cliente usando o botão 'Novo Cliente'"
                        : "Tente ajustar os termos de busca ou filtros"
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
              filteredClients.map((client) => {
                const PlanIcon = getPlanIcon(client.plan);
                const instanceCount = client.current_instances || 0;
                
                return (
                  <Card key={client.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Client Info */}
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg truncate">{client.name}</h3>
                              <Badge variant={getPlanColor(client.plan)} className="shrink-0">
                                <PlanIcon className="w-3 h-3 mr-1" />
                                {client.plan}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span className="truncate">{client.email}</span>
                                </div>
                                {client.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    <span>{client.phone}</span>
                                  </div>
                                )}
                                {client.company && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="w-4 h-4" />
                                    <span className="truncate">{client.company}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  <span className={getStatusColor(instanceCount)}>
                                    {getStatusText(instanceCount)}
                                  </span>
                                </div>
                                <div>
                                  {instanceCount}/{getMaxInstancesForPlan(client.plan)} instâncias
                                </div>
                                <div>
                                  ID: {client.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 lg:shrink-0">
                          <div className="hidden sm:flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenClientPanel(client)}
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span className="hidden md:inline ml-2">Painel</span>
                            </Button>
                            
                            <Button
                              size="sm"
                              onClick={() => handleOpenChat(client)}
                              disabled={instanceCount === 0}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span className="hidden md:inline ml-2">Chat</span>
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteClient(client.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden md:inline ml-2">Remover</span>
                            </Button>
                          </div>
                          
                          {/* Mobile buttons */}
                          <div className="flex sm:hidden gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenClientPanel(client)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              onClick={() => handleOpenChat(client)}
                              disabled={instanceCount === 0}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteClient(client.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="mt-4 pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Última atividade: {new Date(client.last_activity).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
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
