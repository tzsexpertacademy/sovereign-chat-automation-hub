
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Users, Zap, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queuesService, type QueueWithAssistant } from "@/services/queuesService";
import { assistantsService, type AssistantWithQueues } from "@/services/assistantsService";
import { funnelService, type FunnelTag } from "@/services/funnelService";
import QueueForm from "./QueueForm";
import QueuesList from "./QueuesList";
import QueueConnectionManager from "./QueueConnectionManager";
import FunnelTagManager from "./FunnelTagManager";

const QueuesManager = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [assistants, setAssistants] = useState<AssistantWithQueues[]>([]);
  const [tags, setTags] = useState<FunnelTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingQueue, setEditingQueue] = useState<QueueWithAssistant | null>(null);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados das filas para cliente:', clientId);
      
      const [queuesData, assistantsData, tagsData] = await Promise.all([
        queuesService.getClientQueues(clientId!),
        assistantsService.getClientAssistants(clientId!),
        funnelService.getTags(clientId!)
      ]);
      
      console.log('📊 Dados carregados:', { queuesData, assistantsData, tagsData });
      
      setQueues(queuesData);
      setAssistants(assistantsData);
      setTags(tagsData);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das filas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueSaved = () => {
    setShowQueueForm(false);
    setEditingQueue(null);
    loadData();
    toast({
      title: "Sucesso",
      description: "Fila salva com sucesso"
    });
  };

  const handleConnectionChange = () => {
    loadData();
  };

  const handleTagsUpdated = () => {
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando filas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queues.filter(q => q.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {queues.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assistentes</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assistants.filter(a => a.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tags.filter(t => t.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              organizacionais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conexões</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queues.reduce((total, queue) => 
                total + (queue.instance_queue_connections?.length || 0), 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações principais */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setShowQueueForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Fila
        </Button>
        <Button 
          onClick={() => setShowConnectionManager(true)} 
          variant="outline"
        >
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Conexões
        </Button>
        <Button 
          onClick={() => setShowTagManager(true)} 
          variant="outline"
        >
          <Tag className="h-4 w-4 mr-2" />
          Gerenciar Tags
        </Button>
      </div>

      {/* Lista de filas */}
      <QueuesList
        queues={queues}
        assistants={assistants}
        onEdit={(queue) => {
          setEditingQueue(queue);
          setShowQueueForm(true);
        }}
        onDelete={async (id) => {
          try {
            await queuesService.deleteQueue(id);
            loadData();
            toast({
              title: "Sucesso",
              description: "Fila removida com sucesso"
            });
          } catch (error: any) {
            toast({
              title: "Erro",
              description: error.message || "Erro ao remover fila",
              variant: "destructive"
            });
          }
        }}
      />

      {/* Formulários e modais */}
      {showQueueForm && (
        <QueueForm
          clientId={clientId!}
          queue={editingQueue}
          assistants={assistants}
          onSave={handleQueueSaved}
          onCancel={() => {
            setShowQueueForm(false);
            setEditingQueue(null);
          }}
        />
      )}

      {showConnectionManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Gerenciar Conexões de Filas</h2>
                <Button 
                  variant="outline" 
                  onClick={() => setShowConnectionManager(false)}
                >
                  Fechar
                </Button>
              </div>
              <QueueConnectionManager
                clientId={clientId!}
                onConnectionChange={handleConnectionChange}
              />
            </div>
          </div>
        </div>
      )}

      {showTagManager && (
        <FunnelTagManager
          clientId={clientId!}
          tags={tags}
          onClose={() => setShowTagManager(false)}
          onSave={handleTagsUpdated}
        />
      )}
    </div>
  );
};

export default QueuesManager;
