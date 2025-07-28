
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Settings, Bot, Zap, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { aiConfigService } from "@/services/aiConfigService";
import { assistantsService, type AssistantWithQueues } from "@/services/assistantsService";
import { queuesService, type QueueWithAssistant } from "@/services/queuesService";
import AIConfigForm from "./AIConfigForm";
import AssistantForm from "./AssistantForm";
import QueueForm from "./QueueForm";
import AssistantsList from "./AssistantsList";
import QueuesList from "./QueuesList";
import AssistantChat from "./AssistantChat";
import AssistantAdvancedSettings from "./AssistantAdvancedSettings";
import EvolutionApiStatus from "./EvolutionApiStatus";
import HumanizedAssistantManager from "./HumanizedAssistantManager";
import OnlineStatusConfig from "./OnlineStatusConfig";

const AssistantsManager = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const [aiConfig, setAiConfig] = useState(null);
  const [assistants, setAssistants] = useState<AssistantWithQueues[]>([]);
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showAssistantForm, setShowAssistantForm] = useState(false);
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [editingQueue, setEditingQueue] = useState(null);
  const [selectedAssistantForSettings, setSelectedAssistantForSettings] = useState<AssistantWithQueues | null>(null);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados dos assistentes para cliente:', clientId);
      
      const [configData, assistantsData, queuesData] = await Promise.all([
        aiConfigService.getClientConfig(clientId!),
        assistantsService.getClientAssistants(clientId!),
        queuesService.getClientQueues(clientId!)
      ]);
      
      console.log('📊 Dados carregados:', { configData, assistantsData, queuesData });
      
      setAiConfig(configData);
      setAssistants(assistantsData);
      setQueues(queuesData);
      
      if (!configData) {
        console.log('⚠️ Nenhuma configuração de IA encontrada, mostrando formulário');
        setShowConfigForm(true);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados dos assistentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSaved = () => {
    setShowConfigForm(false);
    loadData();
    toast({
      title: "Sucesso",
      description: "Configuração de IA salva com sucesso"
    });
  };

  const handleAssistantSaved = () => {
    setShowAssistantForm(false);
    setEditingAssistant(null);
    loadData();
    toast({
      title: "Sucesso", 
      description: "Assistente salvo com sucesso"
    });
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

  const handleAdvancedSettings = (assistant: AssistantWithQueues) => {
    setSelectedAssistantForSettings(assistant);
    setShowAdvancedSettings(true);
  };

  const handleCloseAdvancedSettings = () => {
    setShowAdvancedSettings(false);
    setSelectedAssistantForSettings(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando assistentes...</p>
        </div>
      </div>
    );
  }

  if (!aiConfig && !showConfigForm) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Settings className="h-6 w-6" />
              Configuração de IA
            </CardTitle>
            <CardDescription>
              Configure sua chave da OpenAI e modelo padrão para começar a usar assistentes
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setShowConfigForm(true)} size="lg">
              <Settings className="h-4 w-4 mr-2" />
              Configurar IA
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se estiver mostrando configurações avançadas, renderizar apenas esse componente
  if (showAdvancedSettings && selectedAssistantForSettings) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <AssistantAdvancedSettings
          assistantId={selectedAssistantForSettings.id}
          onClose={handleCloseAdvancedSettings}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assistentes Ativos</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assistants.filter(a => a.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {assistants.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filas Ativas</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Modelo IA</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{aiConfig?.default_model}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowConfigForm(true)}
              className="text-xs p-0 h-auto"
            >
              Alterar configuração
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Bot className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="assistants">
            <Zap className="h-4 w-4 mr-2" />
            Assistentes
          </TabsTrigger>
          <TabsTrigger value="queues">
            <Settings className="h-4 w-4 mr-2" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="humanized">
            <Bot className="h-4 w-4 mr-2" />
            Humanização
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Status da API Evolution */}
          <EvolutionApiStatus />
          
          <div className="flex gap-3">
            <Button onClick={() => setShowAssistantForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Assistente
            </Button>
            <Button onClick={() => setShowQueueForm(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Nova Fila
            </Button>
          </div>

          {/* Listas lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssistantsList 
              assistants={assistants}
              onEdit={(assistant) => {
                setEditingAssistant(assistant);
                setShowAssistantForm(true);
              }}
              onDelete={async (id) => {
                await assistantsService.deleteAssistant(id);
                loadData();
                toast({
                  title: "Sucesso",
                  description: "Assistente removido com sucesso"
                });
              }}
              onToggleStatus={async (id, isActive) => {
                await assistantsService.toggleAssistantStatus(id, isActive);
                loadData();
              }}
              onAdvancedSettings={handleAdvancedSettings}
            />

            <QueuesList
              queues={queues}
              assistants={assistants}
              onEdit={(queue) => {
                setEditingQueue(queue);
                setShowQueueForm(true);
              }}
              onDelete={async (id) => {
                await queuesService.deleteQueue(id);
                loadData();
                toast({
                  title: "Sucesso", 
                  description: "Fila removida com sucesso"
                });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="assistants" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gerenciar Assistentes</h2>
            <Button onClick={() => setShowAssistantForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Assistente
            </Button>
          </div>
          
          <AssistantsList 
            assistants={assistants}
            onEdit={(assistant) => {
              setEditingAssistant(assistant);
              setShowAssistantForm(true);
            }}
            onDelete={async (id) => {
              await assistantsService.deleteAssistant(id);
              loadData();
              toast({
                title: "Sucesso",
                description: "Assistente removido com sucesso"
              });
            }}
            onToggleStatus={async (id, isActive) => {
              await assistantsService.toggleAssistantStatus(id, isActive);
              loadData();
            }}
            onAdvancedSettings={handleAdvancedSettings}
          />
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gerenciar Filas</h2>
            <Button onClick={() => setShowQueueForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Fila
            </Button>
          </div>
          
          <QueuesList
            queues={queues}
            assistants={assistants}
            onEdit={(queue) => {
              setEditingQueue(queue);
              setShowQueueForm(true);
            }}
            onDelete={async (id) => {
              await queuesService.deleteQueue(id);
              loadData();
              toast({
                title: "Sucesso", 
                description: "Fila removida com sucesso"
              });
            }}
          />
        </TabsContent>

        <TabsContent value="humanized" className="space-y-6">
          <div className="space-y-6">
            <HumanizedAssistantManager clientId={clientId!} />
            <OnlineStatusConfig clientId={clientId!} />
          </div>
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <AssistantChat 
            clientId={clientId!}
            assistants={assistants}
          />
        </TabsContent>
      </Tabs>

      {/* Formulários */}
      {showConfigForm && (
        <AIConfigForm
          clientId={clientId!}
          config={aiConfig}
          onSave={handleConfigSaved}
          onCancel={() => setShowConfigForm(false)}
        />
      )}

      {showAssistantForm && (
        <AssistantForm
          clientId={clientId!}
          assistant={editingAssistant}
          onSave={handleAssistantSaved}
          onCancel={() => {
            setShowAssistantForm(false);
            setEditingAssistant(null);
          }}
        />
      )}

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
    </div>
  );
};

export default AssistantsManager;
