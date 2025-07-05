
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
    try {
      // Load clients first
      await loadClients();
      
      // Check server status
      const serverCheck = await checkServer();
      
      // Only load instances if server is online
      if (serverCheck) {
        await loadInstances();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const checkServer = async () => {
    try {
      const result = await whatsappService.testConnection();
      setServerOnline(result.success);
      
      if (result.success) {
        // Connect WebSocket
        whatsappService.connectSocket();
        console.log('✅ Servidor online, WebSocket conectado');
      }
      
      return result.success;
    } catch (error) {
      console.error('Erro ao verificar servidor:', error);
      setServerOnline(false);
      return false;
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
      console.log('🔄 Carregando instâncias do backend...');
      const instancesData = await whatsappService.getAllClients();
      console.log('🔍 Instâncias carregadas:', instancesData);
      setInstances(instancesData);
      
      // Set up WebSocket listeners for each instance
      instancesData.forEach(instance => {
        console.log(`📱 Configurando listener para: ${instance.clientId} (status: ${instance.status})`);
        whatsappService.joinClientRoom(instance.clientId);
        
        // Remove listener anterior se existir
        whatsappService.offClientStatus(instance.clientId);
        
        // Configurar novo listener
        whatsappService.onClientStatus(instance.clientId, (updatedClient) => {
          console.log(`🔄 Status atualizado via WebSocket: ${updatedClient.clientId} -> ${updatedClient.status}`, updatedClient);
          
          setInstances(prev => {
            const updated = prev.map(inst => 
              inst.clientId === updatedClient.clientId ? {
                ...inst,
                ...updatedClient,
                timestamp: new Date().toISOString()
              } : inst
            );
            console.log('📊 Instâncias após atualização:', updated);
            return updated;
          });
          
          // Mostrar toast quando conectar
          if (updatedClient.status === 'connected' && updatedClient.phoneNumber) {
            toast({ 
              title: "WhatsApp Conectado!", 
              description: `Instância ${updatedClient.clientId.split('_')[0]} conectada (${updatedClient.phoneNumber})`,
              duration: 5000 
            });
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar instâncias do servidor",
        variant: "destructive"
      });
    }
  };

  const createInstance = async () => {
    if (!selectedClient) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      
      // Gerar ID dinâmico para nova instância
      const dynamicInstanceId = `${selectedClient}_${Date.now()}`;
      console.log(`🚀 Criando instância dinâmica: ${dynamicInstanceId}`);
      
      const result = await whatsappService.connectClient(dynamicInstanceId);
      console.log('✅ Instância criada no backend:', result);
      
      toast({ 
        title: "Instância Criada", 
        description: "Nova instância WhatsApp criada! Aguarde o QR Code...",
        duration: 4000
      });
      
      setSelectedClient("");
      
      // Recarregar após um delay para garantir que a instância esteja no backend
      setTimeout(() => {
        loadInstances();
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Erro ao criar instância:', error);
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
      console.log(`🔗 Reconectando instância: ${clientId}`);
      
      const result = await whatsappService.connectClient(clientId);
      console.log('✅ Reconexão iniciada:', result);
      
      toast({ 
        title: "Reconectando", 
        description: "Iniciando reconexão... Aguarde o QR Code.",
        duration: 3000
      });
      
      // Recarregar instâncias após delay
      setTimeout(() => {
        loadInstances();
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Erro na reconexão:', error);
      toast({ 
        title: "Erro na Reconexão", 
        description: error.message || "Falha ao reconectar instância", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectInstance = async (clientId: string) => {
    try {
      setLoading(true);
      console.log(`🔌 Desconectando instância: ${clientId}`);
      
      const result = await whatsappService.disconnectClient(clientId);
      console.log('✅ Instância desconectada:', result);
      
      toast({ 
        title: "Instância Desconectada", 
        description: "Instância WhatsApp foi desconectada com sucesso"
      });
      
      // Recarregar instâncias imediatamente
      setTimeout(() => {
        loadInstances();
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Erro na desconexão:', error);
      toast({ 
        title: "Erro na Desconexão", 
        description: error.message || "Falha ao desconectar instância", 
        variant: "destructive" 
      });
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
    console.log(`🚀 Abrindo chat para: ${clientId}`);
    const client = clients.find(c => clientId.startsWith(c.id + '_'));
    console.log(`🔍 Cliente encontrado:`, client);
    if (client) {
      const chatUrl = `/client/${client.id}/chat`;
      console.log(`📱 Navegando para: ${chatUrl}`);
      navigate(chatUrl);
    } else {
      console.error(`❌ Cliente não encontrado para instância: ${clientId}`);
      toast({ 
        title: "Erro", 
        description: "Cliente não encontrado para esta instância", 
        variant: "destructive" 
      });
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

  const availableClients = clients; // Todos os clientes podem ter múltiplas instâncias dinâmicas

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
          <CardTitle>🚀 Criar Nova Instância WhatsApp</CardTitle>
          <CardDescription>
            Selecione um cliente para criar uma nova instância dinâmica. 
            Cada instância terá um ID único gerado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum cliente encontrado</SelectItem>
                  ) : (
                    clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4" />
                          <span>{client.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {client.email}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button 
                onClick={createInstance} 
                disabled={loading || !selectedClient || selectedClient === "none"}
                className="bg-green-600 hover:bg-green-700 min-w-32"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Instância
                  </>
                )}
              </Button>
            </div>
            
            {selectedClient && selectedClient !== "none" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>ID da nova instância:</strong> {selectedClient}_{Date.now()}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Cada instância criada terá um timestamp único para diferenciação
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instances List */}
      {instances.length > 0 ? (
        <div className="grid gap-4">
          {instances.map(instance => {
            const client = clients.find(c => instance.clientId.startsWith(c.id + '_'));
            const displayName = client?.name || instance.clientId.split('_')[0];
            return (
              <Card key={instance.clientId} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                        <h3 className="font-semibold text-lg">{displayName}</h3>
                        <Badge variant="secondary">
                          ID: ...{instance.clientId.split('_')[1]?.slice(-6) || 'N/A'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">Status:</span>
                          <Badge variant={instance.status === 'connected' ? 'default' : 
                                        instance.status === 'qr_ready' ? 'secondary' : 'destructive'}>
                            {instance.status === 'qr_ready' ? 'QR Pronto' :
                             instance.status === 'connected' ? 'Conectado' :
                             instance.status === 'connecting' ? 'Conectando' : instance.status}
                          </Badge>
                        </div>
                        {instance.phoneNumber && (
                          <div className="flex items-center space-x-1">
                            <span className="font-medium">📱</span>
                            <span>{instance.phoneNumber}</span>
                          </div>
                        )}
                        {instance.hasQrCode && (
                          <div className="flex items-center space-x-1">
                            <QrCode className="w-4 h-4" />
                            <span className="text-blue-600 font-medium">QR Disponível</span>
                          </div>
                        )}
                      </div>

                      {instance.status === 'qr_ready' && instance.hasQrCode && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-blue-800 text-sm font-medium">
                                📱 QR Code pronto para escaneamento!
                              </p>
                              <p className="text-blue-600 text-xs mt-1">
                                Clique em "Ver QR" para escanear com seu WhatsApp
                              </p>
                            </div>
                            <Button size="sm" onClick={() => showQrCode(instance.clientId)} className="bg-blue-600 hover:bg-blue-700">
                              <QrCode className="w-4 h-4 mr-1" />
                              Ver QR
                            </Button>
                          </div>
                        </div>
                      )}

                      {instance.status === 'connected' && (
                        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-green-800 text-sm font-medium">
                                ✅ WhatsApp conectado e funcionando!
                              </p>
                              {instance.phoneNumber && (
                                <p className="text-green-600 text-xs mt-1">
                                  Conectado como: {instance.phoneNumber}
                                </p>
                              )}
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => openChat(instance.clientId)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Abrir Chat
                            </Button>
                          </div>
                        </div>
                      )}

                      {instance.status === 'connecting' && (
                        <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-yellow-800 text-sm font-medium">
                            ⏳ Conectando... Aguarde o QR Code aparecer.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      {instance.status === 'connected' ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => disconnectInstance(instance.clientId)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                      ) : instance.status !== 'qr_ready' ? (
                        <Button 
                          size="sm"
                          onClick={() => connectInstance(instance.clientId)}
                          disabled={instance.status === 'connecting'}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {instance.status === 'connecting' ? 'Conectando...' : 'Conectar'}
                        </Button>
                      ) : null}
                      
                      <Button 
                        size="sm" 
                        variant="destructive"
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
