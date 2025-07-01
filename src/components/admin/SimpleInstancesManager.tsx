
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, Smartphone, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSimpleInstanceManager } from "@/hooks/useSimpleInstanceManager";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";
import { clientsService } from "@/services/clientsService";

const SimpleInstancesManager = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { connectInstance, disconnectInstance, getInstanceStatus, getStatus, isInstanceLoading } = useSimpleInstanceManager();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData] = await Promise.all([
        clientsService.getAllClients()
      ]);
      
      setClients(clientsData);
      
      // Carregar instâncias de cada cliente
      const allInstances: any[] = [];
      for (const client of clientsData) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      setInstances(allInstances);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (instanceId: string) => {
    await connectInstance(instanceId);
    // Atualizar status após conexão
    setTimeout(() => {
      getInstanceStatus(instanceId);
    }, 3000);
  };

  const handleDisconnect = async (instanceId: string) => {
    await disconnectInstance(instanceId);
  };

  const handleRefreshStatus = async (instanceId: string) => {
    await getInstanceStatus(instanceId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'qr_ready': return 'bg-yellow-100 text-yellow-800';
      case 'connecting': return 'bg-blue-100 text-blue-800';
      case 'disconnected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Carregando instâncias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciador de Instâncias</h1>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {instances.map((instance) => {
          const currentStatus = getStatus(instance.instance_id);
          const loading = isInstanceLoading(instance.instance_id);
          
          return (
            <Card key={instance.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5" />
                    <CardTitle className="text-lg">{instance.custom_name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(currentStatus.status)}>
                      {getStatusIcon(currentStatus.status)}
                      <span className="ml-1 capitalize">{currentStatus.status}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">ID:</span>
                      <p className="text-muted-foreground">{instance.instance_id}</p>
                    </div>
                    <div>
                      <span className="font-medium">Telefone:</span>
                      <p className="text-muted-foreground">
                        {currentStatus.phoneNumber || 'Não conectado'}
                      </p>
                    </div>
                  </div>

                  {currentStatus.hasQrCode && currentStatus.qrCode && (
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm font-medium mb-2">QR Code Disponível:</p>
                      <img 
                        src={currentStatus.qrCode} 
                        alt="QR Code" 
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  )}

                  {currentStatus.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">{currentStatus.error}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {currentStatus.status === 'disconnected' && (
                      <Button
                        onClick={() => handleConnect(instance.instance_id)}
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4 mr-2" />
                            Conectar
                          </>
                        )}
                      </Button>
                    )}

                    {currentStatus.status !== 'disconnected' && (
                      <Button
                        onClick={() => handleDisconnect(instance.instance_id)}
                        disabled={loading}
                        variant="outline"
                        className="flex-1"
                      >
                        <WifiOff className="w-4 h-4 mr-2" />
                        Desconectar
                      </Button>
                    )}

                    <Button
                      onClick={() => handleRefreshStatus(instance.instance_id)}
                      disabled={loading}
                      variant="outline"
                      size="icon"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {instances.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Nenhuma instância encontrada</h3>
            <p className="text-muted-foreground">
              Crie uma instância para começar a usar o WhatsApp
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimpleInstancesManager;
