import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Settings, 
  Building2,
  Phone,
  Mail,
  Calendar,
  Activity,
  RefreshCw,
  Trash2,
  Edit,
  Globe,
  Users,
  Zap,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  Server,
  Database,
  MoreVertical,
  Power,
  PowerOff,
  RotateCw,
  MoveHorizontal,
  RotateCw as Sync
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { businessService, BusinessData, InstanceData } from "@/services/businessService";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const BusinessManagement = () => {
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [newBusiness, setNewBusiness] = useState({
    name: "",
    attributes: "{}"
  });
  const [businessToDelete, setBusinessToDelete] = useState<string | null>(null);
  const [syncingBusinesses, setSyncingBusinesses] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const businessesData = await businessService.getAllBusinesses();
      setBusinesses(businessesData);
      console.log('Businesses carregados:', businessesData);
    } catch (error) {
      console.error('Erro ao carregar businesses:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar businesses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusiness.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      let attributes = {};
      try {
        attributes = JSON.parse(newBusiness.attributes || "{}");
      } catch {
        toast({
          title: "Erro",
          description: "Formato JSON inválido nos atributos",
          variant: "destructive",
        });
        return;
      }

      await businessService.createBusiness({
        name: newBusiness.name.trim(),
        attributes
      });

      toast({
        title: "Sucesso",
        description: `Business ${newBusiness.name} criado com sucesso!`,
      });

      setNewBusiness({ name: "", attributes: "{}" });
      setShowCreateForm(false);
      await loadBusinesses();

    } catch (error: any) {
      console.error("Erro ao criar business:", error);
      toast({
        title: "Erro ao Criar Business",
        description: error.message || "Falha ao criar business",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    try {
      await businessService.deleteBusiness(businessId);
      
      toast({
        title: "Business Removido",
        description: "Business foi removido com sucesso",
      });
      
      setBusinessToDelete(null);
      await loadBusinesses();
    } catch (error: any) {
      console.error("Erro ao deletar business:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover business",
        variant: "destructive",
      });
    }
  };

  const handleSyncBusinesses = async () => {
    setSyncingBusinesses(true);
    try {
      await businessService.syncBusinessesWithClients();
      toast({
        title: "Sincronização concluída",
        description: "Businesses foram sincronizados com os clientes.",
      });
      loadBusinesses();
    } catch (error: any) {
      console.error('Erro ao sincronizar businesses:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha na sincronização. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSyncingBusinesses(false);
    }
  };

  const handleDeleteInstance = async (businessId: string, instanceId: string) => {
    try {
      setLoading(true);
      
      await businessService.deleteInstance(businessId, instanceId);
      
      toast({
        title: "Instância Removida",
        description: "Instância foi removida com sucesso",
      });
      
      await loadBusinesses();
    } catch (error: any) {
      console.error("Erro ao deletar instância:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async (businessId: string) => {
    try {
      setLoading(true);
      
      // Buscar token atual do business
      const business = businesses.find(b => b.businessId === businessId);
      if (!business) {
        throw new Error("Business não encontrado");
      }
      
      const result = await businessService.refreshBusinessToken(businessId, business.businessToken);
      
      toast({
        title: "Token Atualizado",
        description: `Novo token: ${result.newToken.slice(0, 16)}...`,
      });
      
      await loadBusinesses();
    } catch (error: any) {
      console.error("Erro ao fazer refresh do token:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao fazer refresh do token",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInstance = async (businessId: string, instanceId: string, currentState: string) => {
    try {
      const action = currentState === 'active' ? 'deactivate' : 'activate';
      
      await businessService.toggleInstanceActivation(businessId, instanceId, action);
      
      toast({
        title: "Status Alterado",
        description: `Instância ${action === 'activate' ? 'ativada' : 'desativada'} com sucesso`,
      });
      
      await loadBusinesses();
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao alterar status da instância",
        variant: "destructive",
      });
    }
  };

  const filteredBusinesses = businesses.filter(business =>
    business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.businessId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInstances = businesses.reduce((sum, b) => sum + (b.instances || 0), 0);
  const connectedInstances = businesses.reduce((sum, b) => sum + (b.connectedInstances || 0), 0);
  const activeWebhooks = businesses.filter(b => b.BusinessWebhook?.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Businesses</h1>
          <p className="text-gray-600">Gerencie businesses e suas instâncias na API Yumer</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadBusinesses} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleSyncBusinesses}
            variant="outline"
            disabled={syncingBusinesses}
          >
            <Sync className={`w-4 h-4 mr-2 ${syncingBusinesses ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Business
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businesses.length}</div>
            <p className="text-xs text-gray-500">Businesses ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Instâncias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalInstances}</div>
            <p className="text-xs text-blue-600">Instâncias criadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{connectedInstances}</div>
            <p className="text-xs text-green-600">Instâncias online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Webhooks Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{activeWebhooks}</div>
            <p className="text-xs text-purple-600">Webhooks configurados</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar businesses por nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Create Business Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Business</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo business
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome do business"
                value={newBusiness.name}
                onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="attributes">Atributos (JSON)</Label>
              <Textarea
                id="attributes"
                placeholder='{"categoria": "vendas", "region": "BR"}'
                value={newBusiness.attributes}
                onChange={(e) => setNewBusiness(prev => ({ ...prev, attributes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBusiness} disabled={loading}>
              {loading ? "Criando..." : "Criar Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Businesses List */}
      <div className="grid gap-4">
        {filteredBusinesses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {businesses.length === 0 ? "Nenhum business criado" : "Nenhum business encontrado"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {businesses.length === 0 
                    ? "Crie seu primeiro business usando o botão 'Novo Business'"
                    : "Tente ajustar os termos de busca"
                  }
                </p>
                {businesses.length === 0 && (
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Business
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredBusinesses.map((business) => {
            const stats = businessService.getBusinessStats(business);
            
            return (
              <Card key={business.businessId} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                         <div>
                           <h3 className="font-semibold text-lg">{business.name}</h3>
                           <div className="flex items-center space-x-4 text-sm text-gray-600">
                             <span>ID: {business.businessId.slice(0, 8)}...</span>
                             <span>Token: {business.businessToken.slice(0, 8)}...</span>
                           </div>
                           {business.attributes?.clientName && (
                             <div className="flex items-center space-x-2 mt-1">
                               <Badge variant="secondary" className="text-xs">
                                 <Users className="w-3 h-3 mr-1" />
                                 Cliente: {business.attributes.clientName}
                               </Badge>
                               {business.attributes?.clientPlan && (
                                 <Badge variant="outline" className="text-xs">
                                   Plano: {business.attributes.clientPlan.toUpperCase()}
                                 </Badge>
                               )}
                             </div>
                           )}
                         </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge variant={stats.hasWebhook ? "default" : "outline"}>
                          {stats.hasWebhook ? "Webhook Ativo" : "Sem Webhook"}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRefreshToken(business.businessId)}>
                              <RotateCw className="w-4 h-4 mr-2" />
                              Refresh Token
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setBusinessToDelete(business.businessId)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remover Business
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.totalInstances}</div>
                        <p className="text-xs text-gray-600">Instâncias</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.connectedInstances}</div>
                        <p className="text-xs text-gray-600">Conectadas</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.disconnectedInstances}</div>
                        <p className="text-xs text-gray-600">Desconectadas</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {stats.webhookEnabled ? 1 : 0}
                        </div>
                        <p className="text-xs text-gray-600">Webhooks</p>
                      </div>
                    </div>

                    {/* Instances */}
                    {business.Instance && business.Instance.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Instâncias ({business.Instance.length})</h4>
                        <div className="grid gap-2">
                          {business.Instance.slice(0, 3).map((instance) => {
                            const connectionStatus = businessService.formatConnectionStatus(instance.connection);
                            const stateStatus = businessService.formatInstanceState(instance.state);
                            
                            return (
                              <div key={instance.instanceId} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-3 h-3 rounded-full ${
                                    instance.connection === 'open' ? 'bg-green-500' : 
                                    instance.connection === 'close' ? 'bg-gray-500' : 'bg-red-500'
                                  }`} />
                                  <div>
                                    <p className="font-medium">{instance.name}</p>
                                    <div className="flex items-center space-x-2 text-sm">
                                      <Badge variant={connectionStatus.variant as any} className="text-xs">
                                        {connectionStatus.text}
                                      </Badge>
                                      <Badge variant={stateStatus.variant as any} className="text-xs">
                                        {stateStatus.text}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleInstance(business.businessId, instance.instanceId, instance.state)}
                                  >
                                    {instance.state === 'active' ? (
                                      <PowerOff className="w-3 h-3" />
                                    ) : (
                                      <Power className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteInstance(business.businessId, instance.instanceId)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                  {instance.WhatsApp?.remoteJid && (
                                    <Badge variant="outline" className="text-xs">
                                      {instance.WhatsApp.pushName || instance.WhatsApp.remoteJid}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {business.Instance.length > 3 && (
                            <div className="text-center text-sm text-gray-500 py-2">
                              +{business.Instance.length - 3} instâncias adicionais
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between items-center text-sm text-gray-500 pt-4 border-t">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Criado em {new Date(business.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-1" />
                        Atualizado em {new Date(business.updatedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={!!businessToDelete} onOpenChange={() => setBusinessToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este business? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => businessToDelete && handleDeleteBusiness(businessToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BusinessManagement;