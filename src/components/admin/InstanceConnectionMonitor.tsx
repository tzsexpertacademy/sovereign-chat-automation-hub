import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, RefreshCw, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import unifiedYumerService from "@/services/unifiedYumerService";

interface InstanceConnectionMonitorProps {
  instances: WhatsAppInstanceData[];
  onRefresh: () => void;
}

interface InstanceStatus {
  instanceId: string;
  status: 'idle' | 'checking' | 'connected' | 'disconnected' | 'qr_ready' | 'error';
  connectionState?: string;
  qrCode?: string;
  lastChecked: number;
  progress: number;
  message: string;
}

export const InstanceConnectionMonitor = ({ instances, onRefresh }: InstanceConnectionMonitorProps) => {
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatus>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkAllInstancesStatus();
    
    // Auto-check a cada 30 segundos
    const interval = setInterval(checkAllInstancesStatus, 30000);
    return () => clearInterval(interval);
  }, [instances]);

  const updateInstanceStatus = (instanceId: string, updates: Partial<InstanceStatus>) => {
    setInstanceStatuses(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        ...updates,
        lastChecked: Date.now()
      }
    }));
  };

  const checkAllInstancesStatus = async () => {
    if (instances.length === 0) return;

    console.log('🔍 [MONITOR] Verificando status de todas as instâncias...');
    
    for (const instance of instances) {
      checkInstanceStatus(instance.instance_id);
    }
  };

  const checkInstanceStatus = async (instanceId: string) => {
    try {
      updateInstanceStatus(instanceId, {
        status: 'checking',
        progress: 30,
        message: 'Verificando conexão...',
        instanceId
      });

      // Verificar estado da conexão
      const stateResult = await unifiedYumerService.getConnectionState(instanceId);
      
      if (!stateResult.success) {
        updateInstanceStatus(instanceId, {
          status: 'error',
          progress: 0,
          message: stateResult.error || 'Erro ao verificar status'
        });
        return;
      }

      const connectionState = stateResult.data?.state;
      
      if (connectionState === 'open') {
        updateInstanceStatus(instanceId, {
          status: 'connected',
          connectionState,
          progress: 100,
          message: 'Conectado e funcionando'
        });
      } else if (connectionState === 'connecting') {
        // Verificar se tem QR code disponível
        const qrResult = await unifiedYumerService.getQRCode(instanceId);
        
        if (qrResult.success && qrResult.data?.qrcode?.code) {
          updateInstanceStatus(instanceId, {
            status: 'qr_ready',
            connectionState,
            qrCode: qrResult.data.qrcode.code,
            progress: 75,
            message: 'QR Code disponível para escaneio'
          });
        } else {
          updateInstanceStatus(instanceId, {
            status: 'disconnected',
            connectionState,
            progress: 25,
            message: 'Aguardando QR Code...'
          });
        }
      } else {
        updateInstanceStatus(instanceId, {
          status: 'disconnected',
          connectionState,
          progress: 0,
          message: 'Desconectado'
        });
      }

    } catch (error: any) {
      updateInstanceStatus(instanceId, {
        status: 'error',
        progress: 0,
        message: error.message || 'Erro na verificação'
      });
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await checkAllInstancesStatus();
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusIcon = (status: InstanceStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'qr_ready':
        return <QrCode className="h-4 w-4 text-blue-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: InstanceStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'qr_ready':
        return 'bg-blue-500';
      case 'checking':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Monitor de Conexões</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma instância encontrada
            </p>
          ) : (
            instances.map((instance) => {
              const status = instanceStatuses[instance.instance_id];
              const timeSinceCheck = status ? Date.now() - status.lastChecked : 0;
              
              return (
                <div key={instance.instance_id} className="flex items-center space-x-4 p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status?.status || 'idle')}
                    <div>
                      <p className="text-sm font-medium">
                        {instance.custom_name || instance.instance_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {instance.phone_number || 'Sem número'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    {status && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(status.status)} text-white`}
                          >
                            {status.status.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {timeSinceCheck < 60000 ? 'agora' : `${Math.floor(timeSinceCheck / 60000)}m atrás`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{status.message}</p>
                        <Progress value={status.progress} className="h-1" />
                      </>
                    )}
                  </div>
                  
                  {status?.status === 'qr_ready' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Mostrar QR code em modal
                        if (status.qrCode) {
                          window.open(`data:image/png;base64,${status.qrCode}`, '_blank');
                        }
                      }}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => checkInstanceStatus(instance.instance_id)}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};