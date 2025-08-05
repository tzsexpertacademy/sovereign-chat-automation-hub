import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Search, 
  Settings,
  Filter,
  RefreshCw,
  Plus,
  MoreVertical,
  Phone,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  MessageSquare,
  Target
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface TicketForFunnel {
  id: string;
  title: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  priority: number;
  tags: string[];
  created_at: string;
  last_activity_at: string;
  chat_id: string;
  instance_id: string;
  waiting_time_minutes: number;
  lead_value?: number;
  conversion_probability?: number;
}

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  description?: string;
  tags: string[];
}

interface FunnelTicketsKanbanProps {
  clientId: string;
}

const FunnelTicketsKanban: React.FC<FunnelTicketsKanbanProps> = ({ clientId }) => {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [tickets, setTickets] = useState<TicketForFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const { toast } = useToast();

  // Estágios padrão do funil baseados em tags
  const defaultStages: FunnelStage[] = [
    {
      id: 'leads',
      name: 'Leads',
      color: '#3B82F6',
      description: 'Contatos iniciais',
      tags: ['lead', 'novo', 'interesse', 'visitante']
    },
    {
      id: 'qualificados',
      name: 'Qualificados',
      color: '#F59E0B',
      description: 'Leads qualificados',
      tags: ['qualificado', 'potencial', 'quente', 'interessado']
    },
    {
      id: 'proposta',
      name: 'Proposta',
      color: '#10B981',
      description: 'Propostas enviadas',
      tags: ['proposta', 'orçamento', 'negociacao', 'cotacao']
    },
    {
      id: 'fechamento',
      name: 'Fechamento',
      color: '#8B5CF6',
      description: 'Em fechamento',
      tags: ['fechando', 'contrato', 'assinatura', 'pagamento']
    },
    {
      id: 'vendido',
      name: 'Vendido',
      color: '#EF4444',
      description: 'Vendas concluídas',
      tags: ['vendido', 'fechado', 'cliente', 'pago']
    },
    {
      id: 'perdido',
      name: 'Perdido',
      color: '#6B7280',
      description: 'Oportunidades perdidas',
      tags: ['perdido', 'cancelado', 'desistiu', 'nao_interessado']
    }
  ];

  useEffect(() => {
    setStages(defaultStages);
    loadTicketsData();
  }, [clientId]);

  const loadTicketsData = async () => {
    try {
      setLoading(true);

      // Buscar tickets com informações do cliente
      const { data: ticketsData, error } = await supabase
        .from('conversation_tickets')
        .select(`
          id,
          title,
          status,
          priority,
          tags,
          created_at,
          last_activity_at,
          chat_id,
          instance_id,
          customers (
            name,
            phone
          )
        `)
        .eq('client_id', clientId)
        .in('status', ['open', 'pending', 'in_progress', 'resolved'])
        .order('last_activity_at', { ascending: false });

      if (error) throw error;

      // Mapear tickets e calcular tempo de espera
      const mappedTickets: TicketForFunnel[] = (ticketsData || []).map(ticket => {
        const createdAt = new Date(ticket.created_at);
        const waitingTime = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60));
        
        return {
          id: ticket.id,
          title: ticket.title,
          customer_name: ticket.customers?.name || 'Cliente sem nome',
          customer_phone: ticket.customers?.phone || 'Telefone não informado',
          status: ticket.status,
          priority: ticket.priority || 1,
          tags: Array.isArray(ticket.tags) ? ticket.tags.map(tag => String(tag)) : [],
          created_at: ticket.created_at,
          last_activity_at: ticket.last_activity_at || ticket.created_at,
          chat_id: ticket.chat_id,
          instance_id: ticket.instance_id,
          waiting_time_minutes: waitingTime,
          lead_value: Math.floor(Math.random() * 5000), // Valor simulado
          conversion_probability: Math.floor(Math.random() * 100) // Probabilidade simulada
        };
      });

      setTickets(mappedTickets);

      // Extrair todas as tags únicas
      const allTags = new Set<string>();
      mappedTickets.forEach(ticket => {
        ticket.tags.forEach(tag => allTags.add(tag));
      });
      setAvailableTags(Array.from(allTags));

    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do funil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTicketsByStage = (stage: FunnelStage): TicketForFunnel[] => {
    return tickets.filter(ticket => {
      // Verificar se o ticket tem alguma tag que corresponde ao estágio
      const hasStageTag = stage.tags.some(stageTag => 
        ticket.tags.some(ticketTag => 
          ticketTag.toLowerCase().includes(stageTag.toLowerCase()) ||
          stageTag.toLowerCase().includes(ticketTag.toLowerCase())
        )
      );

      // Se não tem tag específica, colocar no primeiro estágio
      const isInStage = hasStageTag || (stage.id === 'leads' && ticket.tags.length === 0);

      // Aplicar filtros de busca
      const matchesSearch = !searchTerm || 
        ticket.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.customer_phone.includes(searchTerm) ||
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase());

      // Aplicar filtros de tags selecionadas
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => ticket.tags.includes(tag));

      return isInStage && matchesSearch && matchesTags;
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }

    const targetStage = stages.find(s => s.id === destination.droppableId);
    if (!targetStage) return;

    try {
      // Atualizar tags do ticket baseado no novo estágio
      const ticket = tickets.find(t => t.id === draggableId);
      if (!ticket) return;

      // Remover tags do estágio anterior e adicionar tags do novo estágio
      const newTags = [...ticket.tags.filter(tag => 
        !stages.some(stage => stage.tags.includes(tag))
      ), ...targetStage.tags];

      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          tags: newTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', draggableId);

      if (error) throw error;

      // Atualizar estado local
      setTickets(prev => prev.map(t => 
        t.id === draggableId 
          ? { ...t, tags: newTags }
          : t
      ));

      toast({
        title: "✅ Sucesso",
        description: `Ticket movido para ${targetStage.name}!`,
      });

    } catch (error) {
      console.error('Erro ao mover ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao mover ticket",
        variant: "destructive"
      });
    }
  };

  const addTagToTicket = async (ticketId: string, newTag: string) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const updatedTags = [...new Set([...ticket.tags, newTag])];

      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          tags: updatedTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, tags: updatedTags }
          : t
      ));

      if (!availableTags.includes(newTag)) {
        setAvailableTags(prev => [...prev, newTag]);
      }

    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  // Cálculos de estatísticas globais
  const totalTickets = tickets.length;
  const totalValue = tickets.reduce((sum, t) => sum + (t.lead_value || 0), 0);
  const avgConversion = tickets.length > 0 
    ? Math.round(tickets.reduce((sum, t) => sum + (t.conversion_probability || 0), 0) / tickets.length)
    : 0;
  const hotLeads = tickets.filter(t => t.priority >= 2).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando funil de vendas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header com controles */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Funil de Vendas - Tickets</h2>
          <p className="text-muted-foreground">
            Gerencie leads através de tags nos tickets do sistema
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTicketsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Métricas globais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-blue-600">{totalTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">R$ {totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Conv. Média</p>
                <p className="text-2xl font-bold text-purple-600">{avgConversion}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Leads Quentes</p>
                <p className="text-2xl font-bold text-red-600">{hotLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e busca */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por cliente, telefone ou título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) 
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageTickets = getTicketsByStage(stage);
            const stageValue = stageTickets.reduce((sum, t) => sum + (t.lead_value || 0), 0);
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <Card className="h-full border-2 hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <CardTitle className="text-sm font-medium">
                          {stage.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {stageTickets.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {stage.description && (
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                    )}
                    
                    {stageValue > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        R$ {stageValue.toLocaleString()}
                      </div>
                    )}
                  </CardHeader>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <CardContent
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 min-h-32 ${
                          snapshot.isDraggingOver ? 'bg-muted/50' : ''
                        }`}
                      >
                        <ScrollArea className="h-96">
                          {stageTickets.map((ticket, index) => (
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
                                  className={`mb-3 cursor-move border-l-4 ${
                                    ticket.priority >= 3 ? 'border-red-500' :
                                    ticket.priority >= 2 ? 'border-yellow-500' : 'border-green-500'
                                  } ${
                                    snapshot.isDragging ? 'rotate-1 shadow-lg z-50' : 'hover:shadow-md'
                                  } transition-all`}
                                >
                                  <CardContent className="p-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium truncate">
                                          {ticket.customer_name}
                                        </h4>
                                        <Badge variant="outline" className="text-xs">
                                          P{ticket.priority}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        {ticket.customer_phone}
                                      </div>
                                      
                                      {ticket.lead_value && (
                                        <div className="flex items-center gap-1 text-xs text-green-600">
                                          <DollarSign className="h-3 w-3" />
                                          R$ {ticket.lead_value.toLocaleString()}
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {ticket.waiting_time_minutes}min
                                        </div>
                                        {ticket.conversion_probability && (
                                          <span className="text-purple-600">
                                            {ticket.conversion_probability}% conv.
                                          </span>
                                        )}
                                      </div>

                                      {/* Tags do ticket */}
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {ticket.tags.slice(0, 3).map(tag => (
                                          <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                        {ticket.tags.length > 3 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{ticket.tags.length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {ticket.waiting_time_minutes > 120 && (
                                        <div className="flex items-center gap-1 text-xs text-orange-600">
                                          <AlertTriangle className="h-3 w-3" />
                                          Lead frio
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                        </ScrollArea>
                        {provided.placeholder}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

export default FunnelTicketsKanban;