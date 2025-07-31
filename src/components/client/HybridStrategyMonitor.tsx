import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wifi, Activity, Shield, Send, Download, Clock } from 'lucide-react';

interface HybridStrategyMonitorProps {
  // WebSocket status (receiving)
  wsConnected: boolean;
  isFallbackActive: boolean;
  reconnectAttempts: number;
  isCircuitBreakerBlocked?: boolean;
  circuitBreakerUnblockTime?: number;
  
  // Message stats
  messagesReceived?: number;
  messagesSent?: number;
  lastUpdateSource?: string;
  
  className?: string;
}

const HybridStrategyMonitor = ({
  wsConnected,
  isFallbackActive,
  reconnectAttempts,
  isCircuitBreakerBlocked = false,
  circuitBreakerUnblockTime = 0,
  messagesReceived = 0,
  messagesSent = 0,
  lastUpdateSource = 'polling',
  className = ''
}: HybridStrategyMonitorProps) => {
  
  const getReceivingStatus = () => {
    if (isCircuitBreakerBlocked) {
      return { 
        text: 'Servidor Indisponível', 
        color: 'bg-red-500', 
        icon: Shield,
        description: 'Circuit breaker ativo - usando Supabase'
      };
    }
    if (wsConnected) {
      return { 
        text: 'WebSocket Ativo', 
        color: 'bg-green-500', 
        icon: Wifi,
        description: 'Recebendo mensagens em tempo real'
      };
    }
    if (isFallbackActive) {
      return { 
        text: 'Supabase Fallback', 
        color: 'bg-yellow-500', 
        icon: Activity,
        description: 'Usando Supabase como backup'
      };
    }
    return { 
      text: 'Polling', 
      color: 'bg-orange-500', 
      icon: Clock,
      description: 'Verificação periódica'
    };
  };

  const getSendingStatus = () => {
    return {
      text: 'REST API',
      color: 'bg-blue-500',
      icon: Send,
      description: 'Enviando via REST (100% confiável)'
    };
  };

  const getCircuitBreakerTimeRemaining = () => {
    if (!isCircuitBreakerBlocked || !circuitBreakerUnblockTime) return null;
    
    const remaining = Math.max(0, circuitBreakerUnblockTime - Date.now());
    const minutes = Math.ceil(remaining / (60 * 1000));
    
    return minutes > 0 ? minutes : null;
  };

  const receivingStatus = getReceivingStatus();
  const sendingStatus = getSendingStatus();
  const RecReceivingIcon = receivingStatus.icon;
  const SendingIcon = sendingStatus.icon;
  const timeRemaining = getCircuitBreakerTimeRemaining();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Estratégia Híbrida
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Receiving Strategy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Recebimento</span>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-white text-xs flex items-center gap-1 ${receivingStatus.color}`}
            >
              <RecReceivingIcon className="h-3 w-3" />
              {receivingStatus.text}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{receivingStatus.description}</p>
          
          {/* Circuit breaker countdown */}
          {timeRemaining && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Tentativa em:</span>
                <span className="font-mono">{timeRemaining}min</span>
              </div>
              <Progress value={(5 - timeRemaining) / 5 * 100} className="h-1" />
            </div>
          )}
          
          {/* Reconnect attempts */}
          {reconnectAttempts > 0 && !isCircuitBreakerBlocked && (
            <div className="text-xs text-muted-foreground">
              Tentativas de reconexão: {reconnectAttempts}/3
            </div>
          )}
        </div>

        {/* Sending Strategy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Envio</span>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-white text-xs flex items-center gap-1 ${sendingStatus.color}`}
            >
              <SendingIcon className="h-3 w-3" />
              {sendingStatus.text}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{sendingStatus.description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{messagesReceived}</div>
            <div className="text-xs text-muted-foreground">Recebidas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{messagesSent}</div>
            <div className="text-xs text-muted-foreground">Enviadas</div>
          </div>
        </div>

        {/* Last update source */}
        <div className="text-xs text-center text-muted-foreground pt-2 border-t">
          Última via: <span className="font-medium">{lastUpdateSource}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default HybridStrategyMonitor;