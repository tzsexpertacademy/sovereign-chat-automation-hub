
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Pause
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import { useInstanceManager } from "@/hooks/useInstanceManager";

interface MultipleInstancesManagerProps {
  clientId: string;
  client: ClientData;
  onInstancesUpdate?: () => void;
}

const MultipleInstancesManager = ({ clientId, client, onInstancesUpdate }: MultipleInstancesManagerProps) => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();

  // Hook unificado para gerenciar instâncias
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  } = useInstanceManager();

  useEffect(() => {
    loadInstances();
  }, [clientId]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
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
      // Check if we can create more instances
      const canCreate = await clientsService.canCreateInstance(clientId);
      
      if (!canCreate) {
        // Auto-upgrade for special client
        if (client.email === 'thalisportal@gmail.com') {
          const newPlan = client.plan === 'basic' ? 'standard' : 
                         client.plan === 'standard' ? 'premium' : 'enterprise';
          
          await clientsService.updateClient(client.id, { plan: newPlan });
          
          toast({
            title: "Plano Atualizado",
            description: `Plano atualizado para ${newPlan.toUpperCase()} automaticamente`,
          });
          
          // Reload client data
          onInstancesUpdate?.();
          
          // Try creating again after upgrade
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
    try {
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
                <span>Gerenciar Instâncias WhatsApp</span>
              </CardTitle>
              <CardDescription>
                Gerencie múltiplas instâncias WhatsApp para este cliente
                {isSpecialClient && (
                  <Badge variant="secondary" className="ml-2">
                    Cliente Especial - Sem Limite
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Plano: <Badge variant="outline">{client.plan.toUpperCase()}</Badge>
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
              {instances.length === 0 ? 'Nenhuma instância criada' : `${instances.length} instância(s) criada(s)`}
            </div>
            <Button 
              onClick={createNewInstance}
              disabled={creating}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Criando...' : 'Nova Instância'}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando instâncias...</div>
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
            <div className="grid gap-4">
              {instances.map((instance) => (
                <Card key={instance.id} className="border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(instance.status)}
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
                                <Badge variant={getStatusColor(instance.status)}>
                                  {getStatusText(instance.status)}
                                </Badge>
                                {instance.phone_number && (
                                  <span>• {instance.phone_number}</span>
                                )}
                                <span>• ID: {instance.instance_id.split('_').pop()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        {instance.status === 'connected' ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => disconnectInstance(instance.instance_id)}
                            disabled={isLoading(instance.instance_id)}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pausar
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => connectInstance(instance.instance_id)}
                            disabled={isLoading(instance.instance_id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Conectar
                          </Button>
                        )}
                        
                        {getInstanceStatus(instance.instance_id).hasQrCode && (
                          <Button size="sm" variant="outline">
                            <QrCode className="w-4 h-4 mr-1" />
                            Ver QR
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteInstance(instance.instance_id)}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default MultipleInstancesManager;
