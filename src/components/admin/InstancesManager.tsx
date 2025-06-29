
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import WhatsAppSystemStatus from "./WhatsAppSystemStatus";
import ConnectionTest from "./ConnectionTest";
import InstanceCreationForm from "./InstanceCreationForm";
import InstancesList from "./InstancesList";

interface SystemHealth {
  serverOnline: boolean;
  corsEnabled: boolean;
  httpsEnabled: boolean;
  lastCheck: Date;
  issues: string[];
}

const InstancesManager = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    serverOnline: false,
    corsEnabled: false,
    httpsEnabled: false,
    lastCheck: new Date(),
    issues: []
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(checkSystemHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadClients(),
        loadInstances(),
        checkSystemHealth()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadInstances = async () => {
    try {
      // Load all instances from database
      const allInstances: WhatsAppInstanceData[] = [];
      
      for (const client of clients) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      
      setInstances(allInstances);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const checkSystemHealth = async () => {
    const health: SystemHealth = {
      serverOnline: false,
      corsEnabled: false,
      httpsEnabled: false,
      lastCheck: new Date(),
      issues: []
    };

    try {
      // Test server connection
      const serverHealth = await whatsappService.checkServerHealth();
      health.serverOnline = true;
      
      // Check if HTTPS is available
      health.httpsEnabled = window.location.protocol === 'https:';
      
      // Test CORS by attempting a simple request
      try {
        await fetch(`${whatsappService.getServerUrl()}/health`, {
          method: 'GET',
          mode: 'cors'
        });
        health.corsEnabled = true;
      } catch (corsError) {
        health.corsEnabled = false;
        health.issues.push('CORS não configurado - necessário configurar no servidor');
      }
      
    } catch (error) {
      health.serverOnline = false;
      health.issues.push('Servidor WhatsApp offline ou inacessível');
    }

    // Additional checks
    if (!health.httpsEnabled && window.location.hostname.includes('lovableproject.com')) {
      health.issues.push('HTTPS recomendado para produção');
    }

    setSystemHealth(health);
  };

  const syncInstancesWithServer = async () => {
    try {
      setLoading(true);
      console.log('🔄 Sincronizando instâncias com servidor...');
      
      // Get all instances from server
      const serverInstances = await whatsappService.getAllClients();
      
      // Get all instances from database
      const dbInstances = instances;
      
      // Find orphaned instances in database (not in server)
      const orphanedInstances = dbInstances.filter(dbInstance => 
        !serverInstances.some(serverInstance => 
          serverInstance.clientId === dbInstance.instance_id
        )
      );
      
      // Clean up orphaned instances
      for (const orphaned of orphanedInstances) {
        console.log(`🧹 Limpando instância órfã: ${orphaned.instance_id}`);
        await whatsappInstancesService.updateInstanceById(orphaned.id, {
          status: 'disconnected'
        });
      }
      
      // Update status of existing instances
      for (const serverInstance of serverInstances) {
        const dbInstance = dbInstances.find(db => db.instance_id === serverInstance.clientId);
        if (dbInstance && dbInstance.status !== serverInstance.status) {
          console.log(`📱 Atualizando status: ${dbInstance.instance_id} -> ${serverInstance.status}`);
          await whatsappInstancesService.updateInstanceById(dbInstance.id, {
            status: serverInstance.status,
            phone_number: serverInstance.phoneNumber
          });
        }
      }
      
      await loadInstances();
      
      toast({
        title: "Sincronização Concluída",
        description: `${orphanedInstances.length} instâncias órfãs limpas`,
      });
      
    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao sincronizar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthIcon = () => {
    if (!systemHealth.serverOnline) return <XCircle className="w-5 h-5 text-red-500" />;
    if (systemHealth.issues.length > 0) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getHealthStatus = () => {
    if (!systemHealth.serverOnline) return "Offline";
    if (systemHealth.issues.length > 0) return "Com Problemas";
    return "Saudável";
  };

  const getHealthColor = () => {
    if (!systemHealth.serverOnline) return "destructive";
    if (systemHealth.issues.length > 0) return "secondary";
    return "default";
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Carregando sistema de instâncias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciador de Instâncias WhatsApp</h1>
          <p className="text-muted-foreground">
            Sistema corrigido para resolver problemas de CORS e duplicação
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={syncInstancesWithServer} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* System Health Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getHealthIcon()}
              <CardTitle>Saúde do Sistema</CardTitle>
            </div>
            <Badge variant={getHealthColor()}>
              {getHealthStatus()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              {systemHealth.serverOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                Servidor: {systemHealth.serverOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {systemHealth.corsEnabled ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                CORS: {systemHealth.corsEnabled ? 'Configurado' : 'Não Configurado'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {systemHealth.httpsEnabled ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm">
                HTTPS: {systemHealth.httpsEnabled ? 'Ativo' : 'HTTP'}
              </span>
            </div>
          </div>
          
          {systemHealth.issues.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Problemas Detectados:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {systemHealth.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <p className="text-xs text-gray-500">
            Última verificação: {systemHealth.lastCheck.toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>

      {/* CORS Alert */}
      {!systemHealth.corsEnabled && systemHealth.serverOnline && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">⚠️ CORS não configurado no servidor</p>
              <p className="text-sm">
                Para resolver este problema, execute no servidor:
              </p>
              <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                <p># Adicionar ao arquivo do servidor WhatsApp:</p>
                <p>app.use(cors({`{`}</p>
                <p>&nbsp;&nbsp;origin: ['https://*.lovableproject.com', 'http://localhost:*'],</p>
                <p>&nbsp;&nbsp;credentials: true</p>
                <p>{`}`}));</p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* System Status Components */}
      <WhatsAppSystemStatus />
      <ConnectionTest />

      {/* Instance Creation Form */}
      <InstanceCreationForm 
        clients={clients}
        onInstanceCreated={loadData}
        systemHealth={systemHealth}
      />

      {/* Instances List */}
      <InstancesList 
        instances={instances}
        clients={clients}
        onInstanceUpdated={loadData}
        systemHealth={systemHealth}
      />
    </div>
  );
};

export default InstancesManager;
