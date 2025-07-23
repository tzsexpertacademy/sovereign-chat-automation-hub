
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, CreditCard, AlertCircle } from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";

const AdminOverview = () => {
  const { stats, loading, error } = useAdminStats();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carregando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao carregar estatísticas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados no sistema
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeInstances || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {stats?.totalInstances || 0} instâncias totais
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.messagesToday || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.messagesLastHour || 0} na última hora
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Servidor</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats?.serverStatus === 'online' ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {stats?.serverStatus || 'Desconhecido'}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {stats?.serverUptime || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão Geral do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total de Mensagens:</span>
              <span className="font-medium">{stats?.totalMessages || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tickets Abertos:</span>
              <span className="font-medium">{stats?.openTickets || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total de Tickets:</span>
              <span className="font-medium">{stats?.totalTickets || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Última Atividade:</span>
              <span className="font-medium">
                {stats?.lastActivity ? new Date(stats.lastActivity).toLocaleString('pt-BR') : 'N/A'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
