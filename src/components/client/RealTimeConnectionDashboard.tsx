import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Activity, AlertTriangle, RotateCcw, Zap } from 'lucide-react';

interface RealTimeConnectionDashboardProps {
  wsConnected: boolean;
  isFallbackActive: boolean;
  reconnectAttempts: number;
  lastUpdateSource: string;
  messageCount: number;
  onReload?: () => void;
  className?: string;
}

export const RealTimeConnectionDashboard = ({
  wsConnected,
  isFallbackActive,
  reconnectAttempts,
  lastUpdateSource,
  messageCount,
  onReload,
  className = ''
}: RealTimeConnectionDashboardProps) => {
  
  const getConnectionStatus = () => {
    if (wsConnected) return { color: 'bg-green-500', text: 'WebSocket Ativo', icon: Wifi };
    if (isFallbackActive) return { color: 'bg-yellow-500', text: 'Fallback Ativo', icon: Activity };
    return { color: 'bg-red-500', text: 'Desconectado', icon: WifiOff };
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'websocket':
        return <Badge className="bg-green-100 text-green-800 border-green-300">🔗 WebSocket</Badge>;
      case 'supabase':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">🗄️ Supabase</Badge>;
      case 'inicial':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">📋 Inicial</Badge>;
      default:
        return <Badge variant="outline">❓ {source}</Badge>;
    }
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <Card className={`border-l-4 ${wsConnected ? 'border-l-green-500' : isFallbackActive ? 'border-l-yellow-500' : 'border-l-red-500'} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Status da Conexão
          </div>
          {onReload && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onReload}
              className="h-7 w-7 p-0"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Status Principal */}
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.color}`} />
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{status.text}</span>
          </div>
        </div>

        {/* Tentativas de Reconexão */}
        {reconnectAttempts > 0 && !wsConnected && (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span className="text-amber-700">
              Tentativas de reconexão: {reconnectAttempts}
            </span>
          </div>
        )}

        {/* Última Fonte de Atualização */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Última fonte:</span>
          {getSourceBadge(lastUpdateSource)}
        </div>

        {/* Contador de Mensagens */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Mensagens:</span>
          <Badge variant="outline" className="text-xs">
            {messageCount}
          </Badge>
        </div>

        {/* Indicador de Priorização */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>WebSocket (Prioridade 1)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>Supabase (Backup)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span>Polling (Emergência)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeConnectionDashboard;