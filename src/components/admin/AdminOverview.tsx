
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Activity, 
  CreditCard, 
  AlertCircle, 
  TrendingUp, 
  MessageSquare,
  Wifi,
  Target,
  DollarSign,
  Clock,
  RefreshCw,
  BarChart3
} from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";
import { MetricsCharts } from "./MetricsCharts";
import { SystemHealthCard } from "./SystemHealthCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { AudioTestButton } from "./AudioTestButton";
import { EmergencyRecoveryPanel } from "./EmergencyRecoveryPanel";

const AdminOverview = () => {
  const { stats, recentActivity, loading, error, refreshStats } = useAdminStats();

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-8">
      {/* KPIs Principais - 6 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.growthRate && stats.growthRate > 0 ? `+${formatPercentage(stats.growthRate)}` : '0%'} este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.activeInstances || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {stats?.totalInstances || 0} instâncias totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.totalMRR || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita mensal recorrente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Taxa Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatPercentage(stats?.conversionRate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes ativos vs total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Hoje</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ticketsPerDay || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.openTickets || 0} tickets abertos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Secundárias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Média Instâncias/Cliente</p>
                <p className="text-2xl font-bold">{stats?.avgInstancesPerClient || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Tempo Resposta</p>
                <p className="text-2xl font-bold">{stats?.avgResponseTime || 0}s</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Uptime Sistema</p>
                <p className="text-2xl font-bold">{formatPercentage(stats?.systemUptime || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Retenção</p>
                <p className="text-2xl font-bold">{formatPercentage(stats?.clientRetentionRate || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {stats && (
        <MetricsCharts
          messagesByDay={stats.messagesByDay || []}
          instancesDistribution={stats.instancesDistribution || []}
          recentGrowth={stats.recentGrowth || []}
        />
      )}

      {/* Painel de Recuperação Emergencial */}
      <EmergencyRecoveryPanel />

      {/* Seção de Status e Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemHealthCard
          serverStatus={stats?.serverStatus || 'offline'}
          serverUptime={stats?.serverUptime || 'N/A'}
          systemUptime={stats?.systemUptime || 0}
          avgResponseTime={stats?.avgResponseTime || 0}
          onRefresh={refreshStats}
        />
        
        <RecentActivityCard 
          activities={recentActivity || []}
        />
      </div>

      {/* Ferramentas de Debug */}
      <Card>
        <CardHeader>
          <CardTitle>Ferramentas de Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <AudioTestButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
