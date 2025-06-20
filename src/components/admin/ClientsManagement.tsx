
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
  RefreshCw
} from "lucide-react";
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
    company: ""
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
      });

      toast({
        title: "Sucesso",
        description: `Cliente ${clientData.name} criado com sucesso!`,
      });

      // Reset form and reload clients
      setNewClient({ name: "", email: "", phone: "", company: "" });
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

  const handleOpenDashboard = (client: ClientData) => {
    navigate(`/client/${client.id}/connect`);
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

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Com Instância</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {clients.filter(c => c.instance_id && c.instance_status === 'connected').length}
            </div>
            <p className="text-xs text-green-600">Conectados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Aguardando Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {clients.filter(c => !c.instance_id).length}
            </div>
            <p className="text-xs text-blue-600">Sem instância</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ativos Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {clients.filter(c => {
                const today = new Date().toDateString();
                return new Date(c.last_activity).toDateString() === today;
              }).length}
            </div>
            <p className="text-xs text-purple-600">Atividade hoje</p>
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
                    {/* Instance Status */}
                    <div className="text-center">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(client.instance_status)}`} />
                        <Badge variant={client.instance_status === 'connected' ? 'default' : 'secondary'}>
                          {getStatusText(client.instance_status)}
                        </Badge>
                      </div>
                      {client.instance_id && (
                        <p className="text-xs text-gray-500">ID: {client.instance_id}</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDashboard(client)}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Dashboard
                      </Button>
                      
                      {client.instance_status === 'connected' ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenChat(client)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDashboard(client)}
                        >
                          <Activity className="w-4 h-4 mr-1" />
                          Conectar
                        </Button>
                      )}
                      
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
