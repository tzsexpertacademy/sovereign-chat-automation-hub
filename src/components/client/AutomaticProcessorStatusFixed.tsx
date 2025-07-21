
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Zap, 
  Pause, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Activity,
  MessageSquare,
  Users,
  Smartphone
} from 'lucide-react';
import { useAutomaticMessageProcessorFixed } from '@/hooks/useAutomaticMessageProcessorFixed';

interface AutomaticProcessorStatusProps {
  clientId: string;
}

const AutomaticProcessorStatusFixed = ({ clientId }: AutomaticProcessorStatusProps) => {
  const { 
    processors, 
    stats, 
    isProcessing, 
    error,
    reloadProcessors,
    toggleProcessing,
    simulateMessageProcessing
  } = useAutomaticMessageProcessorFixed(clientId);
  
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const handleGlobalToggle = (enabled: boolean) => {
    setGlobalEnabled(enabled);
    processors.forEach(processor => {
      if (processor.queueConnection?.assistants) {
        toggleProcessing(processor.instanceId, enabled);
      }
    });
  };

  const handleInstanceToggle = (instanceId: string, enabled: boolean) => {
    toggleProcessing(instanceId, enabled && globalEnabled);
  };

  const handleTestMessage = (instanceId: string) => {
    simulateMessageProcessing(instanceId);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar processadores: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <span>Sistema de Processamento Automático</span>
            {isProcessing && (
              <div className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                <span className="text-sm text-yellow-600">Processando...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Sistema:</span>
              <Switch
                checked={globalEnabled}
                onCheckedChange={handleGlobalToggle}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadProcessors}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Recarregar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Smartphone className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Instâncias</div>
          </div>
          
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-lg font-bold">{stats.withQueues}</div>
            <div className="text-xs text-muted-foreground">Com Filas</div>
          </div>
          
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Bot className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-lg font-bold">{stats.withAssistants}</div>
            <div className="text-xs text-muted-foreground">Com IA</div>
          </div>
          
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg font-bold">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
        </div>

        {processors.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">Nenhum processador disponível</p>
            <p className="text-sm mt-1">
              Configure filas com assistentes IA e conecte instâncias WhatsApp
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {processors.map((processor) => (
              <div key={processor.instanceId} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {processor.isActive && globalEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">{processor.instanceName}</div>
                      {processor.phoneNumber && (
                        <div className="text-xs text-muted-foreground">
                          {processor.phoneNumber}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {processor.queueConnection ? (
                      <>
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {processor.queueConnection.name}
                        </Badge>
                        {processor.queueConnection.assistants && (
                          <Badge variant="secondary" className="text-xs">
                            <Bot className="w-3 h-3 mr-1" />
                            {processor.queueConnection.assistants.name}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Interação Humana
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {processor.messageCount !== undefined && processor.messageCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {processor.messageCount} msgs
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    {processor.queueConnection?.assistants && (
                      <>
                        <Switch
                          checked={processor.isActive && globalEnabled}
                          onCheckedChange={(enabled) => handleInstanceToggle(processor.instanceId, enabled)}
                          disabled={!globalEnabled}
                          size="sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestMessage(processor.instanceId)}
                          disabled={!processor.isActive || !globalEnabled}
                        >
                          Testar
                        </Button>
                      </>
                    )}
                    
                    <Badge 
                      variant={processor.isActive && globalEnabled ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {processor.isActive && globalEnabled ? (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Pausado
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {processors.length > 0 && stats.active > 0 && (
          <Alert className="mt-4">
            <Bot className="w-4 h-4" />
            <AlertDescription>
              <div className="font-medium">Sistema de IA Ativo</div>
              <div className="text-sm mt-1">
                {stats.active} assistente(s) processando mensagens automaticamente. 
                Mensagens recebidas nas instâncias conectadas serão respondidas pela IA.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AutomaticProcessorStatusFixed;
