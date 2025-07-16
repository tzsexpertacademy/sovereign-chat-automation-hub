import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Smartphone, 
  Trash2, 
  QrCode,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Edit,
  Save,
  X,
  Play,
  Pause,
  Wifi,
  WifiOff,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { useNavigate } from "react-router-dom";

interface ClientInstancesPanelProps {
  clientId: string;
  client: ClientData;
  onInstancesUpdate?: () => void;
}

const ClientInstancesPanel = ({ clientId, client, onInstancesUpdate }: ClientInstancesPanelProps) => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Hook unificado
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading: isInstanceLoading,
    websocketConnected,
    jwtConfigured,
    cleanup,
    refreshStatus
  } = useUnifiedInstanceManager();

  useEffect(() => {
    loadInstances();
  }, [clientId]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
      console.log(`📊 [CLIENT] Carregadas ${instancesData.length} instâncias para cliente ${clientId}`);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar instâncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewInstance = async () => {
    try {
      // Verificar limite
      const canCreate = await clientsService.canCreateInstance(clientId);
      
      if (!canCreate) {
        // Auto-upgrade para cliente especial
        if (client.email === 'thalisportal@gmail.com') {
          const newPlan = client.plan === 'basic' ? 'standard' : 
                         client.plan === 'standard' ? 'premium' : 'enterprise';
          
          await clientsService.updateClient(client.id, { plan: newPlan });
          
          toast({
            title: "Plano Atualizado",
            description: `Plano atualizado para ${newPlan.toUpperCase()} automaticamente`,
          });
          
          onInstancesUpdate?.();
          
          // Tentar criar novamente após upgrade
          setTimeout(() => createNewInstance(), 1000);
          return;
        }
        
        toast({
          title: "Limite Atingido",
          description: `Limite de ${client.max_instances} instâncias atingido para o plano ${client.plan}`,
          variant: "destructive",
        });
        return;
      }

      setCreating(true);
      const instanceId = `${clientId}_${Date.now()}`;
      const customName = `Instância ${instances.length + 1}`;
      
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: customName
      });

      toast({
        title: "Instância Criada",
        description: "Nova instância WhatsApp criada com sucesso",
      });

      await loadInstances();
      onInstancesUpdate?.();
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
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    try {
      // Desconectar primeiro se estiver conectada
      const instanceStatus = getInstanceStatus(instanceId);
      if (instanceStatus.status === 'connected') {
        await disconnectInstance(instanceId);
      }
      
      // Limpar do hook
      cleanup(instanceId);
      
      // Remover do banco
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Instância Removida",
        description: "Instância WhatsApp removida com sucesso",
      });

      await loadInstances();
      onInstancesUpdate?.();
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive",
      });
    }
  };

  const startEdit = (instance: WhatsAppInstanceData) => {
    setEditingId(instance.id);
    setEditName(instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`);
  };

  const saveEdit = async (instanceId: string) => {
    try {
      await whatsappInstancesService.updateInstanceById(instanceId, {
        custom_name: editName
      });

      toast({
        title: "Nome Atualizado",
        description: "Nome da instância atualizado com sucesso",
      });

      setEditingId(null);
      await loadInstances();
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar nome da instância",
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      await connectInstance(instanceId);
      // Aguardar um pouco e então verificar status
      setTimeout(() => refreshStatus(instanceId), 2000);
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      await disconnectInstance(instanceId);
      await loadInstances();
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-blue-500" />;
      case 'connecting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'error': return 'Erro';
      default: return 'Desconectado';
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

  const isSpecialClient = client.email === 'thalisportal@gmail.com';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5" />
                <span>Instâncias WhatsApp</span>
              </CardTitle>
              <CardDescription>
                Gerencie suas conexões WhatsApp
                {isSpecialClient && (
                  <Badge variant="secondary" className="ml-2">
                    Cliente Especial
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-right">
                {jwtConfigured ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">JWT OK</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-600">JWT Error</span>
                  </div>
                )}
                {websocketConnected ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs">
                  {websocketConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {instances.length} / {isSpecialClient ? '∞' : client.max_instances} instâncias
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600">
              {instances.length === 0 
                ? 'Nenhuma instância criada' 
                : `${instances.filter(i => getInstanceStatus(i.instance_id).status === 'connected').length} conectadas de ${instances.length}`
              }
            </div>
            <Button 
              onClick={createNewInstance}
              disabled={creating || (!isSpecialClient && instances.length >= client.max_instances)}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Criando...' : 'Nova Instância'}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Carregando instâncias...</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
              <p className="text-gray-600 mb-4">
                Crie sua primeira instância WhatsApp para começar
              </p>
              <Button onClick={createNewInstance} disabled={creating}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Instância
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance) => {
                const instanceStatus = getInstanceStatus(instance.instance_id);
                const loading = isInstanceLoading(instance.instance_id);
                const hasQrCode = instanceStatus.hasQrCode && instanceStatus.qrCode;
                
                return (
                  <Card key={instance.id} className="border">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header da Instância */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(instanceStatus.status)}
                            <div className="flex-1">
                              {editingId === instance.id ? (
                                <div className="flex items-center space-x-2">
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="max-w-xs"
                                    placeholder="Nome da instância"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => saveEdit(instance.id)}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <h3 className="font-medium">
                                      {instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`}
                                    </h3>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEdit(instance)}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Badge variant={getStatusColor(instanceStatus.status)}>
                                      {getStatusText(instanceStatus.status)}
                                    </Badge>
                                    {instanceStatus.phoneNumber && (
                                      <span>• {instanceStatus.phoneNumber}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status de Conexão */}
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
                        {instanceStatus.status === 'qr_ready' && hasQrCode && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="text-center space-y-3">
                              <h4 className="font-medium text-blue-900">📱 QR Code Disponível!</h4>
                              <div className="bg-white p-3 rounded border inline-block">
                                <img 
                                  src={instanceStatus.qrCode} 
                                  alt="QR Code WhatsApp"
                                  className="max-w-[200px] mx-auto"
                                />
                              </div>
                              <p className="text-sm text-blue-700">
                                Escaneie com seu WhatsApp para conectar
                              </p>
                              <div className="text-xs text-blue-600">
                                ✅ JWT Configurado • WebSocket {websocketConnected ? 'Conectado' : 'Desconectado'}
                              </div>
                            </div>
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
                                Ir para Chat
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
                        <div className="flex space-x-2 flex-wrap">
                          {instanceStatus.status === 'connected' ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDisconnectInstance(instance.instance_id)}
                              disabled={loading}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pausar
                            </Button>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => handleConnectInstance(instance.instance_id)}
                              disabled={loading || !jwtConfigured}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {loading ? (
                                <>
                                  <Clock className="w-4 h-4 mr-1 animate-spin" />
                                  Conectando...
                                </>
                              ) : !jwtConfigured ? (
                                <>
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  JWT Necessário
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
                            variant="destructive"
                            onClick={() => deleteInstance(instance.instance_id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientInstancesPanel;