
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {getOverallStatusIcon()}
            Status do Sistema
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getOverallStatusColor()}>
              {getOverallStatusText()}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={checkSystemHealth}
              disabled={isChecking}
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Webhook Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Webhook</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={
                status.webhook.configured && status.webhook.working
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : status.webhook.configured
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }
            >
              {status.webhook.configured && status.webhook.working
                ? 'Funcionando'
                : status.webhook.configured
                ? 'Configurado'
                : 'Não Configurado'
              }
            </Badge>
            {status.webhook.lastCheck && (
              <span className="text-xs text-gray-500">
                {formatLastTime(status.webhook.lastCheck)}
              </span>
            )}
          </div>
        </div>

        {/* Realtime Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Tempo Real</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={
                status.realtime.connected
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }
            >
              {status.realtime.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
            {status.realtime.lastMessage && (
              <span className="text-xs text-gray-500">
                {formatLastTime(status.realtime.lastMessage)}
              </span>
            )}
          </div>
        </div>

        {/* Import Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Importação</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={
                status.import.isRunning
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : status.import.lastImport
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-800 border-gray-200'
              }
            >
              {status.import.isRunning
                ? 'Executando'
                : status.import.lastImport
                ? 'Concluída'
                : 'Pendente'
              }
            </Badge>
            {status.import.lastImport && (
              <span className="text-xs text-gray-500">
                {formatLastTime(status.import.lastImport)}
              </span>
            )}
          </div>
        </div>

        {/* Auto Repair Button */}
        {status.overall !== 'healthy' && (
          <div className="pt-2 border-t">
            <Button
              size="sm"
              onClick={autoRepairSystem}
              className="w-full"
              variant={status.overall === 'critical' ? 'destructive' : 'secondary'}
            >
              <Settings className="w-3 h-3 mr-2" />
              Reparar Sistema Automaticamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemHealthIndicator;
