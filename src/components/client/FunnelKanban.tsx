
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { funnelService, type FunnelStage, type FunnelLead, type FunnelTag } from "@/services/funnelService";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Plus, 
  Settings, 
  Filter, 
  Search, 
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Target
} from 'lucide-react';
import FunnelStageEditor from './FunnelStageEditor';
import FunnelLeadCard from './FunnelLeadCard';
import FunnelTagManager from './FunnelTagManager';
import FunnelStats from './FunnelStats';

interface FunnelKanbanProps {
  clientId: string;
}

const FunnelKanban: React.FC<FunnelKanbanProps> = ({ clientId }) => {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [tags, setTags] = useState<FunnelTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stagesData, leadsData, tagsData] = await Promise.all([
        funnelService.getStages(clientId),
        funnelService.getLeads(clientId),
        funnelService.getTags(clientId)
      ]);

      setStages(stagesData);
      setLeads(leadsData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading funnel data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do funil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }

    try {
      await funnelService.moveLeadToStage(draggableId, destination.droppableId);
      await loadData(); // Recarregar dados
      
      toast({
        title: "Sucesso",
        description: "Lead movido com sucesso!",
      });
    } catch (error) {
      console.error('Error moving lead:', error);
      toast({
        title: "Erro",
        description: "Erro ao mover lead",
        variant: "destructive"
      });
    }
  };

  const getLeadsByStage = (stageId: string) => {
    return leads.filter(lead => {
      const matchesStage = lead.current_stage_id === stageId;
      const matchesSearch = !searchTerm || 
        lead.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.customer_phone?.includes(searchTerm) ||
        lead.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tagId => lead.tags?.some(tag => tag.id === tagId));

      return matchesStage && matchesSearch && matchesTags;
    });
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4: return 'bg-red-500';
      case 3: return 'bg-orange-500';
      case 2: return 'bg-yellow-500';
      case 1: return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return 'Urgente';
      case 3: return 'Alta';
      case 2: return 'Média';
      case 1: return 'Baixa';
      default: return 'Normal';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Funil de Vendas</h2>
          <p className="text-muted-foreground">
            Gerencie seus leads através do pipeline de vendas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTagManager(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Tags
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowStageEditor(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Estágios
          </Button>
        </div>
      </div>

      {/* Estatísticas do funil */}
      <FunnelStats leads={leads} stages={stages} />

      {/* Filtros e busca */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {tags.map(tag => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  style={{ backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined }}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag.id) 
                        ? prev.filter(id => id !== tag.id)
                        : [...prev, tag.id]
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
            const stageLeads = getLeadsByStage(stage.id);
            const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.lead_value || 0), 0);
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <Card className="h-full">
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
                          {stageLeads.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {totalValue > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        R$ {totalValue.toLocaleString('pt-BR')}
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
                          {stageLeads.map((lead, index) => (
                            <Draggable
                              key={lead.id}
                              draggableId={lead.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-3 ${
                                    snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                                  }`}
                                >
                                  <FunnelLeadCard 
                                    lead={lead} 
                                    tags={tags}
                                    onUpdate={loadData}
                                    clientId={clientId}
                                  />
                                </div>
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

      {/* Modals */}
      {showStageEditor && (
        <FunnelStageEditor
          clientId={clientId}
          stages={stages}
          onClose={() => setShowStageEditor(false)}
          onSave={loadData}
        />
      )}

      {showTagManager && (
        <FunnelTagManager
          clientId={clientId}
          tags={tags}
          onClose={() => setShowTagManager(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
};

export default FunnelKanban;
