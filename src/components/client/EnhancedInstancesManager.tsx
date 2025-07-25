
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { 
  Smartphone, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Activity,
  QrCode,
  RefreshCw,
  Trash2,
  MessageSquare
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";

const EnhancedInstancesManager = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Hook unificado corrigido
  const { 
    connectInstance, 
    disconnectInstance,
    refreshStatus,
    getInstanceStatus,
    isLoading
  } = useUnifiedInstanceManager();

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      const clients = await clientsService.getAllClients();
      const clientData = clients.find(c => c.id === clientId);
      
      if (!clientData) {
        toast({
          title: "Erro",
          description: "Cliente não encontrado",
          variant: "destructive",
        });
        navigate('/admin/clients');
        return;
      }
      
      setClient(clientData);
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
      
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do cliente", 
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!client) return;

    const canCreate = await clientsService.canCreateInstance(client.id);
    if (!canCreate) {
      toast({
        title: "Limite Atingido",
        description: `Limite de ${client.max_instances} instância(s) atingido`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const instanceId = `${client.id}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: client.id,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: `Instância ${instances.length + 1}`
      });

      toast({
        title: "Sucesso",
        description: "Nova instância criada com sucesso",
      });

      await loadClientData();
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

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso",
      });

      await loadClientData();
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive",
      });
    }
  };

  const getStatusInfo = (instance: WhatsAppInstanceData) => {
    const status = getInstanceStatus(instance.instance_id);
    
    switch (status.status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          text: 'Conectado',
          variant: 'default' as const,
          description: status.phoneNumber ? `Telefone: ${status.phoneNumber}` : 'Online'
        };
      case 'qr_ready':
        return {
          icon: <QrCode className="w-4 h-4 text-blue-500" />,
          text: 'QR Pronto',
          variant: 'secondary' as const,
          description: 'Escaneie o QR code para conectar'
        };
      case 'connecting':
        return {
          icon: <Clock className="w-4 h-4 text-yellow-500" />,
          text: 'Conectando',
          variant: 'outline' as const,
          description: 'Aguardando conexão...'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          text: 'Erro',
          variant: 'destructive' as const,
          description: 'Falha na conexão - Tente conectar novamente'
        };
      default:
        return {
          icon: <Activity className="w-4 h-4 text-gray-500" />,
          text: 'Desconectado',
          variant: 'outline' as const,
          description: 'Instância desconectada'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Carregando instâncias...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium mb-2">Cliente não encontrado</h3>
        <Button onClick={() => navigate('/admin/clients')}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{client.name}</CardTitle>
              <CardDescription>{client.email}</CardDescription>
            </div>
            <div className="text-right">
              <Badge>{client.plan.toUpperCase()}</Badge>
              <div className="text-sm text-muted-foreground mt-1">
                {instances.length} / {client.max_instances} instâncias
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status do Sistema */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <span className="text-green-600">✅ Sistema YUMER online - Nova lógica de conexão ativa</span>
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex gap-4">
        <Button 
          onClick={handleCreateInstance}
          disabled={creating || instances.length >= client.max_instances}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {creating ? 'Criando...' : 'Nova Instância'}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={loadClientData}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading && 'animate-spin'}`} />
          Atualizar
        </Button>
      </div>

      {/* Instances List */}
      {instances.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma instância criada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira instância WhatsApp para começar
            </p>
            <Button onClick={handleCreateInstance} disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {instances.map((instance) => {
            const statusInfo = getStatusInfo(instance);
            const instanceStatus = getInstanceStatus(instance.instance_id);
            
            return (
              <Card key={instance.id} className="border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {statusInfo.icon}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">
                            {instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`}
                          </h3>
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.text}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {statusInfo.description}
                        </p>
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: {instance.instance_id}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {instanceStatus.status === 'connected' ? (
                        <>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/client/${clientId}/chat`}>
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Chat
                            </a>
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => disconnectInstance(instance.instance_id)}
                            disabled={isLoading(instance.instance_id)}
                          >
                            {isLoading(instance.instance_id) ? (
                              <Activity className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              'Desconectar'
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => connectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isLoading(instance.instance_id) ? (
                            <Activity className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            'Conectar'
                          )}
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteInstance(instance.instance_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Show QR Code if available - NOVO COMPONENTE */}
                  {instanceStatus.hasQrCode && instanceStatus.qrCode && (
                    <div className="mt-4">
                      <QRCodeDisplay
                        qrCode={instanceStatus.qrCode}
                        instanceName={instance.custom_name || instance.instance_id}
                        onRefresh={() => refreshStatus(instance.instance_id)}
                        refreshing={isLoading(instance.instance_id)}
                        autoRefreshInterval={45000}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EnhancedInstancesManager;
