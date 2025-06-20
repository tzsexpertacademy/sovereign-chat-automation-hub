
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Activity,
  QrCode
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useToast } from "@/hooks/use-toast";
import MultipleInstancesManager from "./MultipleInstancesManager";

const ClientInstancesOverview = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Load client data
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
      
      // Load instances
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-5 h-5 text-blue-500" />;
      case 'connecting': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Cliente não encontrado</h3>
        <Button onClick={() => navigate('/admin/clients')}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{client.name}</CardTitle>
              <CardDescription>{client.email}</CardDescription>
            </div>
            <div className="text-right">
              <Badge className="mb-2">
                Plano {client.plan.toUpperCase()}
              </Badge>
              <div className="text-sm text-gray-600">
                {client.current_instances || 0} / {client.max_instances} instâncias
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-8 h-8 text-blue-500" />
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
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {instances.filter(i => i.status === 'error' || i.status === 'disconnected').length}
                </div>
                <p className="text-sm text-gray-600">Com Problemas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multiple Instances Manager */}
      <MultipleInstancesManager 
        clientId={clientId!}
        client={client}
        onInstancesUpdate={loadClientData}
      />
    </div>
  );
};

export default ClientInstancesOverview;
