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

  const loadProcessorStatus = async () => {
    try {
      // Verificar status do processador
      const processorStatus = humanizedMessageProcessor.getStatus();
      
      // Buscar conexões ativas de instância-fila
      const { data: connections, error } = await supabase
        .from('instance_queue_connections')
        .select(`
          id,
          is_active,
          whatsapp_instances!inner (
            instance_id,
            custom_name,
            client_id
          ),
          queues!inner (
            name,
            is_active,
            assistants!inner (
              name,
              is_active
            )
          )
        `)
        .eq('whatsapp_instances.client_id', clientId)
        .eq('is_active', true)
        .eq('queues.is_active', true)
        .eq('queues.assistants.is_active', true);

      if (error) {
        console.error('Erro ao buscar conexões:', error);
        return;
      }

      const activeConnections = connections || [];
      
      setStatus({
        isInitialized: processorStatus.isInitialized,
        hasActiveConnections: activeConnections.length > 0,
        totalConnections: activeConnections.length,
        connectedInstances: activeConnections.map(c => 
          c.whatsapp_instances?.custom_name || c.whatsapp_instances?.instance_id || 'Desconhecida'
        ),
        lastActivity: processorStatus.timestamp
      });

      setAutoProcess(processorStatus.isInitialized && activeConnections.length > 0);

    } catch (error) {
      console.error('Erro ao carregar status do processador:', error);
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