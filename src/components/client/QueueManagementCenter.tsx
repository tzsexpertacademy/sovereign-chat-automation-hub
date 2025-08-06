/**
 * Centro de Gerenciamento de Filas - VERSÃO MODERNA
 * Interface redesenhada baseada no padrão YUMER
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Plus, 
  Users, 
  BarChart3, 
  Activity,
  Clock,
  TrendingUp,
  Bot,
  MessageSquare,
  Timer,
  Target,
  Zap,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queuesService, type QueueWithAssistant } from '@/services/queuesService';
import { assistantsService, type AssistantWithQueues } from '@/services/assistantsService';
import { queueOrchestrationService } from '@/services/queueOrchestrationService';
import { queueMetricsService, type QueueMetrics } from '@/services/queueMetricsService';
import { supabase } from '@/integrations/supabase/client';
import QueuesKanbanView from './QueuesKanbanView';
import QueueForm from './QueueForm';
import QueueTriggersManager from './QueueTriggersManager';

interface QueueManagementCenterProps {
  clientId?: string;
}

const QueueManagementCenter: React.FC<QueueManagementCenterProps> = ({ clientId: propClientId }) => {
  const params = useParams<{ clientId: string }>();
  const clientId = propClientId || params.clientId;
  const { toast } = useToast();
  
  // Estados principais
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [assistants, setAssistants] = useState<AssistantWithQueues[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Estados de UI
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [editingQueue, setEditingQueue] = useState<QueueWithAssistant | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  // Auto-refresh a cada 2 minutos para evitar loop infinito
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && clientId) {
      interval = setInterval(() => {
        loadData(true); // refresh silencioso
      }, 120000); // 2 minutos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, clientId]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      
      const [queuesData, assistantsData, instancesData, metricsData] = await Promise.all([
        queuesService.getClientQueues(clientId!),
        assistantsService.getClientAssistants(clientId!),
        loadInstances(),
        queueMetricsService.getQueueMetrics(clientId!)
      ]);

      setQueues(queuesData);
      setAssistants(assistantsData);
      setInstances(instancesData);
      setMetrics(metricsData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      if (!silent) {
        toast({
          title: "Erro",
          description: "Erro ao carregar dados das filas",
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const loadInstances = async () => {
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'connected');

    if (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
      return [];
    }

    return data || [];
  };

  const handleCreateQueue = () => {
    setEditingQueue(null);
    setShowQueueForm(true);
  };

  const handleEditQueue = (queue: QueueWithAssistant) => {
    setEditingQueue(queue);
    setShowQueueForm(true);
  };

  const handleQueueSaved = () => {
    setShowQueueForm(false);
    setEditingQueue(null);
    loadData();
    toast({
      title: "✅ Sucesso",
      description: "Fila salva com sucesso!"
    });
  };

  const handleConnectInstance = async (instanceId: string, queueId: string) => {
    try {
      await queuesService.connectInstanceToQueue(instanceId, queueId);
      
      toast({
        title: "✅ Sucesso",
        description: "Instância conectada à fila"
      });
      
      loadData();

    } catch (error) {
      console.error('❌ Erro ao conectar instância:', error);
      toast({
        title: "Erro",
        description: "Erro ao conectar instância à fila",
        variant: "destructive"
      });
    }
  };

  // Cálculos de estatísticas globais
  const globalStats = {
    activeQueues: queues.filter(q => q.is_active).length,
    totalTickets: metrics.reduce((sum, m) => sum + m.active_tickets, 0),
    pendingTickets: metrics.reduce((sum, m) => sum + m.pending_tickets, 0),
    avgResponseTime: Math.round(metrics.reduce((sum, m) => sum + m.avg_response_time_minutes, 0) / (metrics.length || 1)),
    aiSuccessRate: Math.round(metrics.reduce((sum, m) => sum + m.ai_success_rate, 0) / (metrics.length || 1)),
    resolvedToday: metrics.reduce((sum, m) => sum + m.resolved_tickets, 0)
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando sistema de filas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* Header Moderno com Gradiente */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Sistema de Filas YUMER
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Gestão inteligente de atendimento com IA
              </p>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-background/50">
                  {globalStats.activeQueues} filas ativas
                </Badge>
                <Badge variant="outline" className="bg-background/50">
                  {globalStats.totalTickets} tickets ativos
                </Badge>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Última atualização</p>
                <p className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="gap-2 min-w-20"
                >
                  <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Auto</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12 bg-background/80 backdrop-blur-sm">
          <TabsTrigger value="kanban" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80">
            <Activity className="h-4 w-4" />
            Kanban Visual
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="queues" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80">
            <Users className="h-4 w-4" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="triggers" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80">
            <Settings className="h-4 w-4" />
            Gatilhos
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80">
            <TrendingUp className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6">
          {/* Cards de Estatísticas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tickets Ativos</p>
                    <p className="text-3xl font-bold text-blue-600">{globalStats.totalTickets}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalStats.pendingTickets} pendentes
                    </p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Filas Ativas</p>
                    <p className="text-3xl font-bold text-green-600">{globalStats.activeQueues}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {assistants.length} assistentes
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Taxa IA</p>
                    <p className="text-3xl font-bold text-purple-600">{globalStats.aiSuccessRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Taxa de sucesso
                    </p>
                  </div>
                  <Bot className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tempo Resp.</p>
                    <p className="text-3xl font-bold text-orange-600">{globalStats.avgResponseTime}min</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tempo médio
                    </p>
                  </div>
                  <Timer className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance das Filas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance das Filas
                </CardTitle>
                <CardDescription>
                  Status em tempo real de cada fila
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.slice(0, 5).map((queue) => {
                    const queueMetrics = metrics.find(m => m.queue_id === queue.id);
                    const workloadScore = queueMetrics?.workload_score || 0;
                    
                    return (
                      <div key={queue.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <p className="font-medium">{queue.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {queueMetrics?.active_tickets || 0} tickets ativos
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={workloadScore < 30 ? "default" : workloadScore < 70 ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {workloadScore}% carga
                          </Badge>
                          {queue.assistants && (
                            <Badge variant="outline" className="text-xs">
                              <Bot className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Metas e Alertas
                </CardTitle>
                <CardDescription>
                  Indicadores de performance e SLA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">SLA em dia</p>
                      <p className="text-sm text-green-600">{globalStats.resolvedToday} tickets resolvidos hoje</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">Tempo médio OK</p>
                      <p className="text-sm text-yellow-600">Meta: &lt; 5min (atual: {globalStats.avgResponseTime}min)</p>
                    </div>
                  </div>

                  {globalStats.pendingTickets > 10 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-medium text-red-800">Muitos tickets pendentes</p>
                        <p className="text-sm text-red-600">{globalStats.pendingTickets} tickets aguardando</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-800">IA Performando</p>
                      <p className="text-sm text-purple-600">{globalStats.aiSuccessRate}% de taxa de sucesso</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* KANBAN VISUAL - PRIORIDADE PRINCIPAL */}
        <TabsContent value="kanban" className="space-y-6">
          {/* Métricas sempre visíveis no topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tickets Ativos</p>
                    <p className="text-xl md:text-2xl font-bold text-blue-600">{globalStats.totalTickets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Filas Ativas</p>
                    <p className="text-xl md:text-2xl font-bold text-green-600">{globalStats.activeQueues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Taxa IA</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-600">{globalStats.aiSuccessRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Timer className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tempo Resp.</p>
                    <p className="text-xl md:text-2xl font-bold text-orange-600">{globalStats.avgResponseTime}min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <QueuesKanbanView clientId={clientId!} />
        </TabsContent>

        {/* GERENCIAMENTO DE FILAS */}
        <TabsContent value="queues" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Gerenciar Filas</h2>
              <p className="text-sm md:text-base text-muted-foreground">Configure e monitore suas filas de atendimento</p>
            </div>
            <Button onClick={handleCreateQueue} className="gap-2 w-full md:w-auto">
              <Plus className="h-4 w-4" />
              Nova Fila
            </Button>
          </div>

          <div className="grid gap-4">
            {queues.map((queue) => {
              const queueMetrics = metrics.find(m => m.queue_id === queue.id);
              
              return (
                <Card key={queue.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <h3 className="text-lg font-semibold">{queue.name}</h3>
                          <Badge variant={queue.is_active ? "default" : "secondary"}>
                            {queue.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          {queue.auto_assignment && (
                            <Badge variant="outline">Auto</Badge>
                          )}
                        </div>
                        
                        <p className="text-muted-foreground">
                          {queue.description || "Sem descrição"}
                        </p>
                        
                        {/* Métricas da fila */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{queueMetrics?.active_tickets || 0}</p>
                            <p className="text-xs text-blue-600">Ativos</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{queueMetrics?.resolved_tickets || 0}</p>
                            <p className="text-xs text-green-600">Resolvidos</p>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">{Math.round(queueMetrics?.ai_success_rate || 0)}%</p>
                            <p className="text-xs text-purple-600">Taxa IA</p>
                          </div>
                          <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">{Math.round(queueMetrics?.avg_response_time_minutes || 0)}min</p>
                            <p className="text-xs text-orange-600">Resp. Média</p>
                          </div>
                        </div>

                        {queue.assistants && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Bot className="h-4 w-4 text-purple-500" />
                            <span>Assistente: {queue.assistants.name}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditQueue(queue)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* GATILHOS AUTOMÁTICOS */}
        <TabsContent value="triggers" className="space-y-6">
          <QueueTriggersManager 
            clientId={clientId!} 
            queues={queues}
            onTriggersUpdated={() => loadData()}
          />
        </TabsContent>

        {/* MÉTRICAS DETALHADAS */}
        <TabsContent value="metrics" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Análise de Performance</h2>
            <p className="text-muted-foreground">Métricas detalhadas e tendências das filas</p>
          </div>

          <div className="grid gap-6">
            {metrics.map((metric) => {
              const queue = queues.find(q => q.id === metric.queue_id);
              if (!queue) return null;

              return (
                <Card key={metric.queue_id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {metric.queue_name}
                    </CardTitle>
                    <CardDescription>
                      Métricas detalhadas das últimas 24 horas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-blue-600">{metric.active_tickets}</p>
                        <p className="text-sm text-muted-foreground">Tickets Ativos</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">{metric.resolved_tickets}</p>
                        <p className="text-sm text-muted-foreground">Resolvidos Hoje</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-purple-600">{Math.round(metric.ai_success_rate)}%</p>
                        <p className="text-sm text-muted-foreground">Taxa de IA</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-orange-600">{Math.round(metric.avg_response_time_minutes)}min</p>
                        <p className="text-sm text-muted-foreground">Tempo Resposta</p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-lg font-semibold">{metric.total_conversations}</p>
                        <p className="text-xs text-muted-foreground">Total Conversas</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-lg font-semibold">{Math.round(metric.workload_score)}%</p>
                        <p className="text-xs text-muted-foreground">Carga de Trabalho</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-lg font-semibold">{Math.round(metric.customer_satisfaction_avg * 10) / 10}</p>
                        <p className="text-xs text-muted-foreground">Satisfação (1-5)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

        {/* Modal de Formulário */}
        {showQueueForm && (
          <QueueForm
            clientId={clientId!}
            queue={editingQueue}
            assistants={assistants}
            onSave={handleQueueSaved}
            onCancel={() => setShowQueueForm(false)}
          />
        )}
      </div>
    </div>
  );
};

export default QueueManagementCenter;