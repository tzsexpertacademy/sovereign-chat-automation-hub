/**
 * Painel de monitoramento de mensagens não processadas
 * PARTE 4: Melhorar monitoramento - Indicadores visuais
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useUnprocessedMessageMonitor } from '@/hooks/useUnprocessedMessageMonitor';
import { 
  MessageSquare, 
  AlertTriangle, 
  PlayCircle, 
  RefreshCw, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp
} from 'lucide-react';

interface UnprocessedMessagesPanelProps {
  clientId: string;
}

export const UnprocessedMessagesPanel: React.FC<UnprocessedMessagesPanelProps> = ({ 
  clientId 
}) => {
  const {
    stats,
    processingStatus,
    isLoading,
    error,
    hasOldMessages,
    isProcessing,
    loadStats,
    processUnprocessedMessages
  } = useUnprocessedMessageMonitor(clientId);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d atrás`;
    if (diffHours > 0) return `${diffHours}h atrás`;
    if (diffMins > 0) return `${diffMins}min atrás`;
    return 'Agora mesmo';
  };

  const getStatusColor = () => {
    if (stats.totalUnprocessed === 0) return 'text-green-600';
    if (hasOldMessages) return 'text-red-600';
    if (stats.totalUnprocessed > 10) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const getStatusIcon = () => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (stats.totalUnprocessed === 0) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (hasOldMessages) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    return <MessageSquare className="h-4 w-4 text-orange-600" />;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">Mensagens Não Processadas</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={isLoading || isProcessing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Monitoramento e processamento de mensagens pendentes
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Principal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>
              {stats.totalUnprocessed}
            </div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {processingStatus.processed}
            </div>
            <div className="text-sm text-muted-foreground">Processadas</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {processingStatus.errors}
            </div>
            <div className="text-sm text-muted-foreground">Erros</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {processingStatus.processing}
            </div>
            <div className="text-sm text-muted-foreground">Processando</div>
          </div>
        </div>

        {/* Alerta para mensagens antigas */}
        {hasOldMessages && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Há mensagens antigas não processadas. A mais antiga é de{' '}
                <strong>{formatTimeAgo(stats.oldestMessage!)}</strong>
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progresso do processamento */}
        {isProcessing && processingStatus.totalPending > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processando mensagens...</span>
              <span>
                {processingStatus.processed + processingStatus.errors} / {processingStatus.totalPending}
              </span>
            </div>
            <Progress 
              value={((processingStatus.processed + processingStatus.errors) / processingStatus.totalPending) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Breakdown por instância */}
        {stats.instanceBreakdown.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Por Instância
            </h4>
            <div className="space-y-2">
              {stats.instanceBreakdown.map((item) => (
                <div key={item.instanceId} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm font-medium">{item.instanceName}</span>
                  <Badge variant={item.count > 5 ? 'destructive' : 'secondary'}>
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={processUnprocessedMessages}
            disabled={isLoading || isProcessing || stats.totalUnprocessed === 0}
            className="flex-1"
          >
            {isLoading || isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Processar Agora ({stats.totalUnprocessed})
              </>
            )}
          </Button>
        </div>

        {/* Info da última verificação */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Última verificação: {formatTimeAgo(stats.lastCheck)}
        </div>

        {/* Status de processamento recente */}
        {processingStatus.lastProcessed && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Último processamento: {formatTimeAgo(processingStatus.lastProcessed)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};