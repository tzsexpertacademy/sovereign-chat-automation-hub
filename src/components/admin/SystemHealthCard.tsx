import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Database, 
  Wifi, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SystemHealthProps {
  serverStatus: 'online' | 'offline';
  serverUptime: string;
  systemUptime: number;
  avgResponseTime: number;
  onRefresh?: () => void;
}

export const SystemHealthCard = ({ 
  serverStatus, 
  serverUptime, 
  systemUptime, 
  avgResponseTime,
  onRefresh 
}: SystemHealthProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast({
        title: "Status atualizado",
        description: "Informações do sistema foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as informações do sistema.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = () => {
    if (serverStatus === 'online') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return "text-green-600";
    if (uptime >= 95) return "text-yellow-600";
    return "text-red-600";
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 2) return "text-green-600";
    if (time <= 5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Saúde do Sistema</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status do Servidor */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">Status do Servidor</p>
              <p className="text-sm text-muted-foreground">API Principal</p>
            </div>
          </div>
          <Badge variant={serverStatus === 'online' ? 'default' : 'destructive'}>
            {serverStatus === 'online' ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Métricas de Performance */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Uptime</span>
            </div>
            <div className={`text-2xl font-bold ${getUptimeColor(systemUptime)}`}>
              {systemUptime}%
            </div>
            <p className="text-xs text-muted-foreground">Disponibilidade</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Resposta</span>
            </div>
            <div className={`text-2xl font-bold ${getResponseTimeColor(avgResponseTime)}`}>
              {avgResponseTime}s
            </div>
            <p className="text-xs text-muted-foreground">Tempo médio</p>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span>Banco de Dados</span>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Conectado
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Wifi className="w-4 h-4 text-muted-foreground" />
              <span>WebSocket</span>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Ativo
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Último Restart:</span>
            <span className="font-medium">{serverUptime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};