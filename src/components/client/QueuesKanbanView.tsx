import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Bot,
  Settings,
  Filter,
  RefreshCw,
  MessageSquare,
  Timer,
  Target,
  TrendingUp
} from 'lucide-react';
import { queueMetricsService, type QueueMetrics } from "@/services/queueMetricsService";
import { queuesService, type QueueWithAssistant } from "@/services/queuesService";
import { supabase } from "@/integrations/supabase/client";

interface TicketCard {
  id: string;
  title: string;
  customer_name: string;
  customer_phone: string;
  status: 'open' | 'pending' | 'in_progress' | 'resolved';
  priority: number;
  created_at: string;
  last_activity_at: string;
  assigned_assistant_id?: string;
  tags: string[];
  waiting_time_minutes: number;
  chat_id: string;
  instance_id: string;
}

interface QueuesKanbanViewProps {
  clientId: string;
}

const QueuesKanbanView: React.FC<QueuesKanbanViewProps> = ({ clientId }) => {
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [tickets, setTickets] = useState<Record<string, TicketCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    
    // Remover auto-refresh para evitar loop infinito
    // O refresh será feito apenas manualmente pelo usuário
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [queuesData, metricsData] = await Promise.all([
        queuesService.getClientQueues(clientId),
        queueMetricsService.getQueueMetrics(clientId)
      ]);

      setQueues(queuesData);
      setMetrics(metricsData);
      
      // Carregar tickets reais para cada fila
      await loadRealTicketsForQueues(queuesData);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das filas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRealTicketsForQueues = async (queuesList: QueueWithAssistant[]) => {
    const ticketsData: Record<string, TicketCard[]> = {};
    
    for (const queue of queuesList) {
      try {
        // Buscar tickets reais da fila
        const { data: realTickets, error } = await supabase
          .from('conversation_tickets')
          .select(`
            id,
            title,
            status,
            priority,
            created_at,
            last_activity_at,
            last_message_at,
            chat_id,
            instance_id,
            client_id,
            customers (
              name,
              phone
            )
          `)
          .eq('assigned_queue_id', queue.id)
          .in('status', ['open', 'pending', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Erro ao buscar tickets:', error);
          ticketsData[queue.id] = [];
          continue;
        }

        const mappedTickets: TicketCard[] = (realTickets || []).map(ticket => {
          const createdAt = new Date(ticket.created_at);
          const waitingTime = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60));
          
          return {
            id: ticket.id,
            title: ticket.title,
            customer_name: ticket.customers?.name || 'Cliente sem nome',
            customer_phone: ticket.customers?.phone || 'Telefone não informado',
            status: ticket.status as TicketCard['status'],
            priority: ticket.priority || 1,
            created_at: ticket.created_at,
            last_activity_at: ticket.last_activity_at || ticket.created_at,
            chat_id: ticket.chat_id,
            instance_id: ticket.instance_id,
            tags: [],
            waiting_time_minutes: waitingTime
          };
        });

        ticketsData[queue.id] = mappedTickets;
      } catch (error) {
        console.error(`Erro ao carregar tickets da fila ${queue.id}:`, error);
        ticketsData[queue.id] = [];
      }
    }
    
    setTickets(ticketsData);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }

    const ticketId = draggableId;
    const fromQueueId = source.droppableId;
    const toQueueId = destination.droppableId;

    try {
      // Atualizar no banco de dados
      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: toQueueId,
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Registrar transferência
      await queueMetricsService.transferTicketBetweenQueues(
        ticketId,
        fromQueueId,
        toQueueId,
        "Transferência manual via Kanban",
        "manual"
      );

      // Atualizar estado local
      const sourceTickets = tickets[fromQueueId] || [];
      const destTickets = tickets[toQueueId] || [];
      const movingTicket = sourceTickets.find(t => t.id === ticketId);

      if (movingTicket) {
        setTickets(prev => ({
          ...prev,
          [fromQueueId]: sourceTickets.filter(t => t.id !== ticketId),
          [toQueueId]: [...destTickets, { ...movingTicket, status: 'open' }]
        }));
      }

      toast({
        title: "✅ Sucesso",
        description: "Ticket transferido com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao transferir ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir ticket",
        variant: "destructive"
      });
    }
  };

  const getQueueMetrics = (queueId: string): QueueMetrics | undefined => {
    return metrics.find(m => m.queue_id === queueId);
  };

  const getStatusColor = (status: TicketCard['status']) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'in_progress': return 'bg-green-500';
      case 'resolved': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3: return 'border-red-500';
      case 2: return 'border-yellow-500';
      case 1: return 'border-green-500';
      default: return 'border-gray-300';
    }
  };

  // Cálculos de estatísticas globais
  const globalStats = {
    totalActive: metrics.reduce((sum, m) => sum + m.active_tickets, 0),
    totalPending: metrics.reduce((sum, m) => sum + m.pending_tickets, 0),
    avgAiRate: Math.round(metrics.reduce((sum, m) => sum + m.ai_success_rate, 0) / (metrics.length || 1)),
    avgResponseTime: Math.round(metrics.reduce((sum, m) => sum + m.avg_response_time_minutes, 0) / (metrics.length || 1))
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando kanban das filas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Kanban Visual - Filas em Tempo Real</h2>
          <p className="text-muted-foreground">
            Visualize e gerencie tickets com dados reais do sistema
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Métricas globais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tickets Ativos</p>
                <p className="text-2xl font-bold text-blue-600">{globalStats.totalActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{globalStats.totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Taxa IA</p>
                <p className="text-2xl font-bold text-green-600">{globalStats.avgAiRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold text-purple-600">{globalStats.avgResponseTime}min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board com dados reais */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {queues.map(queue => {
            const queueTickets = tickets[queue.id] || [];
            const queueMetrics = getQueueMetrics(queue.id);
            const workloadScore = queueMetrics?.workload_score || 0;
            
            return (
              <div key={queue.id} className="flex-shrink-0 w-80">
                <Card className="h-full border-2 hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <CardTitle className="text-sm font-medium">
                            {queue.name}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {queueTickets.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Métricas da fila */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Carga:</span>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            workloadScore < 30 ? 'bg-green-500' : 
                            workloadScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span>{workloadScore}%</span>
                        </div>
                      </div>
                      
                      {queueMetrics && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Tempo resp.:</span>
                            <span>{Math.round(queueMetrics.avg_response_time_minutes)}min</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Taxa IA:</span>
                            <span>{Math.round(queueMetrics.ai_success_rate)}%</span>
                          </div>
                        </>
                      )}
                    </div>

                    {queue.assistants && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        {queue.assistants.name}
                      </div>
                    )}
                  </CardHeader>

                  <Droppable droppableId={queue.id}>
                    {(provided, snapshot) => (
                      <CardContent
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 min-h-32 ${
                          snapshot.isDraggingOver ? 'bg-muted/50' : ''
                        }`}
                      >
                        <ScrollArea className="h-96">
                          {queueTickets.map((ticket, index) => (
                            <Draggable
                              key={ticket.id}
                              draggableId={ticket.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-3 cursor-move border-l-4 ${getPriorityColor(ticket.priority)} ${
                                    snapshot.isDragging ? 'rotate-1 shadow-lg z-50' : 'hover:shadow-md'
                                  } transition-all`}
                                >
                                  <CardContent className="p-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium truncate">
                                          {ticket.customer_name}
                                        </h4>
                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status)}`} />
                                      </div>
                                      
                                      <p className="text-xs text-muted-foreground truncate">
                                        {ticket.customer_phone}
                                      </p>
                                      
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                          {ticket.waiting_time_minutes}min aguardando
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                          P{ticket.priority}
                                        </Badge>
                                      </div>
                                      
                                      {ticket.waiting_time_minutes > 60 && (
                                        <div className="flex items-center gap-1 text-xs text-orange-600">
                                          <AlertTriangle className="h-3 w-3" />
                                          SLA em risco
                                        </div>
                                      )}

                                      {/* Indicador de chat em tempo real */}
                                      <div className="flex items-center gap-1 text-xs text-blue-600">
                                        <Activity className="h-3 w-3" />
                                        {ticket.chat_id.replace('@s.whats', '')}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                        </ScrollArea>
                        {provided.placeholder}
                        
                        {queueTickets.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum ticket nesta fila</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Alertas e regras automáticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Sistema de Transferências Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h4 className="font-medium mb-2">Sobrecarga Detectada</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Transferência automática quando &gt; 10 tickets
                </p>
                <Badge variant="secondary">Ativo</Badge>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-medium mb-2">SLA em Risco</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Escalar tickets &gt; 60min sem resposta
                </p>
                <Badge variant="secondary">Ativo</Badge>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-medium mb-2">Balanceamento</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Distribuição inteligente por carga
                </p>
                <Badge variant="secondary">Ativo</Badge>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueuesKanbanView;