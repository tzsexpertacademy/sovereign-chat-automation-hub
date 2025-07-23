
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Plus, 
  Smartphone, 
  QrCode,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  MessageSquare
} from "lucide-react";
import { useCodeChatV2 } from "@/hooks/useCodeChatV2";

const CodeChatV2Manager = () => {
  const {
    businesses,
    loading,
    creating,
    loadBusinesses,
    createBusiness,
    createInstance,
    connectInstance,
    getQRCode,
    deleteInstance
  } = useCodeChatV2();

  const [newBusiness, setNewBusiness] = useState({
    name: '',
    slug: '',
    email: '',
    phone: ''
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [qrModal, setQrModal] = useState<{ show: boolean; qrCode?: string; instanceId?: string }>({ show: false });

  const handleCreateBusiness = async () => {
    if (!newBusiness.name || !newBusiness.slug || !newBusiness.email || !newBusiness.phone) {
      return;
    }

    try {
      await createBusiness(newBusiness);
      setNewBusiness({ name: '', slug: '', email: '', phone: '' });
      setShowCreateDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleConnectInstance = async (businessId: string, instanceId: string) => {
    try {
      await connectInstance(businessId, instanceId);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleShowQRCode = async (businessId: string, instanceId: string) => {
    try {
      const qrData = await getQRCode(businessId, instanceId);
      setQrModal({ 
        show: true, 
        qrCode: qrData.base64 || qrData.qrCode, 
        instanceId 
      });
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
    }
  };

  const getConnectionStatus = (connection: string) => {
    switch (connection) {
      case 'open': return { color: 'bg-green-500', text: 'Conectado', icon: CheckCircle };
      case 'connecting': return { color: 'bg-yellow-500', text: 'Conectando', icon: Clock };
      case 'close': return { color: 'bg-red-500', text: 'Desconectado', icon: XCircle };
      default: return { color: 'bg-gray-500', text: 'Desconhecido', icon: XCircle };
    }
  };

  const totalInstances = businesses.reduce((total, business) => total + business.instances.length, 0);
  const connectedInstances = businesses.reduce((total, business) => 
    total + business.instances.filter(i => i.connection === 'open').length, 0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">CodeChat API v2.1.3</h1>
          <p className="text-gray-600">Gerenciamento de Businesses e Instâncias</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {businesses.length} Businesses • {totalInstances} Instâncias • {connectedInstances} Conectadas
          </Badge>
          <Button onClick={loadBusinesses} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{businesses.length}</p>
                    <p className="text-sm text-gray-600">Businesses</p>
                  </div>
                  <Building2 className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{totalInstances}</p>
                    <p className="text-sm text-gray-600">Total Instâncias</p>
                  </div>
                  <Smartphone className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{connectedInstances}</p>
                    <p className="text-sm text-gray-600">Conectadas</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="businesses" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Gerenciar Businesses</h2>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Business
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Business</DialogTitle>
                  <DialogDescription>
                    Preencha os dados para criar um novo business no CodeChat API v2.1.3
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Business</Label>
                    <Input
                      id="name"
                      value={newBusiness.name}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Minha Empresa"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">Slug (identificador único)</Label>
                    <Input
                      id="slug"
                      value={newBusiness.slug}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="Ex: minha-empresa"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newBusiness.email}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={newBusiness.phone}
                      onChange={(e) => setNewBusiness(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+55 11 99999-9999"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateBusiness}
                    disabled={creating}
                    className="w-full"
                  >
                    {creating ? 'Criando...' : 'Criar Business'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {businesses.map((business) => (
              <Card key={business.businessId}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5" />
                        <span>{business.name}</span>
                        <Badge variant={business.active ? "default" : "secondary"}>
                          {business.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {business.email} • {business.phone} • {business.instances.length} instâncias
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => createInstance(business.businessId)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nova Instância
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          <h2 className="text-xl font-semibold">Todas as Instâncias</h2>
          
          <div className="grid gap-4">
            {businesses.map((business) => 
              business.instances.map((instance) => {
                const status = getConnectionStatus(instance.connection);
                const StatusIcon = status.icon;
                
                return (
                  <Card key={instance.instanceId}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${status.color}`} />
                            <h3 className="font-semibold">{instance.name}</h3>
                            <Badge variant="outline">{business.name}</Badge>
                            <Badge variant="secondary">{status.text}</Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            ID: {instance.instanceId} • Estado: {instance.state}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          {instance.connection === 'open' ? (
                            <Button size="sm" variant="outline">
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                          ) : (
                            <>
                              <Button 
                                size="sm"
                                onClick={() => handleConnectInstance(business.businessId, instance.instanceId)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Conectar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleShowQRCode(business.businessId, instance.instanceId)}
                              >
                                <QrCode className="w-4 h-4 mr-1" />
                                QR Code
                              </Button>
                            </>
                          )}
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deleteInstance(business.businessId, instance.instanceId)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Modal */}
      {qrModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - {qrModal.instanceId}
              </h3>
              
              {qrModal.qrCode ? (
                <div className="space-y-4">
                  <img 
                    src={qrModal.qrCode} 
                    alt="QR Code WhatsApp"
                    className="mx-auto border rounded max-w-[250px]"
                  />
                  <p className="text-sm text-gray-600">
                    Escaneie este QR Code com seu WhatsApp para conectar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">QR Code não disponível</p>
                </div>
              )}
              
              <Button 
                onClick={() => setQrModal({ show: false })}
                className="mt-4"
                variant="outline"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeChatV2Manager;
