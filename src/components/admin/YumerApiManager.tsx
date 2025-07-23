
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Server, 
  Database, 
  Globe,
  MessageSquare,
  Settings,
  Plus,
  Trash2,
  Power,
  PowerOff
} from "lucide-react";
import YumerV2Diagnostic from "./YumerV2Diagnostic";
import { yumerApiV2Service, YumerV2Instance, YumerV2Business } from "@/services/yumerApiV2Service";
import { useToast } from "@/hooks/use-toast";

const YumerApiManager = () => {
  const [instances, setInstances] = useState<YumerV2Instance[]>([]);
  const [businesses, setBusinesses] = useState<YumerV2Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const { toast } = useToast();

  // Form states
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newBusiness, setNewBusiness] = useState({
    name: "",
    email: "",
    phone: "",
    description: ""
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadServerHealth(),
        loadInstances(),
        loadBusinesses()
      ]);
    } catch (error) {
      console.error('❌ [YUMER-MANAGER] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServerHealth = async () => {
    try {
      const result = await yumerApiV2Service.getHealth();
      if (result.success) {
        setServerHealth(result.data);
        console.log('✅ [YUMER-MANAGER] Server health:', result.data);
      }
    } catch (error) {
      console.error('❌ [YUMER-MANAGER] Erro ao verificar saúde do servidor:', error);
    }
  };

  const loadInstances = async () => {
    try {
      const result = await yumerApiV2Service.listInstances();
      if (result.success && result.data) {
        setInstances(result.data);
        console.log('✅ [YUMER-MANAGER] Instâncias carregadas:', result.data.length);
      } else {
        console.warn('⚠️ [YUMER-MANAGER] Falha ao carregar instâncias:', result.error);
      }
    } catch (error) {
      console.error('❌ [YUMER-MANAGER] Erro ao carregar instâncias:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      const result = await yumerApiV2Service.listBusinesses();
      if (result.success && result.data) {
        setBusinesses(result.data);
        console.log('✅ [YUMER-MANAGER] Businesses carregados:', result.data.length);
      } else {
        console.warn('⚠️ [YUMER-MANAGER] Falha ao carregar businesses:', result.error);
      }
    } catch (error) {
      console.error('❌ [YUMER-MANAGER] Erro ao carregar businesses:', error);
    }
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da instância é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await yumerApiV2Service.createAndConfigureInstance(newInstanceName);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: `Instância ${newInstanceName} criada com sucesso`
        });
        setNewInstanceName("");
        await loadInstances();
      } else {
        toast({
          title: "Erro",
          description: result.error || "Falha ao criar instância",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusiness.name || !newBusiness.email || !newBusiness.phone) {
      toast({
        title: "Erro",
        description: "Nome, email e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await yumerApiV2Service.createBusiness(newBusiness);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: `Business ${newBusiness.name} criado com sucesso`
        });
        setNewBusiness({ name: "", email: "", phone: "", description: "" });
        await loadBusinesses();
      } else {
        toast({
          title: "Erro",
          description: result.error || "Falha ao criar business",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceName: string) => {
    setLoading(true);
    try {
      const result = await yumerApiV2Service.connectInstance(instanceName);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: `Instância ${instanceName} conectada`
        });
        await loadInstances();
      } else {
        toast({
          title: "Erro",
          description: result.error || "Falha ao conectar instância",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectInstance = async (instanceName: string) => {
    setLoading(true);
    try {
      const result = await yumerApiV2Service.disconnectInstance(instanceName);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: `Instância ${instanceName} desconectada`
        });
        await loadInstances();
      } else {
        toast({
          title: "Erro",
          description: result.error || "Falha ao desconectar instância",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a instância ${instanceName}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await yumerApiV2Service.deleteInstance(instanceName);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: `Instância ${instanceName} deletada`
        });
        await loadInstances();
      } else {
        toast({
          title: "Erro",
          description: result.error || "Falha ao deletar instância",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      case 'close': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'connecting': return 'secondary';
      case 'close': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Server Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>Status do Servidor Yumer v2</span>
            </CardTitle>
            <Button onClick={loadServerHealth} disabled={loading} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {serverHealth ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Servidor Online</span>
              </div>
              <pre className="text-xs bg-gray-50 p-2 rounded">
                {JSON.stringify(serverHealth, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm">Status não disponível</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="diagnostic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="diagnostic">Diagnóstico</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Diagnostic Tab */}
        <TabsContent value="diagnostic">
          <YumerV2Diagnostic />
        </TabsContent>

        {/* Instances Tab */}
        <TabsContent value="instances" className="space-y-4">
          
          {/* Create Instance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>Criar Nova Instância</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    placeholder="ex: minha-empresa-whatsapp"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateInstance} disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instances List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>Instâncias ({instances.length})</span>
                </CardTitle>
                <Button onClick={loadInstances} disabled={loading} size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {instances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma instância encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((instance) => (
                    <div key={instance.instanceName} className="flex items-center justify-between p-4 border rounded">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(instance.status)}
                        <div>
                          <div className="font-medium">{instance.instanceName}</div>
                          <div className="text-sm text-gray-500">
                            Owner: {instance.owner || 'N/A'}
                          </div>
                          {instance.profilePicUrl && (
                            <img src={instance.profilePicUrl} alt="Profile" className="w-8 h-8 rounded-full mt-1" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusColor(instance.status)}>
                          {instance.status}
                        </Badge>
                        
                        {instance.status === 'close' && (
                          <Button 
                            onClick={() => handleConnectInstance(instance.instanceName)}
                            disabled={loading}
                            size="sm"
                            variant="outline"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {instance.status === 'open' && (
                          <Button 
                            onClick={() => handleDisconnectInstance(instance.instanceName)}
                            disabled={loading}
                            size="sm"
                            variant="outline"
                          >
                            <PowerOff className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button 
                          onClick={() => handleDeleteInstance(instance.instanceName)}
                          disabled={loading}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Businesses Tab */}
        <TabsContent value="businesses" className="space-y-4">
          
          {/* Create Business */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>Criar Novo Business</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Nome</Label>
                  <Input
                    id="businessName"
                    value={newBusiness.name}
                    onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <Label htmlFor="businessEmail">Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={newBusiness.email}
                    onChange={(e) => setNewBusiness(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="businessPhone">Telefone</Label>
                  <Input
                    id="businessPhone"
                    value={newBusiness.phone}
                    onChange={(e) => setNewBusiness(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="5511999999999"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="businessDescription">Descrição (Opcional)</Label>
                <Textarea
                  id="businessDescription"
                  value={newBusiness.description}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do negócio"
                />
              </div>
              <Button onClick={handleCreateBusiness} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Business
              </Button>
            </CardContent>
          </Card>

          {/* Businesses List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Businesses ({businesses.length})</span>
                </CardTitle>
                <Button onClick={loadBusinesses} disabled={loading} size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {businesses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum business encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {businesses.map((business) => (
                    <div key={business.businessId} className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-gray-500">
                          {business.email} • {business.phone}
                        </div>
                        {business.description && (
                          <div className="text-sm text-gray-400 mt-1">
                            {business.description}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline">
                        {business.businessId}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Configurações da API</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  As configurações da API são gerenciadas pelo <strong>serverConfigService</strong>.
                  Acesse o painel de configuração do servidor para fazer alterações.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YumerApiManager;
