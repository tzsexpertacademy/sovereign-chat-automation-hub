
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle, User, RefreshCw, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";

interface InstanceCreationFormProps {
  clients: ClientData[];
  onInstanceCreated: () => void;
  systemHealth: {
    serverOnline: boolean;
    corsEnabled: boolean;
    httpsEnabled: boolean;
    issues: string[];
  };
}

const InstanceCreationForm = ({ clients, onInstanceCreated, systemHealth }: InstanceCreationFormProps) => {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  // Filter clients that can create new instances
  const availableClients = clients.filter(client => {
    const hasSpace = client.current_instances < client.max_instances;
    const noActiveInstance = !client.instance_id || client.instance_status === 'disconnected';
    return hasSpace || noActiveInstance;
  });

  const handleCreateInstance = async () => {
    if (!selectedClientId) {
      toast({
        title: "Erro",
        description: "Selecione um cliente para criar a instância",
        variant: "destructive",
      });
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      console.log('🚀 Criando instância para cliente:', selectedClient.name);

      // Check for existing instances first
      const existingInstances = await whatsappInstancesService.getInstancesByClientId(selectedClient.id);
      const activeInstance = existingInstances.find(inst => inst.status !== 'disconnected');

      if (activeInstance) {
        console.log('📱 Reativando instância existente:', activeInstance.instance_id);
        
        // Try to reconnect existing instance
        try {
          await whatsappService.connectClient(activeInstance.instance_id);
          await whatsappInstancesService.updateInstanceById(activeInstance.id, {
            status: 'connecting'
          });
          
          toast({
            title: "Instância Reativada",
            description: `Reconectando instância existente para ${selectedClient.name}`,
          });
        } catch (serverError: any) {
          if (serverError.message.includes('CORS')) {
            console.warn('⚠️ CORS Error - Instância salva no BD mas servidor precisa de configuração CORS');
            await whatsappInstancesService.updateInstanceById(activeInstance.id, {
              status: 'connecting'
            });
            
            toast({
              title: "⚠️ CORS Error Detectado",
              description: "Instância preparada. Configure CORS no servidor HTTPS para ativar conexão.",
              variant: "destructive",
            });
          } else {
            throw serverError;
          }
        }
      } else {
        // Create new instance
        const instanceId = selectedClient.id; // Use client ID as instance ID
        
        console.log('✨ Criando nova instância:', instanceId);

        // Create in database first (robust approach)
        const newInstance = await whatsappInstancesService.createInstance({
          client_id: selectedClient.id,
          instance_id: instanceId,
          status: 'connecting',
          custom_name: `Instância ${selectedClient.name}`
        });

        console.log('✅ Instância criada no BD:', newInstance);

        // Try to create on server (with CORS handling)
        if (systemHealth.serverOnline) {
          try {
            await whatsappService.connectClient(instanceId);
            console.log('✅ Instância conectada no servidor');
            
            toast({
              title: "Instância Criada",
              description: `Instância ${selectedClient.name} criada e conectando...`,
            });
          } catch (serverError: any) {
            if (serverError.message.includes('CORS')) {
              console.warn('⚠️ CORS Error - Instância salva no BD mas servidor precisa de configuração CORS');
              
              toast({
                title: "⚠️ CORS Error Detectado",
                description: "Instância criada no banco. Configure CORS no servidor HTTPS para ativar.",
                variant: "destructive",
              });
            } else {
              console.warn('⚠️ Erro no servidor, mas instância salva no BD:', serverError.message);
              toast({
                title: "Instância Preparada",
                description: "Instância criada no banco. Conectará quando servidor estiver disponível.",
              });
            }
          }
        } else {
          toast({
            title: "Instância Preparada",
            description: "Instância criada no banco. Servidor está offline.",
          });
        }

        // Update client info
        await clientsService.updateClientInstance(selectedClient.id, instanceId, 'connecting');
      }

      setSelectedClientId("");
      onInstanceCreated();

    } catch (error: any) {
      console.error('❌ Erro ao criar instância:', error);
      
      toast({
        title: "Erro Crítico",
        description: error.message || "Falha ao criar instância",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Criar Nova Instância WhatsApp</span>
        </CardTitle>
        <CardDescription>
          Sistema detecta automaticamente problemas de CORS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* CORS Error Warning */}
        {systemHealth.serverOnline && !systemHealth.corsEnabled && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🚫 CORS Error Detectado</p>
                <p className="text-sm">
                  O servidor HTTPS está online mas não está configurado para aceitar requisições do Lovable.
                </p>
                <div className="text-xs bg-red-50 p-2 rounded border">
                  <p><strong>Solução:</strong> Configure CORS no servidor Node.js:</p>
                  <code className="text-xs">
                    app.use(cors(&#123; origin: '*', credentials: false &#125;))
                  </code>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Server Offline Warning */}
        {!systemHealth.serverOnline && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">⚠️ Servidor WhatsApp Offline</p>
              <p className="text-sm">
                A instância será criada no banco de dados e conectará automaticamente quando o servidor estiver online.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Client Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cliente:</label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              {availableClients.length === 0 ? (
                <SelectItem value="no-clients" disabled>
                  Nenhum cliente disponível
                </SelectItem>
              ) : (
                availableClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{client.name}</span>
                      <span className="text-xs text-gray-500">
                        ({client.current_instances}/{client.max_instances} instâncias)
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Create Button */}
        <Button 
          onClick={handleCreateInstance}
          disabled={creating || !selectedClientId || availableClients.length === 0}
          className="w-full"
        >
          {creating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Criando Instância...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Criar Instância WhatsApp
            </>
          )}
        </Button>

        {/* Status Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Instâncias são criadas no banco de dados primeiro</p>
          <p>• Sistema detecta automaticamente problemas de CORS</p>
          <p>• Funciona mesmo com servidor offline ou mal configurado</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default InstanceCreationForm;
