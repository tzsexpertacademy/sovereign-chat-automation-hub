/**
 * Painel de Status de Processamento de Mensagens
 * Mostra informações detalhadas sobre o pipeline de processamento
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProcessingMonitor } from '@/hooks/useProcessingMonitor';
import { RefreshCw, Play, Trash2, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface ProcessingStatusPanelProps {
  clientId: string;
}

export const ProcessingStatusPanel: React.FC<ProcessingStatusPanelProps> = ({ clientId }) => {
  const { status, isLoading, lastUpdate, refresh, forceProcessing, cleanupController } = useProcessingMonitor(clientId);

  const handleForceProcessing = async () => {
    await forceProcessing();
  };

  if (!status) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBatchStatus = () => {
    if (status.batches.processing > 0) return { color: 'bg-blue-500', text: 'Processando', icon: Loader2 };
    if (status.batches.pending > 0) return { color: 'bg-yellow-500', text: 'Pendente', icon: Clock };
    return { color: 'bg-green-500', text: 'Em dia', icon: CheckCircle };
  };

  const getMediaStatus = () => {
    if (status.media.failed > 0) return { color: 'bg-red-500', text: 'Com falhas', icon: AlertTriangle };
    if (status.media.pending > 0) return { color: 'bg-yellow-500', text: 'Pendente', icon: Clock };
    return { color: 'bg-green-500', text: 'Em dia', icon: CheckCircle };
  };

  const batchStatus = getBatchStatus();
  const mediaStatus = getMediaStatus();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Status do Processamento</CardTitle>
              <CardDescription>
                Pipeline de mensagens e mídia
                {lastUpdate && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Última atualização: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleForceProcessing}
              >
                <Play className="h-4 w-4 mr-1" />
                Forçar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cleanupController}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status de Batches */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${batchStatus.color}`} />
                <span className="text-sm font-medium">Batches</span>
                <batchStatus.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total (24h):</span>
                  <Badge variant="outline">{status.batches.total}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pendentes:</span>
                  <Badge variant={status.batches.pending > 0 ? "destructive" : "secondary"}>
                    {status.batches.pending}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Processando:</span>
                  <Badge variant={status.batches.processing > 0 ? "default" : "secondary"}>
                    {status.batches.processing}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status de Mensagens */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status.messages.unprocessed > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-sm font-medium">Mensagens</span>
                {status.messages.unprocessed > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Recentes (24h):</span>
                  <Badge variant="outline">{status.messages.recentMessages}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Não processadas:</span>
                  <Badge variant={status.messages.unprocessed > 0 ? "destructive" : "secondary"}>
                    {status.messages.unprocessed}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status de Mídia */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${mediaStatus.color}`} />
                <span className="text-sm font-medium">Mídia</span>
                <mediaStatus.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Completadas:</span>
                  <Badge variant="secondary">{status.media.completed}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pendentes:</span>
                  <Badge variant={status.media.pending > 0 ? "destructive" : "secondary"}>
                    {status.media.pending}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Falhas:</span>
                  <Badge variant={status.media.failed > 0 ? "destructive" : "secondary"}>
                    {status.media.failed}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Controller Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">Controller</span>
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Locks ativos:</span>
                  <Badge variant={status.controller.activeLocks > 0 ? "default" : "secondary"}>
                    {status.controller.activeLocks}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Processadas:</span>
                  <Badge variant="outline">{status.controller.processedMessages}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {(status.messages.unprocessed > 0 || status.media.failed > 0 || status.batches.pending > 5) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Atenção Necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1 text-sm text-yellow-700">
              {status.messages.unprocessed > 0 && (
                <div>• {status.messages.unprocessed} mensagens não processadas</div>
              )}
              {status.media.failed > 0 && (
                <div>• {status.media.failed} mídias com falha na descriptografia</div>
              )}
              {status.batches.pending > 5 && (
                <div>• Muitos batches pendentes ({status.batches.pending})</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};