import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  WifiOff
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clientsService, ClientData } from "@/services/clientsService";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { useConnectionMonitor } from "@/hooks/useConnectionMonitor";

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
  const [connecting, setConnecting] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [editingInstance, setEditingInstance] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{instanceId: string, qrCode: string} | null>(null);

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
      });
    }
  };

  const handleReconnectInstance = async (instanceId: string) => {
    const success = await reconnectInstance(instanceId);
    
    if (success) {
      toast({
        title: "Reconectando",
        description: "Instância sendo reconectada. Aguarde o QR Code...",
      });
    } else {
      toast({
        title: "Erro",
        description: "Falha ao reconectar instância",
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
                      variant="outline"
                      className="border-blue-300"
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      Ver QR Code
                    </Button>
                  )}
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
                        A conexão com o WhatsApp foi perdida. Clique em "Reconectar" para restabelecer.
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
                      variant="outline"
                      className="border-blue-300"
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      Ver QR Code
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WhatsAppConnection;
