import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  QrCode, 
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  Zap
} from "lucide-react";
import { useAutoSync } from "@/hooks/useAutoSync";
import { cn } from "@/lib/utils";

interface RealTimeStatusIndicatorProps {
  instanceId: string;
  initialStatus?: string;
  showDetails?: boolean;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export const RealTimeStatusIndicator = ({ 
  instanceId, 
  initialStatus = 'disconnected',
  showDetails = false,
  onStatusChange,
  className 
}: RealTimeStatusIndicatorProps) => {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  const { 
    statuses, 
    isActive, 
    lastSyncTime, 
    manualSync,
    getInstanceStatus,
    getSyncInfo 
  } = useAutoSync([instanceId], {
    enableNotifications: false,
    onStatusChange: (id, status) => {
      if (status.status !== currentStatus) {
        setCurrentStatus(status.status);
        onStatusChange?.(status.status);
        
        // Trigger pulse animation on status change
        setPulseAnimation(true);
        setTimeout(() => setPulseAnimation(false), 1000);
      }
    }
  });

  const instanceStatus = getInstanceStatus(instanceId);
  const syncInfo = getSyncInfo();

  // Update current status from auto-sync
  useEffect(() => {
    if (instanceStatus) {
      setCurrentStatus(instanceStatus.status);
    }
  }, [instanceStatus]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          label: 'Conectado',
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const,
          pulse: true
        };
      case 'qr_ready':
        return {
          icon: QrCode,
          label: 'QR Pronto',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeVariant: 'secondary' as const,
          pulse: true
        };
      case 'connecting':
        return {
          icon: Clock,
          label: 'Conectando',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeVariant: 'secondary' as const,
          pulse: false,
          animate: 'animate-spin'
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Erro',
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const,
          pulse: false
        };
      default:
        return {
          icon: Activity,
          label: 'Desconectado',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badgeVariant: 'outline' as const,
          pulse: false
        };
    }
  };

  const config = getStatusConfig(currentStatus);
  const IconComponent = config.icon;

  const handleManualRefresh = async () => {
    setPulseAnimation(true);
    await manualSync(instanceId);
    setTimeout(() => setPulseAnimation(false), 1000);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Status Principal */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all duration-300",
        config.bgColor,
        config.borderColor,
        pulseAnimation && "ring-2 ring-offset-2 ring-blue-500"
      )}>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <IconComponent 
              className={cn(
                "w-5 h-5",
                config.color,
                config.animate
              )}
            />
            {config.pulse && (
              <div className={cn(
                "absolute inset-0 w-5 h-5 rounded-full animate-ping opacity-75",
                config.color.replace('text-', 'bg-')
              )} />
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={config.badgeVariant}>
              {config.label}
            </Badge>
            
            {instanceStatus?.isConnected && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">Online</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Auto-sync indicator */}
          <div className="flex items-center space-x-1">
            {isActive ? (
              <Wifi className="w-4 h-4 text-blue-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-xs text-gray-500">
              {isActive ? 'Auto' : 'Manual'}
            </span>
          </div>

          {/* Manual refresh button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            className="h-6 px-2"
          >
            <Zap className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Detalhes (opcional) */}
      {showDetails && (
        <div className="bg-muted p-3 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className="ml-1 font-medium">{config.label}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Conexão:</span>
              <span className="ml-1 font-medium">
                {instanceStatus?.connectionState || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Último Sync:</span>
              <span className="ml-1 font-medium">
                {instanceStatus?.lastSync 
                  ? instanceStatus.lastSync.toLocaleTimeString() 
                  : 'Nunca'
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Auto-Sync:</span>
              <span className="ml-1 font-medium">
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
          
          {lastSyncTime && (
            <div className="text-xs text-muted-foreground">
              Última atualização: {lastSyncTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};