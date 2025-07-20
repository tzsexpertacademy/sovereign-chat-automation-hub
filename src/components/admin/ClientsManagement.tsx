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
  CreditCard,
  TrendingUp,
  DollarSign,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData, CreateClientData } from "@/services/clientsService";

const ClientsManagement = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [newClient, setNewClient] = useState<CreateClientData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    plan: "basic"
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);
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
        description: `Cliente ${clientData.name} criado com sucesso!`,
      });

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

  // Filtros avançados
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.company && client.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPlan = selectedPlan === "all" || client.plan === selectedPlan;
    const matchesStatus = selectedStatus === "all" || client.subscription_status === selectedStatus;
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Estatísticas calculadas
  const stats = {
    total: clients.length,
    active: clients.filter(c => c.subscription_status === 'active').length,
    trial: clients.filter(c => c.subscription_status === 'trialing').length,
    totalMRR: clients.reduce((sum, c) => sum + (c.mrr || 0), 0),
    activeInstances: clients.reduce((sum, c) => sum + (c.current_instances || 0), 0)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'trialing': return 'bg-warning text-warning-foreground';
      case 'past_due': return 'bg-destructive text-destructive-foreground';
      case 'canceled': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'standard': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'premium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'enterprise': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie clientes, assinaturas e instâncias WhatsApp
          </p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={loadClients} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="bg-primary">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Métricas do Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Ativos</CardTitle>
              <Shield className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <p className="text-xs text-success">Com assinatura ativa</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Trial</CardTitle>
              <TrendingUp className="w-4 h-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.trial}</div>
            <p className="text-xs text-warning">Período de teste</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatCurrency(stats.totalMRR)}</div>
            <p className="text-xs text-accent">Receita mensal</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instâncias Ativas</CardTitle>
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.activeInstances}</div>
            <p className="text-xs text-blue-500">WhatsApp conectado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="all">Todos os Planos</option>
                <option value="basic">Básico</option>
                <option value="standard">Padrão</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Ativo</option>
                <option value="trialing">Trial</option>
                <option value="past_due">Em Atraso</option>
                <option value="canceled">Cancelado</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Formulário de Criação */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Cliente</CardTitle>
            <CardDescription>Preencha os dados do cliente. A integração com Stripe será feita automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nome *</label>
                <Input
                  placeholder="Nome completo"
                  value={newClient.name}
                  onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email *</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Telefone</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={newClient.phone}
                  onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Empresa</label>
                <Input
                  placeholder="Nome da empresa"
                  value={newClient.company}
                  onChange={(e) => setNewClient(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
              <div className="col-span-full">
                <label className="text-sm font-medium text-foreground">Plano</label>
                <select
                  value={newClient.plan}
                  onChange={(e) => setNewClient(prev => ({ ...prev, plan: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="basic">Básico - 1 instância ($29/mês)</option>
                  <option value="standard">Padrão - 3 instâncias ($79/mês)</option>
                  <option value="premium">Premium - 10 instâncias ($149/mês)</option>
                  <option value="enterprise">Enterprise - 50 instâncias ($299/mês)</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3">
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

      {/* Lista de Clientes */}
      <div className="grid gap-4">
        {filteredClients.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {clients.length === 0 ? "Nenhum cliente criado" : "Nenhum cliente encontrado"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {clients.length === 0 
                    ? "Crie seu primeiro cliente ou aguarde a integração automática via Stripe"
                    : "Tente ajustar os filtros de busca"
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
            <Card key={client.id} className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{client.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
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
                    {/* Status e Plano */}
                    <div className="text-center">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getPlanColor(client.plan)} variant="outline">
                          {client.plan.toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(client.subscription_status)}>
                          {client.subscription_status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{client.current_instances || 0}/{getMaxInstancesForPlan(client.plan)} instâncias</span>
                        {client.mrr > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-success">{formatCurrency(client.mrr)}/mês</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenClientPanel(client)}
                        className="border-primary/20 hover:bg-primary/10"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Painel
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handleOpenChat(client)}
                        disabled={!client.current_instances || client.current_instances === 0}
                        className="bg-success hover:bg-success/90"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Chat
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClient(client.id)}
                        className="border-destructive/20 hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-4 text-muted-foreground">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-1" />
                        Última atividade: {new Date(client.last_activity).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    {client.stripe_customer_id && (
                      <div className="flex items-center text-primary">
                        <CreditCard className="w-4 h-4 mr-1" />
                        <span className="text-xs">Stripe integrado</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Indicador de Resultados */}
      {clients.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Mostrando {filteredClients.length} de {clients.length} clientes
        </div>
      )}
    </div>
  );
};

export default ClientsManagement;