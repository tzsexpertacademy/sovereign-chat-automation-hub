import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import RealTimeMetricsCard from "./RealTimeMetricsCard";
import { 
  Users, 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  Phone,
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  Activity
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { realTimeMetricsService, DashboardMetrics, HourlyActivity, QueueMetrics } from "@/services/realTimeMetricsService";
import { useToast } from "@/hooks/use-toast";

interface ClientDashboardOverviewProps {
  clientId: string;
}

const ClientDashboardOverview = ({ clientId }: ClientDashboardOverviewProps) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [hourlyActivity, setHourlyActivity] = useState<HourlyActivity[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  const { toast } = useToast();

  const loadMetrics = async () => {
    if (!isMounted || !clientId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [dashboardData, hourlyData, queueData] = await Promise.all([
        realTimeMetricsService.getDashboardMetrics(clientId),
        realTimeMetricsService.getHourlyActivity(clientId),
        realTimeMetricsService.getQueueMetrics(clientId)
      ]);

      if (isMounted) {
        setMetrics(dashboardData);
        setHourlyActivity(hourlyData);
        setQueueMetrics(queueData);
      }
    } catch (error) {
      console.error('🚨 Erro ao carregar métricas do dashboard:', error);
      if (isMounted) {
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
        toast({
          title: "Erro no Dashboard",
          description: "Não foi possível carregar as métricas. Tentando novamente...",
          variant: "destructive",
        });
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    let unsubscribe: (() => void) | undefined;

    const setupDashboard = async () => {
      try {
        // Carregar métricas iniciais
        await loadMetrics();

        // Configurar subscrição realtime com debounce
        let timeoutId: NodeJS.Timeout;
        const debouncedCallback = () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isMounted) {
              loadMetrics();
            }
          }, 1000); // Debounce de 1 segundo
        };

        unsubscribe = realTimeMetricsService.subscribeToMetrics(clientId, debouncedCallback);
      } catch (error) {
        console.error('🚨 Erro ao configurar dashboard:', error);
        if (isMounted) {
          setError('Erro ao configurar dashboard');
        }
      }
    };

    setupDashboard();

    return () => {
      setIsMounted(false);
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('⚠️ Erro ao fazer cleanup do dashboard:', error);
        }
      }
    };
  }, [clientId]);

  // Mostrar erro se houver
  if (error && !loading) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro no Dashboard</span>
          </CardTitle>
          <CardDescription>
            Ocorreu um erro ao carregar as métricas: {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button 
            onClick={loadMetrics}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar Novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getConnectionStatus = () => {
    const percentage = metrics.totalConnections > 0 
      ? (metrics.activeConnections / metrics.totalConnections) * 100 
      : 0;
    
    if (percentage >= 80) return { status: "success", label: "Excelente" };
    if (percentage >= 60) return { status: "warning", label: "Bom" };
    return { status: "error", label: "Atenção" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Conexões */}
        <RealTimeMetricsCard
          title="Conexões WhatsApp"
          value={`${metrics.activeConnections}/${metrics.totalConnections}`}
          subtitle="WhatsApp conectados"
          icon={Phone}
          progress={{
            value: metrics.activeConnections,
            max: metrics.totalConnections
          }}
          badge={{
            text: connectionStatus.label,
            variant: connectionStatus.status === "success" ? "default" : 
                    connectionStatus.status === "warning" ? "secondary" : "destructive"
          }}
        />

        {/* Tickets */}
        <RealTimeMetricsCard
          title="Tickets Ativos"
          value={metrics.openTickets + metrics.pendingTickets}
          subtitle={`${metrics.openTickets} abertos, ${metrics.pendingTickets} pendentes`}
          icon={MessageSquare}
          badge={metrics.openTickets > 10 ? {
            text: "Alta demanda",
            variant: "destructive"
          } : undefined}
        />

        {/* Taxa de Resposta */}
        <RealTimeMetricsCard
          title="Taxa de Resolução"
          value={`${metrics.responseRate.toFixed(1)}%`}
          subtitle={`${metrics.closedTickets} de ${metrics.totalTickets} tickets`}
          icon={CheckCircle2}
          progress={{
            value: metrics.responseRate
          }}
        />

        {/* Tempo Médio */}
        <RealTimeMetricsCard
          title="Tempo Médio"
          value={`${metrics.averageResponseTime}min`}
          subtitle="Tempo médio de resposta"
          icon={Clock}
          badge={{
            text: metrics.averageResponseTime < 30 ? "Rápido" : "Moderado",
            variant: metrics.averageResponseTime < 30 ? "default" : "secondary"
          }}
        />
      </div>

      {/* Cards de Status dos Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Filas */}
        <RealTimeMetricsCard
          title="Filas de Atendimento"
          value={metrics.activeQueues}
          subtitle={`${metrics.activeQueues} de ${metrics.totalQueues} ativas`}
          icon={Users}
        />

        {/* Assistentes */}
        <RealTimeMetricsCard
          title="Assistentes IA"
          value={metrics.activeAssistants}
          subtitle={`${metrics.activeAssistants} de ${metrics.totalAssistants} ativos`}
          icon={Bot}
        />

        {/* Campanhas */}
        <RealTimeMetricsCard
          title="Campanhas"
          value={metrics.activeCampaigns}
          subtitle={`${metrics.activeCampaigns} de ${metrics.totalCampaigns} ativas`}
          icon={Send}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade por Hora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Atividade das Últimas 24h</span>
            </CardTitle>
            <CardDescription>
              Mensagens e tickets por hora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Mensagens"
                />
                <Line 
                  type="monotone" 
                  dataKey="tickets" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  name="Tickets"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance das Filas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Performance das Filas</span>
            </CardTitle>
            <CardDescription>
              Taxa de resolução por fila
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={queueMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="queueName" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="resolutionRate" 
                  fill="hsl(var(--primary))"
                  name="Taxa de Resolução (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resumo da Atividade */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo das Últimas 24 Horas</CardTitle>
          <CardDescription>
            Principais métricas de atividade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics.messagesLast24h}</div>
              <p className="text-sm text-muted-foreground">Mensagens Processadas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics.closedTickets}</div>
              <p className="text-sm text-muted-foreground">Tickets Resolvidos</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics.activeConnections}</div>
              <p className="text-sm text-muted-foreground">Conexões Ativas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics.activeAssistants}</div>
              <p className="text-sm text-muted-foreground">Assistentes Trabalhando</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboardOverview;