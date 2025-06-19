import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, Play, Pause, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ClientsManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const clients = [
    {
      id: "1",
      name: "Empresa ABC Ltda",
      email: "contato@empresaabc.com",
      status: "active" as const,
      plan: "Pro",
      whatsappStatus: "connected" as const,
      messages: "1,247",
      lastActivity: "2 min",
      created: "15/01/2024"
    },
    {
      id: "2", 
      name: "Loja XYZ",
      email: "admin@lojaxyz.com",
      status: "active" as const,
      plan: "Business",
      whatsappStatus: "connected" as const,
      messages: "856",
      lastActivity: "5 min",
      created: "10/01/2024"
    },
    {
      id: "3",
      name: "Consultoria DEF",
      email: "contato@consultoriadef.com",
      status: "inactive" as const,
      plan: "Starter",
      whatsappStatus: "disconnected" as const,
      messages: "432",
      lastActivity: "2h",
      created: "05/01/2024"
    },
    {
      id: "4",
      name: "E-commerce GHI",
      email: "suporte@ecommerceghi.com",
      status: "active" as const,
      plan: "Enterprise",
      whatsappStatus: "connected" as const,
      messages: "2,134",
      lastActivity: "1 min",
      created: "01/01/2024"
    }
  ];

  const getStatusBadge = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'active':
        return "default";
      case 'inactive':
        return "secondary";
      case 'suspended':
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getWhatsAppStatusBadge = (status: string): "default" | "secondary" => {
    return status === "connected" ? "default" : "secondary";
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
        <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-green-600">+3 este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">42</div>
            <p className="text-xs text-gray-500">89% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">38</div>
            <p className="text-xs text-gray-500">WhatsApp online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">R$ 15.2K</div>
            <p className="text-xs text-green-600">+18% vs mês anterior</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>Gerencie contas e instâncias WhatsApp</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Mensagens</TableHead>
                <TableHead>Última Atividade</TableHead>
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
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getWhatsAppStatusBadge(client.whatsappStatus)}>
                      {client.whatsappStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{client.messages}</TableCell>
                  <TableCell className="text-gray-500">{client.lastActivity}</TableCell>
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
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar Instância
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pause className="w-4 h-4 mr-2" />
                          Pausar Instância
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsManagement;
