/**
 * Centro de Gerenciamento de Filas - FASE 2
 * Interface unificada para Conexão → Fila → Assistente
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Plus, 
  Link as LinkIcon, 
  Bot, 
  Users, 
  BarChart3, 
  ArrowRight,
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { queueOrchestrationService } from '@/services/queueOrchestrationService';
import { supabase } from '@/integrations/supabase/client';
import QueuesKanbanView from './QueuesKanbanView';

interface QueueManagementCenterProps {
  clientId?: string;
}

const QueueManagementCenter: React.FC<QueueManagementCenterProps> = ({ clientId: propClientId }) => {
  const params = useParams<{ clientId: string }>();
  const clientId = propClientId || params.clientId;
  const { toast } = useToast();
  
  // Estados
  const [queues, setQueues] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de formulário
  const [newQueue, setNewQueue] = useState({
    name: '',
    description: '',
    assistant_id: '',
    auto_assignment: true,
    priority_level: 1,
    max_concurrent_tickets: 10
  });
  
  const [showNewQueueForm, setShowNewQueueForm] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<string>('');

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Carregar filas, assistentes e instâncias em paralelo
      const [queuesData, assistantsData, instancesData, metricsData] = await Promise.all([
        queuesService.getClientQueues(clientId!),
        assistantsService.getClientAssistants(clientId!),
        loadInstances(),
        queueOrchestrationService.getClientQueueMetrics(clientId!)
      ]);

      setQueues(queuesData);
      setAssistants(assistantsData);
      setInstances(instancesData);
      setMetrics(metricsData);

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das filas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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

  const handleCreateQueue = async () => {
    if (!newQueue.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da fila é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      await queuesService.createQueue({
        ...newQueue,
        client_id: clientId!
      });

      toast({
        title: "✅ Sucesso",
        description: "Fila criada com sucesso"
      });

      setNewQueue({
        name: '',
        description: '',
        assistant_id: '',
        auto_assignment: true,
        priority_level: 1,
        max_concurrent_tickets: 10
      });
      setShowNewQueueForm(false);
      loadData();

    } catch (error) {
      console.error('❌ Erro ao criar fila:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar fila",
        variant: "destructive"
      });
    }
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

  const getQueueMetrics = (queueId: string) => {
    return metrics.find(m => m.queueId === queueId) || {
      activeTickets: 0,
      resolvedToday: 0,
      avgResponseTime: 0,
      aiSuccessRate: 0,
      humanHandoffRate: 0
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'disconnected': return 'text-red-600';
      case 'connecting': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
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
    <div className="h-[calc(100vh-8rem)] p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Centro de Filas YUMER
        </h1>
        <p className="text-muted-foreground">
          Gerencie conexões, filas e assistentes em um só lugar
        </p>
      </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="kanban">Kanban Visual</TabsTrigger>
            <TabsTrigger value="queues">Filas</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Estatísticas Rápidas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Filas Ativas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{queues.filter(q => q.is_active).length}</div>
                <p className="text-xs text-muted-foreground">
                  {assistants.length} assistentes conectados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Instâncias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{instances.length}</div>
                <p className="text-xs text-muted-foreground">
                  WhatsApp conectadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Tickets Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.reduce((sum, m) => sum + m.activeTickets, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Em atendimento
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fluxo de Orquestração */}
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Orquestração</CardTitle>
              <CardDescription>
                Como as mensagens fluem pelo sistema YUMER
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Conexão WhatsApp</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Fila Inteligente</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">Assistente IA</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kanban Tab */}
        <TabsContent value="kanban">
          <QueuesKanbanView clientId={clientId!} />
        </TabsContent>


        {/* Gerenciamento de Filas */}
        <TabsContent value="queues" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Filas de Atendimento</h2>
            <Button onClick={() => setShowNewQueueForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Fila
            </Button>
          </div>

          {showNewQueueForm && (
            <Card>
              <CardHeader>
                <CardTitle>Criar Nova Fila</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome da Fila</Label>
                    <Input
                      id="name"
                      value={newQueue.name}
                      onChange={(e) => setNewQueue(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Atendimento Geral"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assistant">Assistente IA</Label>
                    <Select
                      value={newQueue.assistant_id}
                      onValueChange={(value) => setNewQueue(prev => ({ ...prev, assistant_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar assistente" />
                      </SelectTrigger>
                      <SelectContent>
                        {assistants.map((assistant) => (
                          <SelectItem key={assistant.id} value={assistant.id}>
                            {assistant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newQueue.description}
                    onChange={(e) => setNewQueue(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o propósito desta fila..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select
                      value={newQueue.priority_level.toString()}
                      onValueChange={(value) => setNewQueue(prev => ({ ...prev, priority_level: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Alta (1)</SelectItem>
                        <SelectItem value="2">Média (2)</SelectItem>
                        <SelectItem value="3">Baixa (3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="max_tickets">Máx. Tickets</Label>
                    <Input
                      id="max_tickets"
                      type="number"
                      value={newQueue.max_concurrent_tickets}
                      onChange={(e) => setNewQueue(prev => ({ ...prev, max_concurrent_tickets: parseInt(e.target.value) }))}
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      id="auto_assignment"
                      checked={newQueue.auto_assignment}
                      onCheckedChange={(checked) => setNewQueue(prev => ({ ...prev, auto_assignment: checked }))}
                    />
                    <Label htmlFor="auto_assignment">Auto-atribuição</Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateQueue}>Criar Fila</Button>
                  <Button variant="outline" onClick={() => setShowNewQueueForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {queues.map((queue) => {
              const queueMetrics = getQueueMetrics(queue.id);
              
              return (
                <Card key={queue.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{queue.name}</h3>
                          <Badge variant={queue.is_active ? "default" : "secondary"}>
                            {queue.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          {queue.auto_assignment && (
                            <Badge variant="outline">Auto</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {queue.description || "Sem descrição"}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm">
                          {queue.assistants && (
                            <div className="flex items-center gap-1">
                              <Bot className="h-4 w-4 text-purple-600" />
                              <span>{queue.assistants.name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4 text-blue-600" />
                            <span>{queueMetrics.activeTickets} ativos</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span>{queueMetrics.avgResponseTime.toFixed(1)}min resp.</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
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

        {/* Conexões Tab - movido para último */}
        <TabsContent value="connections" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Conexões Instância ↔ Fila</h2>
            
            <div className="grid gap-4">
              {instances.map((instance) => (
                <Card key={instance.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{instance.custom_name || instance.instance_id}</h3>
                        <p className="text-sm text-muted-foreground">
                          {instance.phone_number} • 
                          <span className={getStatusColor(instance.status)}>
                            {instance.status}
                          </span>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Select onValueChange={(queueId) => handleConnectInstance(instance.id, queueId)}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Conectar à fila" />
                          </SelectTrigger>
                          <SelectContent>
                            {queues.filter(q => q.is_active).map((queue) => (
                              <SelectItem key={queue.id} value={queue.id}>
                                {queue.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metrics" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Métricas de Performance</h2>
            
            <div className="grid gap-4">
              {metrics.map((metric) => (
                <Card key={metric.queueId}>
                  <CardHeader>
                    <CardTitle className="text-base">{metric.queueName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {metric.activeTickets}
                        </div>
                        <p className="text-xs text-muted-foreground">Ativos</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {metric.resolvedToday}
                        </div>
                        <p className="text-xs text-muted-foreground">Resolvidos hoje</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {metric.avgResponseTime.toFixed(1)}m
                        </div>
                        <p className="text-xs text-muted-foreground">Tempo resposta</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {(metric.aiSuccessRate * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Sucesso IA</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {(metric.humanHandoffRate * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Handoff humano</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QueueManagementCenter;