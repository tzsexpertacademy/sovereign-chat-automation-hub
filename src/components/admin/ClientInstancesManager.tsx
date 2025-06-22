
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Power,
  Trash2,
  Plus,
  Edit,
  Eye,
  Users,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import whatsappService from "@/services/whatsappMultiClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

const ClientInstancesManager = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [showInstancesDialog, setShowInstancesDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{instanceId: string, qrCode: string} | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados de clientes e instâncias...');
      
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);
      
      // Carregar todas as instâncias
      const allInstances = await Promise.all(
        clientsData.map(client => whatsappInstancesService.getInstancesByClientId(client.id))
      );
      
      const flatInstances = allInstances.flat();
      setInstances(flatInstances);
      
      console.log('✅ Dados carregados:', { clients: clientsData.length, instances: flatInstances.length });
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewClientInstances = async (client: ClientData) => {
    try {
      setLoading(true);
      const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
      
      // Verificar status real no servidor para cada instância
      const instancesWithRealStatus = await Promise.all(
        clientInstances.map(async (instance) => {
          try {
            const serverStatus = await whatsappService.getClientStatus(instance.instance_id);
            if (serverStatus && serverStatus.status !== instance.status) {
              await whatsappInstancesService.updateInstanceById(instance.id, {
                status: serverStatus.status,
                phone_number: serverStatus.phoneNumber || instance.phone_number
              });
              return {
                ...instance,
                status: serverStatus.status,
                phone_number: serverStatus.phoneNumber || instance.phone_number
              };
            }
            return instance;
          } catch (error) {
            console.log(`⚠️ Erro ao verificar status para ${instance.instance_id}:`, error);
            return instance;
          }
        })
      );

      setSelectedClient(client);
      setInstances(instancesWithRealStatus);
      setShowInstancesDialog(true);
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias do cliente:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar instâncias do cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoToClientChat = (clientId: string) => {
    // Navegar para a área do cliente diretamente na aba de tickets/chat
    navigate(`/client/${clientId}/tickets`);
  };

  const handleReconnectInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      console.log('🔄 Reconectando instância:', instanceId);
      
      const instance = instances.find(i => i.instance_id === instanceId);
      if (instance) {
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'connecting'
        });
      }

      const result = await whatsappService.connectClient(instanceId);
      console.log('✅ Instância reconectada:', result);
      
      toast({
        title: "Reconectando",
        description: "Instância sendo reconectada! Aguarde o QR Code...",
      });

      setTimeout(() => {
        if (selectedClient) {
          handleViewClientInstances(selectedClient);
        } else {
          loadData();
        }
      }, 2000);

    } catch (error: any) {
      console.error('❌ Erro ao reconectar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao reconectar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewQrCode = async (instanceId: string) => {
    try {
      console.log('👁️ Buscando QR Code para instância:', instanceId);
      
      const clientStatus = await whatsappService.getClientStatus(instanceId);
      
      if (clientStatus && clientStatus.qrCode) {
        setQrCodeData({
          instanceId,
          qrCode: clientStatus.qrCode
        });
        setShowQrDialog(true);
      } else {
        toast({
          title: "QR Code Indisponível",
          description: "QR Code não está disponível. Tente reconectar primeiro.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Code:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao buscar QR Code",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      
      try {
        await whatsappService.disconnectClient(instanceId);
      } catch (error) {
        console.log('⚠️ Instância pode não estar conectada no servidor:', error);
      }
      
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso",
      });

      if (selectedClient) {
        handleViewClientInstances(selectedClient);
      } else {
        loadData();
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao remover instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'default';
      case 'qr_ready': return 'secondary';
      case 'connecting': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'error': return 'Erro';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientInstancesCount = (clientId: string) => {
    return instances.filter(instance => instance.client_id === clientId).length;
  };

  const getClientConnectedInstancesCount = (clientId: string) => {
    return instances.filter(instance => 
      instance.client_id === clientId && instance.status === 'connected'
    ).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Instâncias</h1>
          <p className="text-muted-foreground">
            Gerencie todas as instâncias WhatsApp dos clientes
          </p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{clients.length}</div>
                <p className="text-sm text-gray-600">Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{instances.length}</div>
                <p className="text-sm text-gray-600">Total Instâncias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {instances.filter(i => i.status === 'connected').length}
                </div>
                <p className="text-sm text-gray-600">Conectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <QrCode className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {instances.filter(i => i.status === 'qr_ready').length}
                </div>
                <p className="text-sm text-gray-600">Aguardando QR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes e suas Instâncias</CardTitle>
          <CardDescription>
            Visualize e gerencie as instâncias WhatsApp de cada cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Instâncias</TableHead>
                <TableHead>Conectadas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const totalInstances = getClientInstancesCount(client.id);
                const connectedInstances = getClientConnectedInstancesCount(client.id);
                
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {client.plan.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className="font-medium">{totalInstances}</span>
                        <span className="text-gray-500">/{client.max_instances}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${connectedInstances > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={connectedInstances > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}>
                          {connectedInstances}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {totalInstances === 0 ? (
                        <Badge variant="outline">Sem Instâncias</Badge>
                      ) : connectedInstances === totalInstances ? (
                        <Badge className="bg-green-500">Todas Conectadas</Badge>
                      ) : connectedInstances > 0 ? (
                        <Badge variant="secondary">Parcialmente Conectado</Badge>
                      ) : (
                        <Badge variant="destructive">Desconectado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewClientInstances(client)}
                          disabled={loading}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Instâncias
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleGoToClientChat(client.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Ir para o Chat
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum cliente encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Instances Dialog */}
      <Dialog open={showInstancesDialog} onOpenChange={setShowInstancesDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Instâncias de {selectedClient?.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie as instâncias WhatsApp deste cliente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {instances.length === 0 ? (
              <div className="text-center py-8">
                <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Nenhuma instância criada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((instance) => (
                  <Card key={instance.id} className="border">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(instance.status)}
                          <div>
                            <h3 className="font-medium">
                              {instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Badge variant={getStatusColor(instance.status)}>
                                {getStatusLabel(instance.status)}
                              </Badge>
                              {instance.phone_number && (
                                <span>• {instance.phone_number}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          {instance.status === 'qr_ready' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleViewQrCode(instance.instance_id)}
                            >
                              <QrCode className="w-4 h-4 mr-1" />
                              Ver QR
                            </Button>
                          )}
                          
                          {['disconnected', 'error'].includes(instance.status) && (
                            <Button
                              size="sm"
                              onClick={() => handleReconnectInstance(instance.instance_id)}
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Power className="w-4 h-4 mr-1" />
                              Reconectar
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteInstance(instance.instance_id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie este código com WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4">
            {qrCodeData?.qrCode ? (
              <div className="space-y-4">
                <img 
                  src={qrCodeData.qrCode} 
                  alt="QR Code WhatsApp"
                  className="mx-auto border rounded max-w-full"
                />
                <p className="text-sm text-gray-600">
                  Abra o WhatsApp no seu celular, vá em "Dispositivos conectados" e escaneie este código.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">QR Code não disponível</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientInstancesManager;
