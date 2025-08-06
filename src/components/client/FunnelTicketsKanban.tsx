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
  Target,
  Tag as TagIcon,
  Edit,
  BarChart3
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { funnelService, type FunnelStage as RealFunnelStage, type FunnelTag } from "@/services/funnelService";
import FunnelStageEditor from './FunnelStageEditor';
import FunnelTagManagerV2 from './FunnelTagManagerV2';

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
  resolution_time_minutes?: number;
  first_response_time_minutes?: number;
}

interface FunnelTicketsKanbanProps {
  clientId: string;
}

const FunnelTicketsKanban: React.FC<FunnelTicketsKanbanProps> = ({ clientId }) => {
  const [stages, setStages] = useState<RealFunnelStage[]>([]);
  const [tickets, setTickets] = useState<TicketForFunnel[]>([]);
  const [availableTags, setAvailableTags] = useState<FunnelTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFunnelData();
  }, [clientId]);

  const loadFunnelData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStagesAndTags(),
        loadTicketsData()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do funil:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do funil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStagesAndTags = async () => {
    try {
      const [stagesData, tagsData] = await Promise.all([
        funnelService.getStages(clientId),
        funnelService.getTags(clientId)
      ]);

      setStages(stagesData);
      setAvailableTags(tagsData);

      // Criar estágios padrão se não existirem
      if (stagesData.length === 0) {
        await createDefaultStages();
      }
    } catch (error) {
      console.error('Erro ao carregar estágios e tags:', error);
    }
  };

  const createDefaultStages = async () => {
    const defaultStages = [
      { name: 'Leads', description: 'Contatos iniciais', color: '#3B82F6' },
      { name: 'Qualificados', description: 'Leads qualificados', color: '#F59E0B' },
      { name: 'Proposta', description: 'Propostas enviadas', color: '#10B981' },
      { name: 'Fechamento', description: 'Em fechamento', color: '#8B5CF6' },
      { name: 'Vendido', description: 'Vendas concluídas', color: '#EF4444' },
      { name: 'Perdido', description: 'Oportunidades perdidas', color: '#6B7280' }
    ];

    try {
      const createdStages = [];
      for (let i = 0; i < defaultStages.length; i++) {
        const stage = await funnelService.createStage(clientId, {
          ...defaultStages[i],
          position: i
        });
        createdStages.push(stage);
      }
      setStages(createdStages);
    } catch (error) {
      console.error('Erro ao criar estágios padrão:', error);
    }
  };

  const loadTicketsData = async () => {
    try {
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
          first_response_at,
          closed_at,
          resolution_time_minutes,
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

      // Mapear tickets com dados reais
      const mappedTickets: TicketForFunnel[] = (ticketsData || []).map(ticket => {
        const createdAt = new Date(ticket.created_at);
        const currentTime = Date.now();
        const waitingTime = Math.floor((currentTime - createdAt.getTime()) / (1000 * 60));
        
        // Calcular tempo de primeira resposta (dados reais)
        const firstResponseTime = ticket.first_response_at 
          ? Math.floor((new Date(ticket.first_response_at).getTime() - createdAt.getTime()) / (1000 * 60))
          : null;
        
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
          resolution_time_minutes: ticket.resolution_time_minutes,
          first_response_time_minutes: firstResponseTime
        };
      });

      setTickets(mappedTickets);

    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do funil",
        variant: "destructive"
      });
    }
  };

  const getTicketsByStage = (stage: RealFunnelStage): TicketForFunnel[] => {
    return tickets.filter(ticket => {
      // Verificar se o ticket tem tag correspondente ao nome do estágio
      const stageNameLower = stage.name.toLowerCase();
      const hasStageTag = ticket.tags.some(tag => 
        tag.toLowerCase().includes(stageNameLower) ||
        stageNameLower.includes(tag.toLowerCase())
      );

      // Se não tem tag específica, colocar no primeiro estágio (menor position)
      const isFirstStage = stages.length > 0 && stage.position === Math.min(...stages.map(s => s.position));
      const isInStage = hasStageTag || (isFirstStage && ticket.tags.length === 0);

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

      // Atualizar tags do ticket com o nome do estágio
      const stageTagName = targetStage.name.toLowerCase();
      const newTags = [
        ...ticket.tags.filter(tag => 
          !stages.some(stage => tag.toLowerCase().includes(stage.name.toLowerCase()))
        ), 
        stageTagName
      ];

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

      // Tag será incluída na próxima busca de tags

    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  // Cálculos de estatísticas reais
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
  const avgResponseTime = tickets.filter(t => t.first_response_time_minutes).length > 0
    ? Math.round(tickets.filter(t => t.first_response_time_minutes)
        .reduce((sum, t) => sum + (t.first_response_time_minutes || 0), 0) / 
        tickets.filter(t => t.first_response_time_minutes).length)
    : 0;
  const activeTickets = tickets.filter(t => ['open', 'pending', 'in_progress'].includes(t.status)).length;

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
          <Button variant="outline" size="sm" onClick={loadFunnelData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowStageEditor(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Estágios
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTagManager(true)}>
            <TagIcon className="h-4 w-4 mr-2" />
            Tags
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
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold text-blue-600">{totalTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold text-green-600">{resolvedTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tempo Resposta</p>
                <p className="text-2xl font-bold text-purple-600">{avgResponseTime}min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5" />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-orange-600">{activeTickets}</p>
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
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  style={{ 
                    backgroundColor: selectedTags.includes(tag.name) ? tag.color : 'transparent',
                    borderColor: tag.color 
                  }}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag.name) 
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                    );
                  }}
                >
                  {tag.name}
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
            const avgResolutionTime = stageTickets.filter(t => t.resolution_time_minutes).length > 0
              ? Math.round(stageTickets.filter(t => t.resolution_time_minutes)
                  .reduce((sum, t) => sum + (t.resolution_time_minutes || 0), 0) / 
                  stageTickets.filter(t => t.resolution_time_minutes).length)
              : 0;
            
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
                    
                    {avgResolutionTime > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {avgResolutionTime}min resolução
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
                                      
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {ticket.waiting_time_minutes}min
                                        </div>
                                        {ticket.first_response_time_minutes && (
                                          <span className="text-blue-600">
                                            Resp: {ticket.first_response_time_minutes}min
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
      {/* Modais */}
      {showStageEditor && (
        <FunnelStageEditor
          clientId={clientId}
          stages={stages}
          onClose={() => setShowStageEditor(false)}
          onSave={() => {
            loadStagesAndTags();
            setShowStageEditor(false);
          }}
        />
      )}

      {showTagManager && (
        <FunnelTagManagerV2
          isOpen={showTagManager}
          onClose={() => setShowTagManager(false)}
          clientId={clientId}
          availableTags={availableTags}
          onTagsUpdate={() => {
            loadStagesAndTags();
            setShowTagManager(false);
          }}
        />
      )}
    </div>
  );
};

export default FunnelTicketsKanban;