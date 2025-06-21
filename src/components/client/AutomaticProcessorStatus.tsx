
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bot, Zap, Pause, Play, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAutomaticMessageProcessor } from '@/hooks/useAutomaticMessageProcessor';

interface AutomaticProcessorStatusProps {
  clientId: string;
}

const AutomaticProcessorStatus = ({ clientId }: AutomaticProcessorStatusProps) => {
  const { processors, isProcessing, reloadProcessors } = useAutomaticMessageProcessor(clientId);
  const [autoProcessingEnabled, setAutoProcessingEnabled] = useState(true);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <span>Processamento Automático</span>
            {isProcessing && (
              <div className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                <span className="text-sm text-yellow-600">Processando...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={autoProcessingEnabled}
              onCheckedChange={setAutoProcessingEnabled}
            />
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
        {processors.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Bot className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Nenhum assistente ativo</p>
            <p className="text-xs">Configure filas e assistentes para ativar o processamento automático</p>
          </div>
        ) : (
          <div className="space-y-3">
            {processors.map((processor) => (
              <div key={processor.instanceId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {processor.isActive && autoProcessingEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      Instância {processor.instanceId.split('_').pop()}
                    </span>
                  </div>
                  
                  {processor.queueConnection && (
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        Fila: {processor.queueConnection.name}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Bot className="w-3 h-3 mr-1" />
                        {processor.queueConnection.assistants?.name}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={processor.isActive && autoProcessingEnabled ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {processor.isActive && autoProcessingEnabled ? (
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
            ))}
          </div>
        )}
        
        {processors.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Bot className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Sistema Ativo</p>
                <p className="text-xs mt-1">
                  Mensagens recebidas serão processadas automaticamente pelos assistentes configurados nas filas.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AutomaticProcessorStatus;
