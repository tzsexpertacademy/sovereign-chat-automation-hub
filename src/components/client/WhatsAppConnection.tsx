
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Smartphone, 
  QrCode, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [serverInstances, setServerInstances] = useState<WhatsAppClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppClient | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      loadInstancesData();
      initializeRealTimeConnection();
    }
  }, [clientId]);

  const initializeRealTimeConnection = () => {
    try {
      // Conectar ao WebSocket
      whatsappService.connectSocket();

      // Ouvir atualizações de todos os clientes
      whatsappService.onClientsUpdate((updatedClients) => {
        console.log("📥 Clientes atualizados recebidos:", updatedClients);
        setServerInstances(updatedClients);
        setConnectionError(null);
        
        // Atualizar instâncias no banco quando receber atualizações
        updatedClients.forEach(async (client) => {
          const dbInstance = instances.find(i => i.instance_id === client.clientId);
          if (dbInstance) {
            try {
              await whatsappInstancesService.updateInstance(client.clientId, {
                status: client.status,
                phone_number: client.phoneNumber,
                has_qr_code: client.hasQrCode
              });
            } catch (error) {
              console.error('Erro ao atualizar instância no BD:', error);
            }
          }
        });
        
        // Recarregar instâncias do banco após atualização
        setTimeout(loadInstances, 1000);
      });

      setConnectionError(null);
    } catch (error) {
      console.error("❌ Erro ao inicializar conexão:", error);
      setConnectionError("Erro ao conectar ao servidor WebSocket");
    }
  };

  const loadInstancesData = async () => {
    await Promise.all([
      loadInstances(),
      loadServerInstances()
    ]);
  };

  const loadInstances = async () => {
    if (!clientId) return;
    
    try {
      console.log('🔍 Carregando instâncias do cliente:', clientId);
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      console.log('✅ Instâncias do BD carregadas:', instancesData);
      setInstances(instancesData);
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
    }
  };

  const loadServerInstances = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      
      // Testar conexão primeiro
      const isConnected = await whatsappService.testConnection();
      if (!isConnected) {
        throw new Error("Servidor WhatsApp não está respondendo");
      }

      const clients = await whatsappService.getAllClients();
      console.log("✅ Instâncias do servidor carregadas:", clients);
      setServerInstances(clients);
      setConnectionError(null);
    } catch (error: any) {
      console.error("❌ Erro ao carregar instâncias do servidor:", error);
      setConnectionError(error.message || "Erro ao conectar com o servidor");
      setServerInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      console.log('🔗 Conectando instância:', instanceId);
      
      const result = await whatsappService.connectClient(instanceId);
      console.log('✅ Resultado da conexão:', result);
      
      // Atualizar status no banco
      await whatsappInstancesService.updateInstance(instanceId, {
        status: 'connecting'
      });
      
      // Configurar listener em tempo real para esta instância
      whatsappService.joinClientRoom(instanceId);
      whatsappService.onClientStatus(instanceId, async (clientData) => {
        console.log(`📱 Status atualizado para ${instanceId}:`, clientData);
        
        // Atualizar lista de instâncias do servidor
        setServerInstances(prev => {
          const index = prev.findIndex(c => c.clientId === clientData.clientId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = clientData;
            return updated;
          } else {
            return [...prev, clientData];
          }
        });
        
        // Atualizar instância no banco
        try {
          await whatsappInstancesService.updateInstance(clientData.clientId, {
            status: clientData.status,
            phone_number: clientData.phoneNumber,
            has_qr_code: clientData.hasQrCode
          });
          
          // Recarregar instâncias do banco
          await loadInstances();
        } catch (error) {
          console.error('Erro ao atualizar instância no BD:', error);
        }
      });
      
      toast({
        title: "Sucesso",
        description: `Conectando instância ${instanceId}...`,
      });
      
      // Recarregar dados após delay
      setTimeout(loadInstancesData, 2000);
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(instanceId);
      
      // Atualizar status no banco
      await whatsappInstancesService.updateInstance(instanceId, {
        status: 'disconnected'
      });
      
      toast({
        title: "Sucesso",
        description: `Instância ${instanceId} desconectada`,
      });
      
      await loadInstancesData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestartInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(instanceId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await whatsappService.connectClient(instanceId);
      
      toast({
        title: "Sucesso",
        description: `Instância ${instanceId} reiniciada`,
      });
      
      await loadInstancesData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao reiniciar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewQrCode = async (instanceId: string) => {
    try {
      setLoading(true);
      console.log('🔍 Buscando QR Code para:', instanceId);
      
      const clientStatus = await whatsappService.getClientStatus(instanceId);
      console.log('📱 Status do cliente:', clientStatus);
      
      if (clientStatus && clientStatus.hasQrCode) {
        setSelectedInstance(clientStatus);
        setShowQrModal(true);
      } else {
        toast({
          title: "QR Code não disponível",
          description: "QR Code ainda não foi gerado ou a instância já está conectada",
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
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': case 'auth_failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      case 'auth_failed': return 'Falha na Auth';
      default: return 'Desconhecido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      case 'error': case 'auth_failed': return <AlertCircle className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  // Combinar dados do banco com dados do servidor para ter o status mais atualizado
  const getCombinedInstanceData = (dbInstance: WhatsAppInstanceData) => {
    const serverInstance = serverInstances.find(s => s.clientId === dbInstance.instance_id);
    
    if (serverInstance) {
      // Se existe no servidor, usar status do servidor (mais atual)
      return {
        ...dbInstance,
        status: serverInstance.status,
        phone_number: serverInstance.phoneNumber,
        has_qr_code: serverInstance.hasQrCode,
        serverData: serverInstance
      };
    }
    
    // Se não existe no servidor, usar dados do banco
    return dbInstance;
  };

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  // Connection Error Alert
  if (connectionError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-medium text-red-900">Problema de Conexão</p>
              <p className="text-sm text-red-700">{connectionError}</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={loadInstancesData}
                className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
              >
                Tentar Reconectar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conexões WhatsApp</h1>
          <p className="text-gray-600">Gerencie suas conexões WhatsApp e configure as filas de atendimento</p>
        </div>
        <Button onClick={loadInstancesData} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {instances.filter(i => {
                const combined = getCombinedInstanceData(i);
                return combined.status === 'connected';
              }).length}
            </div>
            <p className="text-xs text-green-600">Online</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Aguardando QR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {instances.filter(i => {
                const combined = getCombinedInstanceData(i);
                return ['qr_ready', 'connecting'].includes(combined.status || '');
              }).length}
            </div>
            <p className="text-xs text-blue-600">Pendentes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Com Problemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {instances.filter(i => {
                const combined = getCombinedInstanceData(i);
                return ['disconnected', 'error', 'auth_failed'].includes(combined.status || '');
              }).length}
            </div>
            <p className="text-xs text-red-600">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Instances List */}
      {instances.length > 0 ? (
        <div className="grid gap-4">
          {instances.map((instance) => {
            const combined = getCombinedInstanceData(instance);
            const serverData = combined.serverData;
            
            return (
              <Card key={instance.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>Instância {instance.instance_id}</span>
                        {serverData && <Wifi className="w-4 h-4 text-green-500" />}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Smartphone className="w-4 h-4 mr-1" />
                        {combined.phone_number || 'Não conectado'}
                      </CardDescription>
                      {serverData && (
                        <CardDescription className="flex items-center mt-1 text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Ativa no servidor WhatsApp
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={combined.status === 'connected' ? 'default' : 'secondary'}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(combined.status || 'disconnected')}
                          <span>{getStatusText(combined.status || 'disconnected')}</span>
                        </div>
                      </Badge>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(combined.status || 'disconnected')}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Info */}
                  <div className="text-sm text-gray-600">
                    <p><strong>Status:</strong> {getStatusText(combined.status || 'disconnected')}</p>
                    {combined.phone_number && <p><strong>Telefone:</strong> {combined.phone_number}</p>}
                    {combined.has_qr_code && <p className="text-blue-600"><strong>QR Code disponível</strong></p>}
                    <p><strong>Criado em:</strong> {new Date(instance.created_at).toLocaleString('pt-BR')}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!serverData && combined.status === 'disconnected' && (
                      <Button
                        size="sm"
                        onClick={() => handleConnectInstance(instance.instance_id)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Conectar
                      </Button>
                    )}
                    
                    {(combined.status === 'qr_ready' || combined.has_qr_code) && (
                      <Button
                        size="sm"
                        onClick={() => handleViewQrCode(instance.instance_id)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Ver QR Code
                      </Button>
                    )}
                    
                    {serverData && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestartInstance(instance.instance_id)}
                          disabled={loading}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Reiniciar
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnectInstance(instance.instance_id)}
                          disabled={loading}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Desconectar
                        </Button>
                      </>
                    )}
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
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma instância WhatsApp configurada
              </h3>
              <p className="text-gray-600 mb-4">
                Entre em contato com o administrador para criar uma instância WhatsApp para sua conta
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie este QR Code com seu WhatsApp para conectar a instância
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {selectedInstance?.qrCode ? (
              <div className="text-center">
                <img 
                  src={selectedInstance.qrCode} 
                  alt="QR Code" 
                  className="max-w-full h-auto border rounded"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Instância: {selectedInstance.clientId}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">QR Code não disponível</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnection;
