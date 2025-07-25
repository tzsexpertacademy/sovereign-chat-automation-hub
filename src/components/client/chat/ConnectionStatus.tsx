
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Wifi, WifiOff, Activity, RefreshCw } from "lucide-react";
import { getServerConfig } from "@/config/environment";
import { useAutoSync } from "@/hooks/useAutoSync";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  className?: string;
  connectedInstance?: string;
  isOnline?: boolean;
  instanceId?: string;
  onShowDiagnostics?: () => void;
  showAutoSync?: boolean;
}

const ConnectionStatus = ({ 
  className, 
  connectedInstance, 
  isOnline: propIsOnline, 
  instanceId,
  onShowDiagnostics,
  showAutoSync = false
}: ConnectionStatusProps) => {
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const config = getServerConfig();

  // Auto-sync para instância específica (se fornecida)
  const { 
    getInstanceStatus, 
    isActive: autoSyncActive, 
    manualSync,
    getSyncInfo 
  } = useAutoSync(instanceId ? [instanceId] : [], {
    enableNotifications: false
  });

  const instanceStatus = instanceId ? getInstanceStatus(instanceId) : null;
  const syncInfo = getSyncInfo();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${config.SERVER_URL}/health`, {
          method: 'GET',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        setIsServerOnline(true);
      } catch (error) {
        setIsServerOnline(false);
      } finally {
        setLastCheck(new Date());
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [config.SERVER_URL]);

  // Determinar status real
  const isOnline = propIsOnline !== undefined 
    ? propIsOnline 
    : instanceStatus?.isConnected ?? isServerOnline;

  const currentStatus = instanceStatus?.status || (isOnline ? 'online' : 'offline');
  
  // Show instance info if available
  const statusText = connectedInstance 
    ? `${isOnline ? "🟢" : "🔴"} ${connectedInstance}`
    : instanceStatus?.isConnected 
      ? `🟢 ${instanceId?.split('_').pop() || 'Conectado'}`
      : `${isOnline ? "🟢 Online" : "🔴 Offline"}`;

  // Auto-refresh manual
  const handleManualRefresh = async () => {
    if (instanceId) {
      await manualSync(instanceId);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-3 bg-muted rounded-lg border transition-all duration-300",
      isOnline && "border-green-200 bg-green-50",
      !isOnline && "border-red-200 bg-red-50"
    )}>
      <div className="flex items-center space-x-3">
        <Badge 
          variant={isOnline ? "default" : "destructive"}
          className={cn("flex items-center space-x-1", className)}
        >
          <span>{statusText}</span>
        </Badge>
        
        {/* Status de conexão mais detalhado */}
        {instanceStatus && (
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span className="text-muted-foreground">
                {instanceStatus.status}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Auto-sync indicator */}
        {showAutoSync && instanceId && (
          <div className="flex items-center space-x-1 text-xs">
            {autoSyncActive ? (
              <div className="flex items-center space-x-1 text-blue-600">
                <Wifi className="w-3 h-3" />
                <span>Auto</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-gray-400">
                <WifiOff className="w-3 h-3" />
                <span>Manual</span>
              </div>
            )}
          </div>
        )}

        {/* Manual refresh */}
        {instanceId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            className="h-6 px-2"
            title="Atualizar Status"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}

        {onShowDiagnostics && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onShowDiagnostics}
            className="h-6 px-2"
          >
            <Settings className="h-3 w-3 mr-1" />
            Diagnóstico
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
