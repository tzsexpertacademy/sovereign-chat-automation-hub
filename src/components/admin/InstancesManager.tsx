
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import WhatsAppSystemStatus from "./WhatsAppSystemStatus";
import SimpleConnectionStatus from "./SimpleConnectionStatus";
import InstanceCreationForm from "./InstanceCreationForm";
import InstancesListFixed from "./InstancesListFixed";
import { getServerConfig } from "@/config/environment";
import QRCodeDebugger from "./QRCodeDebugger";
import ConnectionTester from "./ConnectionTester";

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
    const interval = setInterval(checkSystemHealth, 30000);
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

    const config = getServerConfig();
    health.httpsEnabled = config.isHttps;

    try {
      const testResult = await whatsappService.testConnection();
      health.serverOnline = testResult.success;
      
      if (testResult.success) {
        health.corsEnabled = true; // If connection works, CORS is OK
        console.log('✅ Sistema funcionando:', testResult.message);
      } else {
        health.issues.push(testResult.message);
        console.error('❌ Problema no sistema:', testResult.message);
      }
      
    } catch (error: any) {
      health.serverOnline = false;
      health.corsEnabled = false;
      health.issues.push('Servidor inacessível ou offline');
      console.error('❌ Erro no health check:', error.message);
    }

    setSystemHealth(health);
  };

  const syncInstancesWithServer = async () => {
    try {
      setLoading(true);
      console.log('🔄 Sincronizando instâncias com servidor...');
      
      const serverInstances = await whatsappService.getAllClients();
      const dbInstances = instances;
      
      // Sync instances status
      for (const serverInstance of serverInstances) {
        const dbInstance = dbInstances.find(db => db.instance_id === serverInstance.clientId);
        if (dbInstance && dbInstance.status !== serverInstance.status) {
          console.log(`📱 Atualizando status: ${dbInstance.instance_id} -> ${serverInstance.status}`);
          await whatsappInstancesService.updateInstanceById(dbInstance.id, {
            status: serverInstance.status,
            phone_number: serverInstance.phoneNumber,
            has_qr_code: serverInstance.hasQrCode,
            qr_code: serverInstance.qrCode
          });
        }
      }
      
      await loadInstances();
      
      toast({
        title: "Sincronização Concluída",
        description: `${serverInstances.length} instâncias sincronizadas`,
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
    if (!systemHealth.corsEnabled) return <Shield className="w-5 h-5 text-red-500" />;
    if (systemHealth.issues.length > 0) return <XCircle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getHealthStatus = () => {
    if (!systemHealth.serverOnline) return "Servidor Offline";
    if (!systemHealth.corsEnabled) return "CORS Error";
    if (systemHealth.issues.length > 0) return "Com Problemas";
    return "Funcionando";
  };

  const getHealthColor = () => {
    if (!systemHealth.serverOnline || !systemHealth.corsEnabled) return "destructive";
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
            Sistema HTTP com detecção automática de conexão
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

      {/* Connection Tester - NOVO */}
      <ConnectionTester />

      {/* Connection Status */}
      <SimpleConnectionStatus />

      {/* QR Code Debugger */}
      <QRCodeDebugger />

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
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                Servidor: {systemHealth.serverOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {systemHealth.httpsEnabled ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-sm">
                Protocolo: {systemHealth.httpsEnabled ? 'HTTPS' : 'HTTP'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {systemHealth.corsEnabled ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Shield className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                CORS: {systemHealth.corsEnabled ? 'OK' : 'Error'}
              </span>
            </div>
          </div>
          
          {systemHealth.issues.length > 0 && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Problemas detectados:</p>
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

      {/* System Status Components */}
      <WhatsAppSystemStatus />

      {/* Instance Creation Form */}
      <InstanceCreationForm 
        clients={clients}
        onInstanceCreated={loadData}
        systemHealth={systemHealth}
      />

      {/* Instances List */}
      <InstancesListFixed 
        instances={instances}
        clients={clients}
        onInstanceUpdated={loadData}
        systemHealth={systemHealth}
      />
    </div>
  );
};

export default InstancesManager;
