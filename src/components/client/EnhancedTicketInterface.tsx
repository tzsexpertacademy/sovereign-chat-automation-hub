/**
 * Interface de Ticket Aprimorada - FASE 2
 * Integração com sistema de filas e orquestração
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowRight, 
  Bot, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle,
  Users,
  Activity,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queueOrchestrationService } from '@/services/queueOrchestrationService';
import { queuesService } from '@/services/queuesService';
import { supabase } from '@/integrations/supabase/client';
import TicketChatInterface from './TicketChatInterface';

interface EnhancedTicket {
  id: string;
  title: string;
  status: string;
  priority: number;
  assigned_queue_id: string | null;
  assigned_assistant_id: string | null;
  escalation_level: number;
  first_response_at: string | null;
  last_activity_at: string;
  auto_close_at: string | null;
  ai_processing_attempts: number;
  human_takeover_reason: string | null;
  customer: {
    name: string;
    phone: string;
  };
  queues?: {
    name: string;
    assistants?: {
      name: string;
    };
  };
}

const EnhancedTicketInterface = () => {
  const { clientId, ticketId } = useParams<{ clientId: string; ticketId: string }>();
  const { toast } = useToast();
  
  const [ticket, setTicket] = useState<EnhancedTicket | null>(null);
  const [availableQueues, setAvailableQueues] = useState<any[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (clientId && ticketId) {
      loadTicketData();
      loadTransferHistory();
    }
  }, [clientId, ticketId]);

  const loadTicketData = async () => {
    try {
      setIsLoading(true);
      
      // Carregar dados do ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customers:customer_id (
            name,
            phone
          ),
          queues:assigned_queue_id (
            name,
            assistants:assistant_id (
              name
            )
          )
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Carregar filas disponíveis
      const queuesData = await queuesService.getClientQueues(clientId!);
      
      // Carregar métricas da fila atual
      let queueMetrics = null;
      if (ticketData.assigned_queue_id) {
        const metricsData = await queueOrchestrationService.getClientQueueMetrics(clientId!);
        queueMetrics = metricsData.find(m => m.queueId === ticketData.assigned_queue_id);
      }

      setTicket({
        ...ticketData,
        customer: ticketData.customers || { name: 'Cliente', phone: 'N/A' }
      });
      setAvailableQueues(queuesData);
      setMetrics(queueMetrics);

    } catch (error) {
      console.error('❌ Erro ao carregar dados do ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransferHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('queue_transfers')
        .select(`
          *,
          from_queue:from_queue_id (name),
          to_queue:to_queue_id (name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransferHistory(data || []);

    } catch (error) {
      console.error('❌ Erro ao carregar histórico de transferências:', error);
    }
  };

  const handleTransferQueue = async (newQueueId: string, reason: string = 'Transferência manual') => {
    if (!ticket || isTransferring) return;

    try {
      setIsTransferring(true);
      
      const success = await queueOrchestrationService.transferTicket(
        ticket.id,
        ticket.assigned_queue_id,
        newQueueId,
        reason,
        'manual',
        'user'
      );

      if (success) {
        toast({
          title: "✅ Sucesso",
          description: "Ticket transferido com sucesso"
        });
        
        loadTicketData();
        loadTransferHistory();
      } else {
        throw new Error('Falha na transferência');
      }

    } catch (error) {
      console.error('❌ Erro ao transferir ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir ticket",
        variant: "destructive"
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-red-600';
      case 2: return 'text-yellow-600';
      case 3: return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getEscalationBadge = (level: number) => {
    if (level <= 1) return null;
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Escalado {level}x
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ticket não encontrado</h3>
          <p className="text-muted-foreground">Este ticket pode ter sido removido ou você não tem acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      {/* Sidebar de Informações do Ticket */}
      <div className="w-80 border-r bg-muted/10 p-4 overflow-y-auto">
        {/* Header do Ticket */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{ticket.customer?.name}</CardTitle>
              <Badge className={getStatusColor(ticket.status)}>
                {ticket.status}
              </Badge>
            </div>
            <CardDescription>
              {ticket.customer?.phone} • ID: {ticket.id.slice(0, 8)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prioridade:</span>
              <span className={`font-medium ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority === 1 ? 'Alta' : ticket.priority === 2 ? 'Média' : 'Baixa'}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tentativas IA:</span>
              <Badge variant="outline">{ticket.ai_processing_attempts}</Badge>
            </div>

            {getEscalationBadge(ticket.escalation_level)}
            
            <div className="text-sm">
              <span className="text-muted-foreground">Última atividade:</span>
              <p className="font-medium">{formatDateTime(ticket.last_activity_at)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Fila Atual */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Fila Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticket.assigned_queue_id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{ticket.queues?.name}</Badge>
                  {ticket.queues?.assistants && (
                    <Badge variant="outline" className="gap-1">
                      <Bot className="h-3 w-3" />
                      {ticket.queues.assistants.name}
                    </Badge>
                  )}
                </div>
                
                {metrics && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold text-blue-600">{metrics.activeTickets}</div>
                      <div className="text-muted-foreground">Ativos</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-bold text-green-600">{metrics.avgResponseTime.toFixed(1)}m</div>
                      <div className="text-muted-foreground">Resp. Avg</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sem fila atribuída</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transferir Fila */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Transferir Fila
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select 
              onValueChange={(queueId) => handleTransferQueue(queueId)}
              disabled={isTransferring}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar nova fila" />
              </SelectTrigger>
              <SelectContent>
                {availableQueues
                  .filter(q => q.id !== ticket.assigned_queue_id)
                  .map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      <div className="flex items-center gap-2">
                        <span>{queue.name}</span>
                        {queue.assistants && (
                          <Badge variant="outline" className="text-xs">
                            <Bot className="h-2 w-2 mr-1" />
                            {queue.assistants.name}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Histórico de Transferências */}
        {transferHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Histórico de Transferências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transferHistory.slice(0, 5).map((transfer) => (
                  <div key={transfer.id} className="text-xs border-l-2 border-muted pl-3">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {transfer.from_queue?.name || 'Sem fila'} → {transfer.to_queue?.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {transfer.transfer_type}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {formatDateTime(transfer.created_at)}
                    </div>
                    <div className="text-muted-foreground">
                      {transfer.transfer_reason}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Interface de Chat Principal */}
      <div className="flex-1">
        <TicketChatInterface 
          clientId={clientId!} 
          ticketId={ticketId!} 
        />
      </div>
    </div>
  );
};

export default EnhancedTicketInterface;