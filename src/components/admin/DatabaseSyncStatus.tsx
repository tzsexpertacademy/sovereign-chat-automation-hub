import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  Database, 
  Server, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  RotateCcw
} from "lucide-react";
import { useDatabaseSync } from "@/hooks/useDatabaseSync";
import { useToast } from "@/hooks/use-toast";

const DatabaseSyncStatus = () => {
  const { syncStatus, loading, error, executeSync, checkStatus, lastCheck } = useDatabaseSync();
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    const success = await executeSync();
    
    if (success) {
      toast({
        title: "Sincronização Completada",
        description: "Instâncias sincronizadas com sucesso",
      });
    } else {
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao sincronizar com o banco de dados",
        variant: "destructive",
      });
    }
    
    setSyncing(false);
  };

  const handleRefresh = async () => {
    await checkStatus();
  };

  const getSyncStatusColor = () => {
    if (!syncStatus) return "secondary";
    return syncStatus.is_synchronized ? "default" : "destructive";
  };

  const getSyncStatusText = () => {
    if (!syncStatus) return "Verificando...";
    return syncStatus.is_synchronized ? "Sincronizado" : "Dessincronizado";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Sincronização com Banco</span>
            </CardTitle>
            <CardDescription>
              Status da sincronização entre servidor e Supabase
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={getSyncStatusColor()}>
              {getSyncStatusText()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {syncStatus && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Banco de Dados</span>
              </div>
              <div className="text-2xl font-bold">{syncStatus.database_instances}</div>
              <p className="text-xs text-muted-foreground">instâncias no Supabase</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Servidor</span>
              </div>
              <div className="text-2xl font-bold">{syncStatus.server_instances}</div>
              <p className="text-xs text-muted-foreground">instâncias no servidor</p>
            </div>
          </div>
        )}

        {syncStatus && !syncStatus.is_synchronized && (
          <div className="space-y-2">
            {syncStatus.missing_in_server.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{syncStatus.missing_in_server.length} instância(s)</strong> no banco 
                  mas não no servidor: {syncStatus.missing_in_server.slice(0, 2).join(', ')}
                  {syncStatus.missing_in_server.length > 2 && '...'}
                </AlertDescription>
              </Alert>
            )}
            
            {syncStatus.missing_in_database.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{syncStatus.missing_in_database.length} instância(s)</strong> no servidor 
                  mas não no banco: {syncStatus.missing_in_database.slice(0, 2).join(', ')}
                  {syncStatus.missing_in_database.length > 2 && '...'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {syncStatus && syncStatus.is_synchronized && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Todas as instâncias estão sincronizadas entre banco e servidor
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {lastCheck ? (
                `Última verificação: ${lastCheck.toLocaleTimeString()}`
              ) : (
                'Nunca verificado'
              )}
            </span>
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
            
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DatabaseSyncStatus;