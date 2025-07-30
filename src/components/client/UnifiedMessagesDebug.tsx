import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Database, Clock } from 'lucide-react';

interface UnifiedMessagesDebugProps {
  wsConnected: boolean;
  isFallbackActive: boolean;
  reconnectAttempts: number;
  lastUpdateSource: 'websocket' | 'supabase' | 'polling';
  messagesCount: number;
  onReload: () => void;
}

const UnifiedMessagesDebug = ({
  wsConnected,
  isFallbackActive,
  reconnectAttempts,
  lastUpdateSource,
  messagesCount,
  onReload
}: UnifiedMessagesDebugProps) => {
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'websocket': return 'bg-green-500';
      case 'supabase': return 'bg-blue-500';
      case 'polling': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'websocket': return <Wifi className="h-3 w-3" />;
      case 'supabase': return <Database className="h-3 w-3" />;
      case 'polling': return <Clock className="h-3 w-3" />;
      default: return null;
    }
  };

  const getConnectionStatus = () => {
    if (wsConnected && !isFallbackActive) return 'WebSocket Ativo';
    if (isFallbackActive) return 'Modo Fallback';
    return 'Desconectado';
  };

  const getConnectionColor = () => {
    if (wsConnected && !isFallbackActive) return 'bg-green-500';
    if (isFallbackActive) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          Sistema Unificado de Mensagens
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onReload}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status da Conexão */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status:</span>
          <Badge 
            variant="secondary" 
            className={`text-white text-xs flex items-center gap-1 ${getConnectionColor()}`}
          >
            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {getConnectionStatus()}
          </Badge>
        </div>

        {/* Última Fonte de Atualização */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Última atualização:</span>
          <Badge 
            variant="secondary" 
            className={`text-white text-xs flex items-center gap-1 ${getSourceColor(lastUpdateSource)}`}
          >
            {getSourceIcon(lastUpdateSource)}
            {lastUpdateSource.toUpperCase()}
          </Badge>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{messagesCount}</div>
            <div className="text-xs text-muted-foreground">Mensagens</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{reconnectAttempts}</div>
            <div className="text-xs text-muted-foreground">Tentativas</div>
          </div>
        </div>

        {/* Indicadores de Canal */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-foreground">Canais Ativos:</div>
          <div className="flex gap-1">
            <Badge 
              variant={wsConnected ? "default" : "secondary"} 
              className="text-xs"
            >
              WebSocket {wsConnected ? '✓' : '✗'}
            </Badge>
            <Badge variant="default" className="text-xs">
              Supabase ✓
            </Badge>
            <Badge 
              variant={isFallbackActive ? "default" : "secondary"} 
              className="text-xs"
            >
              Polling {isFallbackActive ? '✓' : '⏸️'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedMessagesDebug;