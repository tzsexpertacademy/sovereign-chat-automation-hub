
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { 
  Plus, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  MessageSquare,
  Trash2
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useInstanceManager } from "@/hooks/useInstanceManager";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Hook com nova lógica que funcionou
  const { 
    connectInstance, 
    disconnectInstance,
    refreshQRCode,
    getInstanceStatus,
    isLoading
  } = useInstanceManager();

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados da conexão WhatsApp...');
      
      const clientsData = await clientsService.getAllClients();
      const clientInfo = clientsData.find(c => c.id === clientId);
      setClientData(clientInfo || null);

      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId!);
      console.log('📱 Instâncias do banco:', instancesData);
      setInstances(instancesData);

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

  const canCreateNewInstance = () => {
    if (!clientData) return false;
    return instances.length < clientData.max_instances;
  };

  const handleCreateInstance = async () => {
    if (!clientId || !clientData) return;

    if (!canCreateNewInstance()) {
      toast({
        title: "Limite Atingido",
        description: `Seu plano ${clientData.plan.toUpperCase()} permite apenas ${clientData.max_instances} instância(s).`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      console.log('🚀 Criando nova instância...');
      
      const customName = `Conexão ${instances.length + 1}`;
      const instanceId = `${clientId}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: customName
      });
      
      console.log('✅ [WHATSAPP] Instância criada com sucesso');

      if (instances.length === 0) {
        await clientsService.updateClientInstance(clientId, instanceId, 'connecting');
      }
      
      toast({
        title: "Sucesso",
        description: "Nova instância WhatsApp criada!",
      });

      setTimeout(() => {
        loadData();
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar instância WhatsApp",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      
      await whatsappInstancesService.deleteInstance(instanceId);
      
      if (clientData?.instance_id === instanceId) {
        await clientsService.updateClientInstance(clientId!, "", "disconnected");
      }
      
      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso",
      });

      await loadData();
      
    } catch (error: any) {
      console.error('❌ Erro ao remover:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInstanceDisplayName = (instance: WhatsAppInstanceData) => {
    return instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-5 h-5 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões WhatsApp com a nova lógica otimizada
          </p>
          {clientData && (
            <p className="text-sm text-gray-500 mt-1">
              Plano {clientData.plan.toUpperCase()}: {instances.length} / {clientData.max_instances} conexões
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleCreateInstance}
            disabled={creating || !canCreateNewInstance()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conexão
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Plan Limit Warning */}
      {!canCreateNewInstance() && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-900">Limite de Conexões Atingido</p>
                <p className="text-sm text-orange-700">
                  Seu plano {clientData?.plan.toUpperCase()} permite apenas {clientData?.max_instances} conexão(ões).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <span className="text-green-600">✅ Sistema usando nova lógica YUMER - QR Code direto do connect!</span>
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {instances.filter(i => getInstanceStatus(i.instance_id).status === 'connected').length}
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
                  {instances.filter(i => getInstanceStatus(i.instance_id).status === 'qr_ready').length}
                </div>
                <p className="text-sm text-gray-600">Aguardando QR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {instances.filter(i => ['error', 'disconnected'].includes(getInstanceStatus(i.instance_id).status)).length}
                </div>
                <p className="text-sm text-gray-600">Desconectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Instance Info Card */}
      {instances.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeira Conexão WhatsApp</CardTitle>
            <CardDescription>
              Crie sua primeira conexão WhatsApp com a nova lógica otimizada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Após criar a conexão, você poderá conectar e obter o QR Code automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instances List */}
      {instances.map((instance) => {
        const instanceStatus = getInstanceStatus(instance.instance_id);
        const displayName = getInstanceDisplayName(instance);
        
        return (
          <Card key={instance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col items-center">
                    {getStatusIcon(instanceStatus.status)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {displayName}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Smartphone className="w-4 h-4 mr-1" />
                      {instanceStatus.phoneNumber || 'Não conectado'}
                    </CardDescription>
                    <Badge variant={instanceStatus.status === 'connected' ? 'default' : 'secondary'} className="mt-2">
                      {getStatusLabel(instanceStatus.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {instanceStatus.status === 'connected' ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => disconnectInstance(instance.instance_id)}
                      disabled={isLoading(instance.instance_id)}
                    >
                      {isLoading(instance.instance_id) ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        'Desconectar'
                      )}
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => connectInstance(instance.instance_id)}
                      disabled={isLoading(instance.instance_id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoading(instance.instance_id) ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        'Conectar'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Show QR Code if available - USANDO NOVO COMPONENTE */}
              {instanceStatus.hasQrCode && instanceStatus.qrCode && (
                <QRCodeDisplay
                  qrCode={instanceStatus.qrCode}
                  instanceName={displayName}
                  onRefresh={() => refreshQRCode(instance.instance_id)}
                  refreshing={isLoading(instance.instance_id)}
                  autoRefreshInterval={60000}
                />
              )}

              {/* WhatsApp Status */}
              {instanceStatus.status === 'connected' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-800">
                      ✅ WhatsApp conectado e funcionando
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
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
                
                {instanceStatus.status === 'connected' && (
                  <Button size="sm" variant="default" asChild>
                    <a href={`/client/${clientId}/chat`}>
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Abrir Chat
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WhatsAppConnection;
