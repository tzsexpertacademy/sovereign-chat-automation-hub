
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Pause, 
  Play, 
  QrCode, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import { clientsService, ClientData } from "@/services/clientsService";

const SimpleInstanceManager = () => {
  const [instances, setInstances] = useState<WhatsAppClient[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [qrModal, setQrModal] = useState<{ show: boolean; client?: WhatsAppClient }>({ show: false });
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadInstances, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    await Promise.all([
      checkServer(),
      loadClients(),
      loadInstances()
    ]);
  };

  const checkServer = async () => {
    try {
      const result = await whatsappService.testConnection();
      setServerOnline(result.success);
      
      if (result.success) {
        // Connect WebSocket
        whatsappService.connectSocket();
      }
    } catch (error) {
      setServerOnline(false);
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
    if (!serverOnline) return;
    
    try {
      const instancesData = await whatsappService.getAllClients();
      setInstances(instancesData);
      
      // Set up WebSocket listeners for each instance
      instancesData.forEach(instance => {
        whatsappService.joinClientRoom(instance.clientId);
        whatsappService.onClientStatus(instance.clientId, (updatedClient) => {
          setInstances(prev => 
            prev.map(inst => 
              inst.clientId === updatedClient.clientId ? updatedClient : inst
            )
          );
        });
      });
      
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const createInstance = async () => {
    if (!selectedClient) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      
      const result = await whatsappService.connectClient(selectedClient);
      console.log('Instância criada:', result);
      
      toast({ title: "Sucesso", description: "Instância criada! Aguarde o QR Code..." });
      
      setSelectedClient("");
      setTimeout(loadInstances, 2000);
      
    } catch (error: any) {
      toast({ 
        title: "Erro", 
        description: error.message || "Falha ao criar instância", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const connectInstance = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.connectClient(clientId);
      toast({ title: "Sucesso", description: "Conectando instância..." });
      setTimeout(loadInstances, 2000);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const disconnectInstance = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      toast({ title: "Sucesso", description: "Instância desconectada" });
      setTimeout(loadInstances, 2000);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const showQrCode = async (clientId: string) => {
    try {
      const clientStatus = await whatsappService.getClientStatus(clientId);
      setQrModal({ show: true, client: clientStatus });
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao buscar QR Code", variant: "destructive" });
    }
  };

  const openChat = (clientId: string) => {
    const client = clients.find(c => c.instance_id === clientId);
    if (client) {
      navigate(`/client/${client.id}/chat`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      default: return <XCircle className="w-4 h-4" />;
    }
  };

  const availableClients = clients.filter(client => 
    !instances.some(instance => instance.clientId === client.id)
  );

  if (!serverOnline) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span>Servidor Offline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>O servidor WhatsApp não está respondendo.</p>
                  <div className="space-y-2">
                    <p className="font-medium">Soluções:</p>
                    <ol className="list-decimal list-inside text-sm space-y-1">
                      <li>Execute: <code>sudo ./scripts/fix-nginx-complete.sh</code></li>
                      <li>Aceite o certificado SSL em: <code>https://146.59.227.248/health</code></li>
                      <li>Verifique se PM2 está rodando: <code>pm2 status</code></li>
                    </ol>
                  </div>
                  <Button onClick={checkServer} className="mt-3">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Testar Novamente
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Instâncias</h1>
          <p className="text-gray-600">Gerencie suas conexões WhatsApp</p>
        </div>
        <Button onClick={loadInstances} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Server Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-800">Servidor Online</span>
            <Badge className="bg-green-500">
              {instances.length} Instâncias
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create Instance */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Nova Instância</CardTitle>
          <CardDescription>Selecione um cliente para criar uma instância WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.length === 0 ? (
                  <SelectItem value="none" disabled>Todos os clientes têm instâncias</SelectItem>
                ) : (
                  availableClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{client.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={createInstance} 
              disabled={loading || !selectedClient || selectedClient === "none"}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instances List */}
      {instances.length > 0 ? (
        <div className="grid gap-4">
          {instances.map(instance => {
            const client = clients.find(c => c.instance_id === instance.clientId);
            return (
              <Card key={instance.clientId}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                        <h3 className="font-semibold">{instance.clientId}</h3>
                        {client && (
                          <Badge variant="outline">
                            <User className="w-3 h-3 mr-1" />
                            {client.name}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Status: {instance.status}</span>
                        {instance.phoneNumber && <span>📱 {instance.phoneNumber}</span>}
                        {instance.hasQrCode && <span>📱 QR Disponível</span>}
                      </div>

                      {instance.status === 'qr_ready' && instance.hasQrCode && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-blue-800 text-sm font-medium">
                            📱 QR Code pronto! Clique para visualizar e escanear.
                          </p>
                        </div>
                      )}

                      {instance.status === 'connected' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-green-800 text-sm font-medium">
                            ✅ WhatsApp conectado e funcionando!
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {instance.status === 'qr_ready' && instance.hasQrCode && (
                        <Button size="sm" onClick={() => showQrCode(instance.clientId)}>
                          <QrCode className="w-4 h-4 mr-1" />
                          Ver QR
                        </Button>
                      )}
                      
                      {instance.status === 'connected' ? (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => openChat(instance.clientId)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => disconnectInstance(instance.clientId)}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pausar
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => connectInstance(instance.clientId)}
                          disabled={instance.status === 'connecting'}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {instance.status === 'connecting' ? 'Conectando...' : 'Conectar'}
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => disconnectInstance(instance.clientId)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
              <p className="text-gray-600">Selecione um cliente e crie sua primeira instância WhatsApp</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      {qrModal.show && qrModal.client && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - {qrModal.client.clientId}
              </h3>
              
              {qrModal.client.qrCode ? (
                <div className="space-y-4">
                  <img 
                    src={qrModal.client.qrCode} 
                    alt="QR Code WhatsApp"
                    className="mx-auto border rounded"
                  />
                  <p className="text-sm text-gray-600">
                    Escaneie este QR Code com seu WhatsApp para conectar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">QR Code não disponível</p>
                </div>
              )}
              
              <Button 
                onClick={() => setQrModal({ show: false })}
                className="mt-4"
                variant="outline"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleInstanceManager;
