import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bot, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  MessageSquare,
  Settings,
  Play,
  Pause
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { humanizedMessageProcessor } from "@/services/humanizedMessageProcessor";
import { supabase } from "@/integrations/supabase/client";

interface AIAutoProcessorStatusProps {
  clientId: string;
}

interface ProcessorStatus {
  isInitialized: boolean;
  hasActiveConnections: boolean;
  totalConnections: number;
  connectedInstances: string[];
  lastActivity?: Date;
}

const AIAutoProcessorStatus = ({ clientId }: AIAutoProcessorStatusProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<ProcessorStatus>({
    isInitialized: false,
    hasActiveConnections: false,
    totalConnections: 0,
    connectedInstances: []
  });
  const [loading, setLoading] = useState(false);
  const [autoProcess, setAutoProcess] = useState(false);

  useEffect(() => {
    loadProcessorStatus();
    const interval = setInterval(loadProcessorStatus, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, [clientId]);

  // FASE 1: INICIALIZAÇÃO AUTOMÁTICA quando há conexões ativas
  useEffect(() => {
    const autoInitializeProcessor = async () => {
      if (status.hasActiveConnections && !status.isInitialized) {
        console.log('🚀 [AUTO-INIT] Inicializando automaticamente por conexões ativas:', status.totalConnections);
        try {
          await humanizedMessageProcessor.initialize(clientId);
          setAutoProcess(true);
          
          // Atualizar status após inicialização automática
          setTimeout(loadProcessorStatus, 1000);
          
          console.log('✅ [AUTO-INIT] Processador inicializado automaticamente');
        } catch (error) {
          console.error('❌ [AUTO-INIT] Erro na inicialização automática:', error);
        }
      }
    };

    // Aguardar um pouco para garantir que o status foi carregado
    const autoInitTimeout = setTimeout(autoInitializeProcessor, 2000);
    return () => clearTimeout(autoInitTimeout);
  }, [status.hasActiveConnections, status.isInitialized, clientId]);

  const loadProcessorStatus = async () => {
    try {
      console.log('🔍 [AUTO-PROCESSOR-STATUS] Iniciando verificação de status...');
      
      // Verificar status do processador
      const processorStatus = humanizedMessageProcessor.getStatus();
      console.log('📊 [AUTO-PROCESSOR-STATUS] Status do processador:', processorStatus);
      
      // FASE 1: Buscar instâncias conectadas do cliente
      const { data: instances, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, custom_name, status')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (instanceError) {
        console.error('❌ [AUTO-PROCESSOR-STATUS] Erro ao buscar instâncias:', instanceError);
        return;
      }

      console.log('📱 [AUTO-PROCESSOR-STATUS] Instâncias conectadas encontradas:', instances?.length || 0, instances);

      if (!instances || instances.length === 0) {
        console.log('⚠️ [AUTO-PROCESSOR-STATUS] Nenhuma instância conectada encontrada');
        setStatus({
          isInitialized: processorStatus.isInitialized,
          hasActiveConnections: false,
          totalConnections: 0,
          connectedInstances: [],
          lastActivity: processorStatus.timestamp
        });
        setAutoProcess(false);
        return;
      }

      // FASE 2: Buscar conexões ativas para essas instâncias
      const instanceIds = instances.map(i => i.id);
      const { data: connections, error: connectionError } = await supabase
        .from('instance_queue_connections')
        .select('instance_id, queue_id, is_active')
        .in('instance_id', instanceIds)
        .eq('is_active', true);

      if (connectionError) {
        console.error('❌ [AUTO-PROCESSOR-STATUS] Erro ao buscar conexões:', connectionError);
        return;
      }

      console.log('🔗 [AUTO-PROCESSOR-STATUS] Conexões ativas encontradas:', connections?.length || 0, connections);

      if (!connections || connections.length === 0) {
        console.log('⚠️ [AUTO-PROCESSOR-STATUS] Nenhuma conexão ativa encontrada');
        setStatus({
          isInitialized: processorStatus.isInitialized,
          hasActiveConnections: false,
          totalConnections: 0,
          connectedInstances: instances.map(i => i.custom_name || i.instance_id),
          lastActivity: processorStatus.timestamp
        });
        setAutoProcess(false);
        return;
      }

      // FASE 3: Buscar filas ativas
      const queueIds = connections.map(c => c.queue_id);
      const { data: queues, error: queueError } = await supabase
        .from('queues')
        .select('id, name, assistant_id, is_active')
        .in('id', queueIds)
        .eq('is_active', true);

      if (queueError) {
        console.error('❌ [AUTO-PROCESSOR-STATUS] Erro ao buscar filas:', queueError);
        return;
      }

      console.log('📋 [AUTO-PROCESSOR-STATUS] Filas ativas encontradas:', queues?.length || 0, queues);

      // FASE 4: Buscar assistentes ativos
      const assistantIds = queues?.filter(q => q.assistant_id).map(q => q.assistant_id) || [];
      let activeAssistants = [];
      
      if (assistantIds.length > 0) {
        const { data: assistants, error: assistantError } = await supabase
          .from('assistants')
          .select('id, name, is_active')
          .in('id', assistantIds)
          .eq('is_active', true);

        if (assistantError) {
          console.error('❌ [AUTO-PROCESSOR-STATUS] Erro ao buscar assistentes:', assistantError);
        } else {
          activeAssistants = assistants || [];
          console.log('🤖 [AUTO-PROCESSOR-STATUS] Assistentes ativos encontrados:', activeAssistants.length, activeAssistants);
        }
      }

      // RESULTADO FINAL
      const hasValidConnections = connections.length > 0 && queues && queues.length > 0 && activeAssistants.length > 0;
      
      const connectedInstanceNames = instances
        .filter(instance => connections.some(conn => conn.instance_id === instance.id))
        .map(instance => {
          const connection = connections.find(conn => conn.instance_id === instance.id);
          const queue = queues?.find(q => q.id === connection?.queue_id);
          const assistant = activeAssistants.find(a => a.id === queue?.assistant_id);
          
          return `${instance.custom_name || instance.instance_id} → ${queue?.name || 'Sem fila'} → ${assistant?.name || 'Sem assistente'}`;
        });

      console.log('✅ [AUTO-PROCESSOR-STATUS] Análise final:', {
        hasValidConnections,
        totalConnections: connections.length,
        connectedInstanceNames,
        instancesConectadas: instances.length,
        conexoesAtivas: connections.length,
        filasAtivas: queues?.length || 0,
        assistentesAtivos: activeAssistants.length
      });
      
      setStatus({
        isInitialized: processorStatus.isInitialized,
        hasActiveConnections: hasValidConnections,
        totalConnections: connections.length,
        connectedInstances: connectedInstanceNames,
        lastActivity: processorStatus.timestamp
      });

      setAutoProcess(processorStatus.isInitialized && hasValidConnections);

    } catch (error) {
      console.error('❌ [AUTO-PROCESSOR-STATUS] Erro crítico ao carregar status:', error);
    }
  };

  const handleToggleProcessor = async () => {
    setLoading(true);
    try {
      if (status.isInitialized) {
        // Parar processador
        humanizedMessageProcessor.stop();
        setAutoProcess(false);
        
        toast({
          title: "Processador IA Desativado",
          description: "O assistente de IA não responderá automaticamente",
        });
      } else {
        // Inicializar processador
        await humanizedMessageProcessor.initialize(clientId);
        setAutoProcess(true);
        
        toast({
          title: "Processador IA Ativado",
          description: "O assistente de IA responderá automaticamente às mensagens",
        });
      }
      
      // Atualizar status após mudança
      setTimeout(loadProcessorStatus, 1000);
      
    } catch (error: any) {
      console.error('Erro ao alterar processador:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar status do processador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!status.hasActiveConnections) return "text-amber-600";
    if (status.isInitialized && status.hasActiveConnections) return "text-green-600";
    return "text-red-600";
  };

  const getStatusBadge = () => {
    if (!status.hasActiveConnections) {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Configuração Pendente
        </Badge>
      );
    }
    
    if (status.isInitialized && status.hasActiveConnections) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ativo
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        <Pause className="h-3 w-3 mr-1" />
        Inativo
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>Assistente IA Automático</CardTitle>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={autoProcess}
              onCheckedChange={handleToggleProcessor}
              disabled={loading || !status.hasActiveConnections}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
        <CardDescription>
          Sistema de resposta automática com inteligência artificial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status atual */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-600">Status do Processador</div>
            <div className={`font-medium ${getStatusColor()}`}>
              {status.isInitialized ? 'Inicializado' : 'Desligado'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Conexões Ativas</div>
            <div className="font-medium">
              {status.totalConnections} instância{status.totalConnections !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Instâncias conectadas */}
        {status.connectedInstances.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Instâncias com IA Ativa:</div>
            <div className="space-y-1">
              {status.connectedInstances.map((instance, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-3 w-3 text-green-500" />
                  <span>{instance}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertas */}
        {!status.hasActiveConnections && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Para ativar a IA automática, conecte suas instâncias WhatsApp às filas com assistentes ativos.
              <Button variant="link" className="ml-2 p-0 h-auto">
                Ir para Conexões
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {status.hasActiveConnections && !status.isInitialized && (
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              Tudo configurado! Ative o processador para que a IA responda automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadProcessorStatus}
          >
            <Settings className="h-3 w-3 mr-1" />
            Atualizar Status
          </Button>
          
          {!status.isInitialized && status.hasActiveConnections && (
            <Button 
              variant="default" 
              size="sm"
              onClick={handleToggleProcessor}
              disabled={loading}
            >
              <Play className="h-3 w-3 mr-1" />
              Forçar Inicialização
            </Button>
          )}
          
          {/* FORÇA SEMPRE MOSTRAR O BOTÃO PARA DEBUG */}
          <Button 
            variant="secondary" 
            size="sm"
            onClick={async () => {
              console.log('🚨 [FORCE-INIT] Inicialização manual FORÇADA ignorando conexões');
              setLoading(true);
              try {
                await humanizedMessageProcessor.initialize(clientId);
                setAutoProcess(true);
                toast({
                  title: "IA Inicializada Manualmente",
                  description: "Processador foi iniciado independente das conexões",
                });
                setTimeout(loadProcessorStatus, 1000);
              } catch (error: any) {
                toast({
                  title: "Erro na Inicialização",
                  description: error.message,
                  variant: "destructive",
                });
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Zap className="h-3 w-3 mr-1" />
            {loading ? "Inicializando..." : "FORÇA INICIALIZAR"}
          </Button>
          
          {status.isInitialized && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleToggleProcessor}
              disabled={loading}
            >
              <Pause className="h-3 w-3 mr-1" />
              Pausar IA
            </Button>
          )}
        </div>

        {/* Última atividade */}
        {status.lastActivity && (
          <div className="text-xs text-gray-500 pt-1 border-t">
            Última verificação: {status.lastActivity.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIAutoProcessorStatus;