
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { 
  Plus, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  MessageSquare,
  Trash2,
  Play,
  Pause,
  Settings,
  Wifi,
  WifiOff,
  Clock,
  Edit3,
  Save,
  X
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { useNavigate } from "react-router-dom";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // Hook unificado corrigido com sincronização de dados reais
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    serverOnline,
    refreshStatus
  } = useUnifiedInstanceManager(instances);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 [WHATSAPP] Carregando dados...');
      
      const clientsData = await clientsService.getAllClients();
      const clientInfo = clientsData.find(c => c.id === clientId);
      setClientData(clientInfo || null);

      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId!);
      console.log('📱 [WHATSAPP] Instâncias carregadas:', instancesData.length);
      setInstances(instancesData);

      // Log das instâncias reais carregadas
      instancesData.forEach(instance => {
        console.log(`📊 [WHATSAPP] Instância real:`, {
          id: instance.instance_id,
          status: instance.status,
          phone: instance.phone_number,
          hasQR: instance.has_qr_code,
          customName: instance.custom_name
        });
      });

    } catch (error) {
      console.error('❌ [WHATSAPP] Erro ao carregar dados:', error);
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
    // Cliente especial sem limites
    if (clientData.email === 'thalisportal@gmail.com') return true;
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
      console.log('🚀 [WHATSAPP] Criando nova instância...');
      
      const customName = `Conexão ${instances.length + 1}`;
      const instanceId = `${clientId}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: customName
      });
      
      console.log('✅ [WHATSAPP] Instância criada com sucesso');

      toast({
        title: "Sucesso",
        description: "Nova instância WhatsApp criada!",
      });

      await loadData();

    } catch (error: any) {
      console.error('❌ [WHATSAPP] Erro ao criar instância:', error);
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
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    try {
      setLoading(true);
      
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso",
      });

      await loadData();
      
    } catch (error: any) {
      console.error('❌ [WHATSAPP] Erro ao remover:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      console.log('🚀 [WHATSAPP] Iniciando conexão:', instanceId);
      await connectInstance(instanceId);
      
      // Aguardar e verificar status
      setTimeout(() => {
        refreshStatus(instanceId);
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ [WHATSAPP] Erro ao conectar:', error);
      toast({
        title: "Erro na Conexão",
        description: error.message || "Falha ao conectar instância",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      console.log('🔌 [WHATSAPP] Desconectando:', instanceId);
      await disconnectInstance(instanceId);
      await loadData();
    } catch (error: any) {
      console.error('❌ [WHATSAPP] Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
        variant: "destructive",
      });
    }
  };

  const handleEditName = (instanceId: string, currentName: string) => {
    setEditingName(instanceId);
    setNewName(currentName);
  };

  const handleSaveName = async (instanceId: string) => {
    if (!newName.trim()) {
      toast({
        title: "Erro",
        description: "Nome não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    try {
      await whatsappInstancesService.updateCustomName(instanceId, newName.trim());
      
      toast({
        title: "Sucesso",
        description: "Nome atualizado com sucesso",
      });
      
      setEditingName(null);
      setNewName("");
      await loadData();
      
    } catch (error: any) {
      console.error('❌ [WHATSAPP] Erro ao atualizar nome:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar nome",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingName(null);
    setNewName("");
  };

  const getInstanceDisplayName = (instance: WhatsAppInstanceData) => {
    return instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-5 h-5 text-blue-500" />;
      case 'connecting': return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
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
            Gerencie suas conexões WhatsApp
          </p>
          {clientData && (
            <div className="flex items-center space-x-4 mt-2">
              <Badge variant="outline">
                Plano {clientData.plan.toUpperCase()}: {instances.length} / {clientData.email === 'thalisportal@gmail.com' ? '∞' : clientData.max_instances} conexões
              </Badge>
              <div className="flex items-center space-x-1">
                {serverOnline ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Servidor Online</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-600">Servidor Offline</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleCreateInstance}
            disabled={creating || !canCreateNewInstance() || !serverOnline}
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


      {/* Limite de Plano */}
      {!canCreateNewInstance() && clientData?.email !== 'thalisportal@gmail.com' && (
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

      {/* Servidor Offline */}
      {!serverOnline && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Servidor WhatsApp Offline</p>
                <p className="text-sm text-red-700">
                  O servidor não está respondendo. Algumas funcionalidades podem não funcionar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
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

      {/* Estado Inicial */}
      {instances.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeira Conexão WhatsApp</CardTitle>
            <CardDescription>
              Crie sua primeira conexão WhatsApp com a nova lógica otimizada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Após criar a conexão, você poderá conectar e obter o QR Code automaticamente.
              </p>
              <Button 
                onClick={handleCreateInstance} 
                disabled={creating || !serverOnline}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Instâncias */}
      {instances.map((instance) => {
        const instanceStatus = getInstanceStatus(instance.instance_id);
        const displayName = getInstanceDisplayName(instance);
        const instanceLoading = isLoading(instance.instance_id);
        
        return (
          <Card key={instance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(instanceStatus.status)}`} />
                    {getStatusIcon(instanceStatus.status)}
                  </div>
                   <div className="flex-1">
                     <CardTitle className="text-lg flex items-center space-x-2">
                       {editingName === instance.instance_id ? (
                         <div className="flex items-center space-x-2">
                           <Input
                             value={newName}
                             onChange={(e) => setNewName(e.target.value)}
                             className="text-lg font-semibold max-w-48"
                             placeholder="Nome da instância"
                           />
                           <Button 
                             size="sm" 
                             onClick={() => handleSaveName(instance.instance_id)}
                             className="h-8 w-8 p-0"
                           >
                             <Save className="w-4 h-4" />
                           </Button>
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={handleCancelEdit}
                             className="h-8 w-8 p-0"
                           >
                             <X className="w-4 h-4" />
                           </Button>
                         </div>
                       ) : (
                         <div className="flex items-center space-x-2">
                           <span>{displayName}</span>
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => handleEditName(instance.instance_id, displayName)}
                             className="h-6 w-6 p-0"
                           >
                             <Edit3 className="w-3 h-3" />
                           </Button>
                         </div>
                       )}
                       <Badge variant={instanceStatus.status === 'connected' ? 'default' : 'secondary'}>
                         {getStatusLabel(instanceStatus.status)}
                       </Badge>
                     </CardTitle>
                     <CardDescription className="flex items-center mt-1">
                       <Smartphone className="w-4 h-4 mr-1" />
                       {instanceStatus.phoneNumber || 'Não conectado'}
                       <span className="mx-2">•</span>
                       ID: {instance.instance_id.split('_').pop()}
                     </CardDescription>
                   </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Status de Conectando */}
              {instanceStatus.status === 'connecting' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
                    <p className="text-yellow-800 text-sm font-medium">
                      Iniciando conexão WebSocket...
                    </p>
                  </div>
                </div>
              )}

              {/* QR Code Display */}
              {instanceStatus.status === 'qr_ready' && instanceStatus.hasQrCode && instanceStatus.qrCode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <QRCodeDisplay
                    qrCode={instanceStatus.qrCode}
                    instanceName={displayName}
                    onRefresh={() => refreshStatus(instance.instance_id)}
                    refreshing={instanceLoading}
                    autoRefreshInterval={60000}
                    showInstructions={true}
                  />
                </div>
              )}
              
              {/* Status de Sucesso */}
              {instanceStatus.status === 'connected' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-800 text-sm font-medium">
                        ✅ WhatsApp conectado e funcionando!
                      </p>
                      {instanceStatus.phoneNumber && (
                        <p className="text-green-600 text-xs">
                          📱 {instanceStatus.phoneNumber}
                        </p>
                      )}
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/client/${clientId}/chat`)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Abrir Chat
                    </Button>
                  </div>
                </div>
              )}

              {/* Status de Erro */}
              {instanceStatus.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-red-800 text-sm font-medium">
                      Erro na conexão. Tente novamente.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Ações */}
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex space-x-2">
                  {instanceStatus.status === 'connected' ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDisconnectInstance(instance.instance_id)}
                      disabled={instanceLoading}
                    >
                      {instanceLoading ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4 mr-1" />
                      )}
                      Desconectar
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => handleConnectInstance(instance.instance_id)}
                      disabled={instanceLoading || !serverOnline}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {instanceLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          Conectando...
                        </>
                      ) : !serverOnline ? (
                        <>
                          <WifiOff className="w-4 h-4 mr-1" />
                          Servidor Offline
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Conectar
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/client/${clientId}/queues`)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Configurar Fila
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteInstance(instance.instance_id)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WhatsAppConnection;
