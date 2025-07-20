
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Activity, 
  MessageSquare, 
  TrendingUp, 
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Ticket,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronRight
} from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useNavigate } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";

const AdminOverview = () => {
  const { stats, recentActivity, messageStats, loading, error, refreshStats } = useAdminStats();
  const navigate = useNavigate();

  const getActivityIcon = (type: string, status: string) => {
    switch (type) {
      case 'instance_connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'instance_disconnected':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'ticket_created':
        return <Ticket className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}min atrás`;
    return 'Agora mesmo';
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-600">Carregando estatísticas do sistema...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-red-600">Erro ao carregar estatísticas: {error}</p>
          </div>
          <Button onClick={refreshStats} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600">Visão geral em tempo real do sistema WhatsApp SaaS</p>
        </div>
        <Button onClick={refreshStats} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* System Status */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Server className="w-5 h-5" />
            <span>Status do Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {stats?.serverStatus === 'online' ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  Servidor: {stats?.serverStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              {stats?.serverStatus === 'online' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Clock className="w-3 h-3 mr-1" />
                  Uptime: {stats.serverUptime}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Última verificação: {stats?.lastActivity ? formatTimestamp(stats.lastActivity) : 'Nunca'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados na plataforma
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias WhatsApp</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.activeInstances || 0}/{stats?.totalInstances || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Instâncias conectadas agora
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total processadas • {stats?.messagesToday || 0} hoje
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Ticket className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.openTickets || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tickets abertos • {stats?.totalTickets || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Mensagens (7 dias)</span>
            </CardTitle>
            <CardDescription>Fluxo de mensagens nos últimos dias</CardDescription>
          </CardHeader>
          <CardContent>
            {messageStats.length > 0 ? (
              <ChartContainer
                config={{
                  count: {
                    label: "Mensagens",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messageStats}>
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500">
                Nenhum dado de mensagens disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas ações no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    {getActivityIcon(activity.type, activity.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma atividade recente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Operações frequentes do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-between" 
              variant="outline"
              onClick={() => navigate('/admin/clients')}
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Gerenciar Clientes
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between" 
              variant="outline"
              onClick={() => navigate('/admin/instances')}
            >
              <div className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Monitorar Instâncias
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between" 
              variant="outline"
              onClick={() => navigate('/admin/logs')}
            >
              <div className="flex items-center">
                <Server className="w-4 h-4 mr-2" />
                Ver Logs do Sistema
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
            <CardDescription>Detalhes técnicos da plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Versão:</span>
              <Badge variant="outline">2.0.0</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ambiente:</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Produção
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Performance:</span>
              <Badge variant="outline" className={
                stats?.serverStatus === 'online' 
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }>
                {stats?.serverStatus === 'online' ? '100%' : '0%'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Última Sync:</span>
              <span className="text-sm">
                {stats?.lastActivity ? formatTimestamp(stats.lastActivity) : 'Nunca'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
