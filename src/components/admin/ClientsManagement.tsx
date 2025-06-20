
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: string;
  whatsappInstances: number;
  created: string;
}

const ClientsManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    plan: "Starter"
  });
  const { toast } = useToast();

  // Carregar clientes reais
  const loadClients = async () => {
    setLoading(true);
    try {
      // Aqui você pode implementar a chamada real para sua API
      // Por enquanto, mantemos uma lista vazia para começar
      setClients([]);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

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
      
      // Criar novo cliente
      const clientData: Client = {
        id: Date.now().toString(),
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        status: 'active',
        plan: newClient.plan,
        whatsappInstances: 0,
        created: new Date().toLocaleDateString('pt-BR')
      };

      setClients(prev => [...prev, clientData]);
      
      // Resetar formulário
      setNewClient({ name: "", email: "", plan: "Starter" });
      setShowCreateModal(false);

      toast({
        title: "Sucesso",
        description: `Cliente ${clientData.name} criado com sucesso!`,
      });

    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      toast({
        title: "Erro",
        description: "Falha ao criar cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      setClients(prev => prev.filter(c => c.id !== clientId));
      toast({
        title: "Sucesso",
        description: "Cliente removido com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover cliente",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'active': return "default";
      case 'inactive': return "secondary";
      case 'suspended': return "destructive";
      default: return "secondary";
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Clientes</h1>
          <p className="text-gray-600">Gerencie todos os clientes da plataforma</p>
        </div>
        
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Cliente</DialogTitle>
              <DialogDescription>
                Adicione um novo cliente ao sistema. Ele poderá criar suas próprias instâncias WhatsApp.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input
                  id="name"
                  placeholder="Ex: Empresa ABC Ltda"
                  value={newClient.name}
                  onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contato</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <select
                  id="plan"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newClient.plan}
                  onChange={(e) => setNewClient(prev => ({ ...prev, plan: e.target.value }))}
                >
                  <option value="Starter">Starter</option>
                  <option value="Pro">Pro</option>
                  <option value="Business">Business</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateClient} disabled={loading}>
                {loading ? "Criando..." : "Criar Cliente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
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
            <CardTitle className="text-sm font-medium text-gray-600">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {clients.filter(c => c.status === 'active').length}
            </div>
            <p className="text-xs text-gray-500">Clientes ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Instâncias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {clients.reduce((total, client) => total + client.whatsappInstances, 0)}
            </div>
            <p className="text-xs text-gray-500">Total de instâncias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {new Set(clients.map(c => c.plan)).size}
            </div>
            <p className="text-xs text-gray-500">Tipos diferentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>Gerencie contas e acesso ao sistema</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Instâncias</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(client.status)}>
                        {client.status === 'active' ? 'Ativo' : 
                         client.status === 'inactive' ? 'Inativo' : 'Suspenso'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{client.whatsappInstances}</TableCell>
                    <TableCell className="text-gray-500">{client.created}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteClient(client.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
              </div>
              {!searchTerm && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Cliente
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsManagement;
