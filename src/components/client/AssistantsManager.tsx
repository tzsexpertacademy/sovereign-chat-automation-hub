
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Settings, Bot, Zap, MessageSquare, Clock, Target, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { aiConfigService } from "@/services/aiConfigService";
import { assistantsService, type AssistantWithQueues } from "@/services/assistantsService";
import { useAssistantMetrics } from "@/hooks/useAssistantMetrics";
import AIConfigForm from "./AIConfigForm";
import AssistantForm from "./AssistantForm";
import AssistantsList from "./AssistantsList";
import AssistantChat from "./AssistantChat";
import AssistantSettings from "./AssistantSettings";
import RealTimeMetricsCard from "./RealTimeMetricsCard";
import SystemHealthIndicator from "./SystemHealthIndicator";
import { Skeleton } from "@/components/ui/skeleton";


const AssistantsManager = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const [aiConfig, setAiConfig] = useState(null);
  const [assistants, setAssistants] = useState<AssistantWithQueues[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showAssistantForm, setShowAssistantForm] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [selectedAssistantForSettings, setSelectedAssistantForSettings] = useState<AssistantWithQueues | null>(null);
  
  const { metrics, loading: metricsLoading, error: metricsError } = useAssistantMetrics(clientId!);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados dos assistentes para cliente:', clientId);
      
      const [configData, assistantsData] = await Promise.all([
        aiConfigService.getClientConfig(clientId!),
        assistantsService.getClientAssistants(clientId!)
      ]);
      
      console.log('📊 Dados carregados:', { configData, assistantsData });
      
      setAiConfig(configData);
      setAssistants(assistantsData);
      
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        
        {/* Metrics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Content Skeleton */}
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
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

  // Se estiver mostrando configurações, renderizar apenas esse componente
  if (showAdvancedSettings && selectedAssistantForSettings) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <AssistantSettings
          assistantId={selectedAssistantForSettings.id}
          onClose={handleCloseAdvancedSettings}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Moderno */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Assistentes IA
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus assistentes virtuais e acompanhe a performance
            </p>
          </div>
          <SystemHealthIndicator clientId={clientId!} />
        </div>
      </div>

      {/* Métricas em Tempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RealTimeMetricsCard
          title="Assistentes Ativos"
          value={metrics?.activeAssistants || 0}
          subtitle={`de ${metrics?.totalAssistants || 0} total`}
          icon={Bot}
          badge={{
            text: metrics?.activeAssistants ? "Online" : "Offline",
            variant: metrics?.activeAssistants ? "default" : "secondary"
          }}
          trend={{
            value: 12,
            isPositive: true
          }}
        />

        <RealTimeMetricsCard
          title="Processamento IA"
          value={metrics?.aiProcessingToday || 0}
          subtitle="respostas hoje"
          icon={Zap}
          trend={{
            value: 24,
            isPositive: true
          }}
          badge={{
            text: "Ativo",
            variant: "default"
          }}
        />

        <RealTimeMetricsCard
          title="Áudios Processados"
          value={metrics?.processedAudios || 0}
          subtitle="áudios hoje"
          icon={MessageSquare}
          trend={{
            value: 8,
            isPositive: true
          }}
        />

        <RealTimeMetricsCard
          title="Taxa de Sucesso"
          value={`${metrics?.successRate?.toFixed(1) || 0}%`}
          subtitle={`${metrics?.responseTime?.toFixed(1) || 0}s tempo médio`}
          icon={Target}
          progress={{
            value: metrics?.successRate || 0
          }}
          trend={{
            value: 3,
            isPositive: true
          }}
          badge={{
            text: (metrics?.successRate || 0) > 95 ? "Excelente" : "Bom",
            variant: (metrics?.successRate || 0) > 95 ? "default" : "secondary"
          }}
        />
      </div>

      {/* Status dos Assistentes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Status Geral
              </CardTitle>
              <Badge variant={metrics?.activeAssistants ? "default" : "secondary"}>
                {metrics?.activeAssistants ? "Operacional" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assistentes ativos</span>
                <span className="font-medium">{metrics?.activeAssistants || 0}/{metrics?.totalAssistants || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ 
                    width: `${metrics?.totalAssistants ? (metrics.activeAssistants / metrics.totalAssistants) * 100 : 0}%` 
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                IA Multimídia
              </CardTitle>
              <Badge variant={metrics?.multimediaEnabled ? "default" : "secondary"}>
                {metrics?.multimediaEnabled || 0} Ativos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Com multimídia</span>
                <span className="font-medium">{metrics?.multimediaEnabled || 0}/{metrics?.totalAssistants || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300" 
                  style={{ 
                    width: `${metrics?.totalAssistants ? (metrics.multimediaEnabled / metrics.totalAssistants) * 100 : 0}%` 
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Performance
              </CardTitle>
              <Badge variant="default">
                {metrics?.responseTime?.toFixed(1) || 0}s
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tempo de resposta</span>
                <span className="font-medium">{metrics?.responseTime?.toFixed(1) || 0}s</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ 
                    width: `${Math.max(0, Math.min(100, 100 - ((metrics?.responseTime || 0) / 10) * 100))}%` 
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interface Principal */}
      <Tabs defaultValue="assistants" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="assistants" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Assistentes
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistants" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Gerenciar Assistentes</h2>
              <p className="text-muted-foreground">
                Configure e monitore seus assistentes virtuais
              </p>
            </div>
            <Button onClick={() => setShowAssistantForm(true)} size="lg" className="sm:w-auto w-full">
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



        <TabsContent value="chat" className="space-y-6 mt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Chat com Assistentes</h2>
            <p className="text-muted-foreground">
              Teste e converse diretamente com seus assistentes
            </p>
          </div>
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

    </div>
  );
};

export default AssistantsManager;
