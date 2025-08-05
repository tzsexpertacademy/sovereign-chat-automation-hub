import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import RealTimeMetricsCard from "./RealTimeMetricsCard";
import SystemHealthIndicator from "./SystemHealthIndicator";
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
  Activity,
  BarChart3,
  Zap,
  Target,
  Star
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
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

  const performanceData = [
    { name: 'Taxa de Sucesso', value: metrics.responseRate, color: 'hsl(var(--primary))' },
    { name: 'Pendente', value: 100 - metrics.responseRate, color: 'hsl(var(--muted))' }
  ];

  return (
    <div className="space-y-8">
      {/* Header com Status de Conexão */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Acompanhe suas métricas em tempo real
            </p>
          </div>
          <SystemHealthIndicator clientId={clientId} />
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RealTimeMetricsCard
          title="Conversas Ativas"
          value={metrics.openTickets + metrics.pendingTickets}
          subtitle={`${metrics.openTickets} abertas, ${metrics.pendingTickets} aguardando`}
          icon={MessageSquare}
          trend={{
            value: 12,
            isPositive: true
          }}
          badge={{
            text: connectionStatus.label,
            variant: connectionStatus.status === "success" ? "default" : 
                    connectionStatus.status === "warning" ? "secondary" : "destructive"
          }}
        />

        <RealTimeMetricsCard
          title="Taxa de Sucesso"
          value={`${metrics.responseRate.toFixed(1)}%`}
          subtitle={`${metrics.closedTickets} conversas resolvidas`}
          icon={Target}
          progress={{
            value: metrics.responseRate
          }}
          trend={{
            value: 8,
            isPositive: true
          }}
        />

        <RealTimeMetricsCard
          title="Tempo de Resposta"
          value={`${metrics.averageResponseTime}min`}
          subtitle="Média das últimas 24h"
          icon={Zap}
          badge={{
            text: metrics.averageResponseTime < 30 ? "Excelente" : "Bom",
            variant: metrics.averageResponseTime < 30 ? "default" : "secondary"
          }}
          trend={{
            value: 5,
            isPositive: false
          }}
        />

        <RealTimeMetricsCard
          title="Atendimentos Hoje"
          value={metrics.messagesLast24h}
          subtitle="Mensagens processadas"
          icon={BarChart3}
          trend={{
            value: 15,
            isPositive: true
          }}
        />
      </div>

      {/* Status dos Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                WhatsApp
              </CardTitle>
              <Badge variant={metrics.activeConnections > 0 ? "default" : "secondary"}>
                {metrics.activeConnections > 0 ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Instâncias ativas</span>
                <span className="font-medium">{metrics.activeConnections}/{metrics.totalConnections}</span>
              </div>
              <Progress value={(metrics.activeConnections / Math.max(metrics.totalConnections, 1)) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-emerald-600" />
                Assistentes IA
              </CardTitle>
              <Badge variant={metrics.activeAssistants > 0 ? "default" : "secondary"}>
                {metrics.activeAssistants} Ativos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Disponíveis</span>
                <span className="font-medium">{metrics.activeAssistants}/{metrics.totalAssistants}</span>
              </div>
              <Progress value={(metrics.activeAssistants / Math.max(metrics.totalAssistants, 1)) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Filas de Atendimento
              </CardTitle>
              <Badge variant={metrics.activeQueues > 0 ? "default" : "secondary"}>
                {metrics.activeQueues} Ativas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Configuradas</span>
                <span className="font-medium">{metrics.activeQueues}/{metrics.totalQueues}</span>
              </div>
              <Progress value={(metrics.activeQueues / Math.max(metrics.totalQueues, 1)) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics e Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Atividade das Últimas 24h */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Atividade das Últimas 24h</span>
            </CardTitle>
            <CardDescription>
              Volume de conversas e resolução por hora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  name="Conversas"
                />
                <Line 
                  type="monotone" 
                  dataKey="resolved" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Resolvidas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Geral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span>Performance</span>
            </CardTitle>
            <CardDescription>
              Taxa de sucesso geral
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-sm">Taxa de Sucesso</span>
                </div>
                <span className="font-semibold">{metrics.responseRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted"></div>
                  <span className="text-sm">Em andamento</span>
                </div>
                <span className="font-semibold">{(100 - metrics.responseRate).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance das Filas */}
      {queueMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Performance das Filas</span>
            </CardTitle>
            <CardDescription>
              Eficiência por fila de atendimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={queueMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="queueName" 
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="resolutionRate" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="Taxa de Resolução (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Resumo Executivo */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Resumo Executivo - Últimas 24h</span>
          </CardTitle>
          <CardDescription>
            Principais indicadores de desempenho
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">{metrics.messagesLast24h}</div>
              <p className="text-sm text-muted-foreground font-medium">Conversas Iniciadas</p>
            </div>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-emerald-600">{metrics.closedTickets}</div>
              <p className="text-sm text-muted-foreground font-medium">Resoluções</p>
            </div>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-blue-600">{metrics.averageResponseTime}min</div>
              <p className="text-sm text-muted-foreground font-medium">Tempo Médio</p>
            </div>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-purple-600">{metrics.responseRate.toFixed(0)}%</div>
              <p className="text-sm text-muted-foreground font-medium">Taxa de Sucesso</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboardOverview;