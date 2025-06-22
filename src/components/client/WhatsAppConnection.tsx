
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Edit,
  Users,
  MessageSquare,
  Trash2,
  Power,
  RotateCcw,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { useConnectionMonitor } from "@/hooks/useConnectionMonitor";
import whatsappService from "@/services/whatsappMultiClient";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const {
    instances,
    isMonitoring,
    monitorInstances,
    disconnectInstance,
    reconnectInstance
  } = useConnectionMonitor(clientId!);
  
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{instanceId: string, qrCode: string} | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Carregar dados do cliente
      const clientsData = await clientsService.getAllClients();
      const clientInfo = clientsData.find(c => c.id === clientId);
      setClientData(clientInfo || null);

      // Carregar filas
      const queuesData = await queuesService.getClientQueues(clientId!);
      setQueues(queuesData);

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewInstance = async () => {
    if (!clientData) {
      toast({
        title: "Erro",
        description: "Dados do cliente não carregados",
        variant: "destructive",
      });
      return;
    }

    try {
      const canCreate = await clientsService.canCreateInstance(clientId!);
      if (!canCreate) {
        toast({
          title: "Limite Atingido",
          description: `Limite de ${clientData.max_instances} instâncias atingido para o plano ${clientData.plan}`,
          variant: "destructive",
        });
        return;
      }

      setCreating(true);
      const instanceId = `${clientId}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: clientId!,
        instance_id: instanceId,
        status: 'disconnected'
      });

      toast({
        title: "Instância Criada",
        description: "Nova instância WhatsApp criada com sucesso",
      });

      // Recarregar dados
      await loadClientData();
      await monitorInstances();
      
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar nova instância",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteInstance = async (instanceId: string) => {
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Instância Removida",
        description: "Instância WhatsApp removida com sucesso",
      });

      // Recarregar dados
      await loadClientData();
      await monitorInstances();
      
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive",
      });
    }
  };

  const handleShowQrCode = async (instanceId: string) => {
    try {
      setLoadingQr(true);
      console.log('🔍 Buscando QR Code para instância:', instanceId);
      
      // Buscar status atual do servidor para obter QR code
      const serverStatus = await whatsappService.getClientStatus(instanceId);
      
      if (serverStatus.qrCode) {
        setQrCodeData({
          instanceId,
          qrCode: serverStatus.qrCode
        });
        setShowQrDialog(true);
      } else {
        toast({
          title: "QR Code não disponível",
          description: "QR Code não está pronto ainda. Tente reconectar a instância.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Erro ao buscar QR Code:', error);
      toast({
        title: "Erro",
        description: "Falha ao buscar QR Code",
        variant: "destructive",
      });
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    const success = await disconnectInstance(instanceId);
    
    if (success) {
      toast({
        title: "Desconectado",
        description: "Instância WhatsApp desconectada com sucesso",
      });
    } else {
      toast({
        title: "Erro",
        description: "Falha ao desconectar instância",
        variant: "destructive",
      });
    }
  };

  const handleReconnectInstance = async (instanceId: string, showToast: boolean = true) => {
    const success = await reconnectInstance(instanceId);
    
    if (success && showToast) {
      toast({
        title: "Reconectando",
        description: "Instância sendo reconectada. Aguarde o QR Code...",
      });
    } else if (!success && showToast) {
      toast({
        title: "Erro",
        description: "Falha ao reconectar instância",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-5 h-5 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <WifiOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'Aguardando QR';
      case 'connecting': return 'Conectando';
      case 'error': return 'Erro';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  const getConnectionStatusIndicator = (status: string) => {
    if (status === 'connected') {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Online</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline</span>
          <div className="w-2 h-2 bg-red-500 rounded-full" />
        </div>
      );
    }
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando conexões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões WhatsApp - Status em tempo real
          </p>
          {clientData && (
            <p className="text-sm text-gray-500 mt-1">
              Plano {clientData.plan.toUpperCase()}: {instances.length} / {clientData.max_instances} conexões
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={createNewInstance}
            disabled={creating || !clientData || instances.length >= (clientData?.max_instances || 1)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? 'Criando...' : 'Nova Instância'}
          </Button>
          <Button 
            onClick={monitorInstances} 
            variant="outline" 
            disabled={isMonitoring}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isMonitoring ? 'animate-spin' : ''}`} />
            {isMonitoring ? 'Verificando...' : 'Verificar Status'}
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <WifiOff className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {instances.filter(i => ['disconnected', 'error'].includes(i.status)).length}
                </div>
                <p className="text-sm text-gray-600">Desconectadas</p>
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
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-8 h-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {instances.filter(i => i.status === 'connecting').length}
                </div>
                <p className="text-sm text-gray-600">Conectando</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {instances.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
              <p className="text-gray-600 mb-4">
                Crie sua primeira instância WhatsApp para começar a receber mensagens
              </p>
              <Button 
                onClick={createNewInstance}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {creating ? 'Criando...' : 'Criar Primeira Instância'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instances List */}
      {instances.map((instance) => {
        const displayName = instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
        
        return (
          <Card key={instance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                  <div>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <span>{displayName}</span>
                      {getConnectionStatusIndicator(instance.status)}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Smartphone className="w-4 h-4 mr-1" />
                      {instance.phone_number || 'Não conectado'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(instance.status)}
                      <span className="capitalize">{getStatusLabel(instance.status)}</span>
                    </div>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Connection Actions */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  {instance.status === 'connected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDisconnectInstance(instance.instance_id)}
                      className="text-orange-600 hover:text-orange-700 border-orange-300"
                    >
                      <Power className="w-4 h-4 mr-1" />
                      Desconectar
                    </Button>
                  )}
                  
                  {['disconnected', 'error'].includes(instance.status) && (
                    <Button
                      size="sm"
                      onClick={() => handleReconnectInstance(instance.instance_id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reconectar
                    </Button>
                  )}
                  
                  {instance.status === 'qr_ready' && (
                    <Button 
                      size="sm"
                      onClick={() => handleShowQrCode(instance.instance_id)}
                      disabled={loadingQr}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      {loadingQr ? 'Carregando...' : 'Ver QR Code'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteInstance(instance.instance_id)}
                    className="text-red-600 hover:text-red-700 border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500">
                  Última atualização: {new Date(instance.updated_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Status Messages */}
              {instance.status === 'connected' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-800">
                      ✅ WhatsApp conectado e funcionando - Monitoramento ativo
                    </span>
                  </div>
                </div>
              )}

              {['disconnected', 'error'].includes(instance.status) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-red-800">Conexão Perdida</h4>
                      <p className="text-sm text-red-700">
                        A conexão com o WhatsApp foi perdida. Sistema tentando reconectar automaticamente...
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleReconnectInstance(instance.instance_id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reconectar Agora
                    </Button>
                  </div>
                </div>
              )}

              {instance.status === 'qr_ready' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-800">QR Code Pronto</h4>
                      <p className="text-sm text-blue-700">
                        📱 Escaneie o QR Code com seu WhatsApp para conectar
                      </p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => handleShowQrCode(instance.instance_id)}
                      disabled={loadingQr}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      {loadingQr ? 'Carregando...' : 'Ver QR Code'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <QrCode className="w-5 h-5" />
              <span>QR Code WhatsApp</span>
            </DialogTitle>
            <DialogDescription>
              Escaneie este QR Code com seu WhatsApp para conectar a instância
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            {qrCodeData?.qrCode ? (
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <img 
                  src={qrCodeData.qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center">
                  <QrCode className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">QR Code não disponível</p>
                </div>
              </div>
            )}
            
            <div className="text-center text-sm text-gray-600">
              <p className="font-medium">Como escanear:</p>
              <p>1. Abra o WhatsApp no seu celular</p>
              <p>2. Vá em ⋮ (menu) &gt; Dispositivos conectados</p>
              <p>3. Toque em "Conectar um dispositivo"</p>
              <p>4. Aponte a câmera para este QR Code</p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowQrDialog(false)}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnection;
