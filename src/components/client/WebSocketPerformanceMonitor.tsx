import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { socketIOWebSocketService } from '@/services/socketIOWebSocketService';
import { Activity, Zap, Shield, Clock, TrendingUp } from 'lucide-react';

interface WebSocketPerformanceMonitorProps {
  instanceId?: string;
  clientId?: string;
  className?: string;
}

const WebSocketPerformanceMonitor = ({ 
  instanceId, 
  clientId, 
  className = '' 
}: WebSocketPerformanceMonitorProps) => {
  const [status, setStatus] = useState<any>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = socketIOWebSocketService.getStatus();
      setStatus(currentStatus);
      setLastUpdate(new Date());
    };

    // Atualizar imediatamente
    updateStatus();

    // Atualizar a cada 2 segundos para performance otimizada
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const getCircuitBreakerStatus = () => {
    if (status.circuitBreakerOpen) {
      return {
        label: 'Circuit Breaker ATIVO',
        color: 'destructive',
        icon: <Shield className="h-3 w-3" />
      };
    }
    return {
      label: 'Circuit Breaker OK',
      color: 'secondary',
      icon: <Shield className="h-3 w-3 text-green-500" />
    };
  };

  const getHealthStatus = () => {
    if (status.serverHealthy === false) {
      return {
        label: 'Servidor Não Saudável',
        color: 'destructive',
        icon: <Activity className="h-3 w-3" />
      };
    }
    return {
      label: 'Servidor Saudável',
      color: 'secondary',
      icon: <Activity className="h-3 w-3 text-green-500" />
    };
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  const connectionHealth = status.connected ? 100 : 0;
  const circuitBreakerHealth = status.circuitBreakerOpen ? 0 : 100;
  const serverHealth = status.serverHealthy ? 100 : 0;

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Performance Monitor
          <Badge variant="outline" className="text-xs ml-auto">
            WebSocket Otimizado
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status da Conexão */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Status da Conexão</span>
            <Badge 
              variant={status.connected ? "secondary" : "destructive"}
              className="text-xs"
            >
              {status.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
          <Progress value={connectionHealth} className="h-2" />
        </div>

        {/* Circuit Breaker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Circuit Breaker</span>
            <Badge 
              variant={getCircuitBreakerStatus().color as any}
              className="text-xs flex items-center gap-1"
            >
              {getCircuitBreakerStatus().icon}
              {getCircuitBreakerStatus().label}
            </Badge>
          </div>
          <Progress value={circuitBreakerHealth} className="h-2" />
        </div>

        {/* Saúde do Servidor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Saúde do Servidor</span>
            <Badge 
              variant={getHealthStatus().color as any}
              className="text-xs flex items-center gap-1"
            >
              {getHealthStatus().icon}
              {getHealthStatus().label}
            </Badge>
          </div>
          <Progress value={serverHealth} className="h-2" />
        </div>

        {/* Métricas de Performance */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Tempo Conexão
            </div>
            <div className="font-mono text-primary">
              {formatDuration(status.performanceMetrics?.connectionTime)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Mensagens
            </div>
            <div className="font-mono text-primary">
              {status.performanceMetrics?.totalMessagesProcessed || 0}
            </div>
          </div>
        </div>

        {/* Último Health Check */}
        {status.lastHealthCheck && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="flex justify-between">
              <span>Último Health Check:</span>
              <span className="font-mono">
                {formatTime(status.lastHealthCheck.getTime?.() || Date.now())}
              </span>
            </div>
          </div>
        )}

        {/* Status de Autenticação */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          <div className="flex justify-between">
            <span>Autenticado:</span>
            <span className={status.authenticated ? 'text-green-500' : 'text-red-500'}>
              {status.authenticated ? 'Sim' : 'Não'}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Configurado:</span>
            <span className={status.configured ? 'text-green-500' : 'text-red-500'}>
              {status.configured ? 'Sim' : 'Não'}
            </span>
          </div>
        </div>

        {/* Última Atualização */}
        <div className="text-xs text-muted-foreground text-center border-t pt-2">
          Atualizado: {lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default WebSocketPerformanceMonitor;