
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Activity, 
  MessageSquare, 
  TrendingUp, 
  Server,
  Wifi,
  WifiOff,
  RefreshCw
} from "lucide-react";
import { YUMER_API_URL } from "@/config/environment";
import { yumerWhatsAppService } from "@/services/yumerWhatsappService";

interface SystemStats {
  totalClients: number;
  activeInstances: number;
  totalMessages: number;
  serverStatus: 'online' | 'offline';
  uptime: string;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalClients: 0,
    activeInstances: 0,
    totalMessages: 0,
    serverStatus: 'offline',
    uptime: '0s'
  });
  const [loading, setLoading] = useState(false);

  const checkServerHealth = async () => {
    try {
      setLoading(true);
      console.log('🔍 [OVERVIEW] Verificando saúde do servidor YUMER...');
      
      // Use the robust health check
      const healthCheck = await yumerWhatsAppService.checkServerHealth();
      
      if (healthCheck.status === 'online') {
        // Fetch detailed instance data
        const instances = await yumerWhatsAppService.fetchAllInstances();
        const activeCount = instances.filter(i => 
          i.status === 'connected' || 
          i.status === 'ready' || 
          i.status === 'qr_ready'
        ).length;
        
        setStats(prev => ({
          ...prev,
          serverStatus: 'online',
          activeInstances: activeCount,
          totalClients: instances.length || 0,
          totalMessages: Math.floor(Math.random() * 1000), // Mock data
          uptime: healthCheck.details.timestamp
        }));
        
        console.log('✅ [OVERVIEW] Servidor YUMER saudável:', {
          instances: instances.length,
          active: activeCount,
          details: healthCheck.details
        });
      } else {
        throw new Error(healthCheck.details.error || 'Servidor offline');
      }
    } catch (error: any) {
      console.error("❌ [OVERVIEW] Falha na verificação de saúde:", error);
      setStats(prev => ({ 
        ...prev, 
        serverStatus: 'offline',
        activeInstances: 0,
        totalClients: 0,
        totalMessages: 0
      }));
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600">Visão geral do sistema WhatsApp SaaS</p>
        </div>
        <Button onClick={checkServerHealth} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5" />
            <span>Status do Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {stats.serverStatus === 'online' ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  Servidor: {stats.serverStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              {stats.serverStatus === 'online' && (
                <Badge variant="outline">Uptime: {stats.uptime}</Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              URL: {YUMER_API_URL}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados na plataforma
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeInstances}</div>
            <p className="text-xs text-muted-foreground">
              WhatsApp conectados agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              Total processadas hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.serverStatus === 'online' ? '100%' : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Disponibilidade do sistema
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Operações frequentes do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Gerenciar Clientes
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Activity className="w-4 h-4 mr-2" />
              Monitorar Instâncias
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Server className="w-4 h-4 mr-2" />
              Ver Logs do Sistema
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
            <CardDescription>Detalhes técnicos da plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Versão:</span>
              <Badge variant="outline">1.0.0</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ambiente:</span>
              <Badge variant="outline">Produção</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Última Verificação:</span>
              <span className="text-sm">{new Date().toLocaleTimeString('pt-BR')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimas ações no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Nenhuma atividade recente registrada
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
