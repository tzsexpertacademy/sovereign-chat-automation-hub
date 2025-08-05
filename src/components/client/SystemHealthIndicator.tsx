
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Wifi, 
  Webhook, 
  Download,
  Settings
} from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SystemHealthIndicatorProps {
  clientId: string;
}

const SystemHealthIndicator = ({ clientId }: SystemHealthIndicatorProps) => {
  const { status, isChecking, checkSystemHealth, autoRepairSystem } = useSystemHealth(clientId);

  const getOverallStatusIcon = () => {
    switch (status.overall) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getOverallStatusColor = () => {
    switch (status.overall) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOverallStatusText = () => {
    switch (status.overall) {
      case 'healthy':
        return 'Sistema Saudável';
      case 'degraded':
        return 'Sistema Degradado';
      case 'critical':
        return 'Sistema Crítico';
      default:
        return 'Status Desconhecido';
    }
  };

  const formatLastTime = (date: Date | null) => {
    if (!date) return 'Nunca';
    return formatDistanceToNow(date, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  return (
    <Card className="w-full">
      <CardContent className="p-3">
        {/* Status Horizontal Compacto */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Status Geral */}
          <div className="flex items-center gap-2">
            {getOverallStatusIcon()}
            <span className="font-medium">Sistema:</span>
            <Badge variant="outline" className={`text-xs ${getOverallStatusColor()}`}>
              {getOverallStatusText()}
            </Badge>
          </div>
          
          {/* Separador */}
          <div className="w-px h-4 bg-gray-300 hidden sm:block" />
          
          {/* Webhook Status */}
          <div className="flex items-center gap-2">
            <Webhook className="w-3 h-3 text-gray-500" />
            <span>Webhook:</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                status.webhook.configured && status.webhook.working
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : status.webhook.configured
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }`}
            >
              {status.webhook.configured && status.webhook.working
                ? 'OK'
                : status.webhook.configured
                ? 'Config'
                : 'Não Config'
              }
            </Badge>
          </div>

          {/* Separador */}
          <div className="w-px h-4 bg-gray-300 hidden sm:block" />

          {/* Realtime Status */}
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-gray-500" />
            <span>Tempo Real:</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                status.realtime.connected
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }`}
            >
              {status.realtime.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>

          {/* Separador */}
          <div className="w-px h-4 bg-gray-300 hidden sm:block" />

          {/* Import Status */}
          <div className="flex items-center gap-2">
            <Download className="w-3 h-3 text-gray-500" />
            <span>Import:</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                status.import.isRunning
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : status.import.lastImport
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-800 border-gray-200'
              }`}
            >
              {status.import.isRunning
                ? 'Executando'
                : status.import.lastImport
                ? 'OK'
                : 'Pendente'
              }
            </Badge>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 ml-auto">
            {status.overall !== 'healthy' && (
              <Button
                size="sm"
                onClick={autoRepairSystem}
                variant={status.overall === 'critical' ? 'destructive' : 'secondary'}
                className="text-xs px-2 py-1 h-6"
              >
                <Settings className="w-3 h-3 mr-1" />
                Reparar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={checkSystemHealth}
              disabled={isChecking}
              className="text-xs px-2 py-1 h-6"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemHealthIndicator;
