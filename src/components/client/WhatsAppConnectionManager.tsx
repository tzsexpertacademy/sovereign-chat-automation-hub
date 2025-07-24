import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Wifi, 
  WifiOff, 
  Clock,
  MessageSquare,
  Settings,
  AlertTriangle,
  Crown,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedInstanceManager } from '@/hooks/useUnifiedInstanceManager';
import { clientsService } from '@/services/clientsService';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface ClientData {
  id: string;
  name: string;
  email: string;
  plan: string;
  max_instances: number;
  current_instances: number;
}

const WhatsAppConnectionManager = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  
  const { 
    instances: managerInstances, 
    connectInstance, 
    disconnectInstance, 
    getInstanceStatus, 
    isLoading: isInstanceLoading,
    refreshStatus
  } = useUnifiedInstanceManager();

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      
      // Carregar dados do cliente
      const clientData = await clientsService.syncClientWithBusiness(clientId);
      if (!clientData) {
        toast({
          title: "❌ Cliente não encontrado",
          description: "Redirecionando para página inicial",
          variant: "destructive"
        });
        navigate('/admin');
        return;
      }
      setClient(clientData);

      // Carregar instâncias
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
      
      // Atualizar status de cada instância
      for (const instance of instancesData) {
        await refreshStatus(instance.instance_id);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "❌ Erro ao carregar dados",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const canCreateNewInstance = () => {
    return client && instances.length < client.max_instances;
  };

  const handleCreateInstance = async () => {
    if (!clientId || !canCreateNewInstance()) return;
    
    try {
      setCreating(true);
      
      const newInstance = await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: `instance_${Date.now()}`,
        custom_name: `WhatsApp ${instances.length + 1}`,
        status: 'disconnected'
      });
      
      setInstances(prev => [...prev, newInstance]);
      
      toast({
        title: "✅ Instância criada",
        description: "Nova conexão WhatsApp criada com sucesso",
      });
      
      await loadData();
      
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "❌ Erro ao criar instância",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return;
    
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      setInstances(prev => prev.filter(i => i.instance_id !== instanceId));
      
      toast({
        title: "✅ Instância excluída",
        description: "Conexão WhatsApp removida com sucesso",
      });
      
    } catch (error) {
      console.error('Erro ao excluir instância:', error);
      toast({
        title: "❌ Erro ao excluir instância",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    }
  };

  const handleEditName = async (instanceId: string) => {
    if (!newName.trim()) return;
    
    try {
      await whatsappInstancesService.updateCustomName(instanceId, newName.trim());
      setInstances(prev => prev.map(i => 
        i.instance_id === instanceId 
          ? { ...i, custom_name: newName.trim() }
          : i
      ));
      
      setEditingId(null);
      setNewName('');
      
      toast({
        title: "✅ Nome atualizado",
        description: "Nome da instância alterado com sucesso",
      });
      
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      toast({
        title: "❌ Erro ao atualizar nome",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4" />,
          label: 'Conectado',
          variant: 'default' as const,
          color: 'bg-success text-success-foreground'
        };
      case 'connecting':
        return {
          icon: <Clock className="h-4 w-4 animate-spin" />,
          label: 'Conectando',
          variant: 'secondary' as const,
          color: 'bg-warning text-warning-foreground'
        };
      case 'qr_ready':
        return {
          icon: <Zap className="h-4 w-4" />,
          label: 'QR Pronto',
          variant: 'secondary' as const,
          color: 'bg-primary text-primary-foreground'
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          label: 'Erro',
          variant: 'destructive' as const,
          color: 'bg-destructive text-destructive-foreground'
        };
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          label: 'Desconectado',
          variant: 'outline' as const,
          color: 'bg-muted text-muted-foreground'
        };
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'premium': return 'text-yellow-500';
      case 'enterprise': return 'text-purple-500';
      default: return 'text-blue-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Cliente não encontrado. Verifique se o ID está correto.
        </AlertDescription>
      </Alert>
    );
  }

  const usagePercentage = (client.current_instances / client.max_instances) * 100;
  const connectedInstances = instances.filter(i => getInstanceStatus(i.instance_id)?.status === 'connected').length;
  const qrReadyInstances = instances.filter(i => getInstanceStatus(i.instance_id)?.status === 'qr_ready').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Info do Cliente */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className={`h-5 w-5 ${getPlanColor(client.plan)}`} />
                {client.name}
              </CardTitle>
              <CardDescription className="text-sm">
                Plano {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)} • {client.email}
              </CardDescription>
            </div>
            <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Instâncias Utilizadas</span>
                <span className="font-medium">
                  {client.current_instances}/{client.max_instances}
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-success">{connectedInstances}</div>
                <div className="text-sm text-muted-foreground">Conectadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{qrReadyInstances}</div>
                <div className="text-sm text-muted-foreground">QR Pronto</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {instances.length - connectedInstances - qrReadyInstances}
                </div>
                <div className="text-sm text-muted-foreground">Desconectadas</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Criar Nova Instância */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Minhas Conexões WhatsApp</h2>
        <Button 
          onClick={handleCreateInstance}
          disabled={!canCreateNewInstance() || creating}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Criando...' : 'Nova Conexão'}
        </Button>
      </div>

      {/* Limite Atingido */}
      {!canCreateNewInstance() && (
        <Alert>
          <Crown className="h-4 w-4" />
          <AlertDescription>
            Você atingiu o limite de {client.max_instances} instâncias do seu plano {client.plan}.
            Faça upgrade para criar mais conexões.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Instâncias */}
      {instances.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Nenhuma conexão WhatsApp</h3>
                <p className="text-sm text-muted-foreground">
                  Crie sua primeira conexão para começar a usar o sistema
                </p>
              </div>
              <Button onClick={handleCreateInstance} disabled={creating} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primera Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {instances.map((instance) => {
            const managerInstance = getInstanceStatus(instance.instance_id);
            const status = managerInstance?.status || instance.status || 'disconnected';
            const statusInfo = getStatusInfo(status);
            const isEditing = editingId === instance.instance_id;
            const isConnected = status === 'connected';

            return (
              <Card key={instance.id} className="hover-scale transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nome da instância"
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleEditName(instance.instance_id)}
                            disabled={!newName.trim()}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setNewName('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {instance.custom_name || `Instância ${instance.instance_id.slice(-4)}`}
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(instance.instance_id);
                              setNewName(instance.custom_name || '');
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Badge 
                      variant={statusInfo.variant}
                      className={`${statusInfo.color} gap-1`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    ID: {instance.instance_id} • {instance.phone_number || 'Não conectado'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* QR Code */}
                  {status === 'qr_ready' && managerInstance?.qrCode && (
                    <div className="text-center space-y-2">
                      <QRCodeDisplay 
                        qrCode={managerInstance.qrCode} 
                        instanceName={instance.custom_name || `Instância ${instance.instance_id.slice(-4)}`}
                        showInstructions={false}
                      />
                      <p className="text-xs text-muted-foreground">
                        Escaneie o QR Code com seu WhatsApp
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2">
                    {status === 'disconnected' && (
                      <Button
                        size="sm"
                        onClick={() => connectInstance(instance.instance_id)}
                        disabled={isInstanceLoading(instance.instance_id)}
                        className="flex-1 gap-2"
                      >
                        <Wifi className="h-4 w-4" />
                        {isInstanceLoading(instance.instance_id) ? 'Conectando...' : 'Conectar'}
                      </Button>
                    )}

                    {(status === 'connected' || status === 'qr_ready') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectInstance(instance.instance_id)}
                        disabled={isInstanceLoading(instance.instance_id)}
                        className="flex-1 gap-2"
                      >
                        <WifiOff className="h-4 w-4" />
                        Desconectar
                      </Button>
                    )}

                    {isConnected && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/client/${clientId}/chat`)}
                        className="flex-1 gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Chat
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/client/${clientId}/queues`)}
                      className="gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Filas
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteInstance(instance.instance_id)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnectionManager;