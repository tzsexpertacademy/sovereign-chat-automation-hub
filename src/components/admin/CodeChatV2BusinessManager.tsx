import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCodeChatV2Manager } from '@/hooks/useCodeChatV2Manager';
import { CreateBusinessRequest } from '@/services/codechatV2Service';
import { Plus, Building2, Smartphone, Wifi, WifiOff, Eye, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';

interface CodeChatV2BusinessManagerProps {
  clientId: string;
}

const CodeChatV2BusinessManager: React.FC<CodeChatV2BusinessManagerProps> = ({ clientId }) => {
  const { businesses, isLoading, isCreating, stats, actions } = useCodeChatV2Manager(clientId);
  const { toast } = useToast();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [qrModal, setQrModal] = useState<{ show: boolean; businessId?: string; instanceId?: string; qrCode?: string }>({ 
    show: false 
  });
  
  const [newBusiness, setNewBusiness] = useState<CreateBusinessRequest>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    country: 'BR',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    active: true
  });

  const handleCreateBusiness = async () => {
    if (!newBusiness.name || !newBusiness.slug || !newBusiness.email || !newBusiness.phone) {
      toast({
        title: "Erro",
        description: "Todos os campos obrigatórios devem ser preenchidos",
        variant: "destructive"
      });
      return;
    }

    const result = await actions.createBusiness(newBusiness);
    if (result) {
      setShowCreateDialog(false);
      setNewBusiness({
        name: '',
        slug: '',
        email: '',
        phone: '',
        country: 'BR',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        active: true
      });
    }
  };

  const handleCreateInstance = async (businessId: string) => {
    const instanceName = `inst_${Date.now()}`;
    await actions.createInstance(businessId, instanceName);
  };

  const handleConnectInstance = async (businessId: string, instanceId: string) => {
    await actions.connectInstance(businessId, instanceId);
  };

  const handleShowQRCode = async (businessId: string, instanceId: string) => {
    try {
      const qrData = await actions.getQRCode(businessId, instanceId);
      setQrModal({
        show: true,
        businessId,
        instanceId,
        qrCode: qrData.base64
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao obter QR Code",
        variant: "destructive"
      });
    }
  };

  const getConnectionStatus = (connection: string) => {
    switch (connection) {
      case 'open':
        return { icon: <Wifi className="h-4 w-4" />, color: 'bg-success', text: 'Conectado' };
      case 'connecting':
        return { icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: 'bg-warning', text: 'Conectando' };
      default:
        return { icon: <WifiOff className="h-4 w-4" />, color: 'bg-destructive', text: 'Desconectado' };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CodeChat v2.1.3 Business Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Carregando businesses...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                CodeChat v2.1.3 Business Manager
              </CardTitle>
              <CardDescription>
                Gerencie businesses e instâncias da nova API CodeChat
              </CardDescription>
            </div>
            <Button onClick={actions.loadBusinesses} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalBusinesses}</div>
              <div className="text-sm text-muted-foreground">Businesses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalInstances}</div>
              <div className="text-sm text-muted-foreground">Instâncias Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.connectedInstances}</div>
              <div className="text-sm text-muted-foreground">Conectadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{stats.disconnectedInstances}</div>
              <div className="text-sm text-muted-foreground">Desconectadas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo principal */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Businesses Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats.totalBusinesses}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Total de businesses configurados
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Instâncias Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.totalInstances}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Todas as instâncias criadas
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Instâncias Conectadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{stats.connectedInstances}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Instâncias online agora
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="businesses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Businesses</h3>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Business
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Business</DialogTitle>
                  <DialogDescription>
                    Configure um novo business para gerenciar instâncias WhatsApp
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={newBusiness.name}
                        onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                        placeholder="Nome do business"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug">Slug *</Label>
                      <Input
                        id="slug"
                        value={newBusiness.slug}
                        onChange={(e) => setNewBusiness({ ...newBusiness, slug: e.target.value })}
                        placeholder="slug-do-business"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newBusiness.email}
                        onChange={(e) => setNewBusiness({ ...newBusiness, email: e.target.value })}
                        placeholder="email@empresa.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        value={newBusiness.phone}
                        onChange={(e) => setNewBusiness({ ...newBusiness, phone: e.target.value })}
                        placeholder="+55 11 99999-9999"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateBusiness} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Business'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {businesses.map((business) => (
              <Card key={business.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{business.name}</CardTitle>
                      <CardDescription>
                        {business.email} • {business.phone}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={business.active ? "default" : "secondary"}>
                        {business.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        {business.instances.length} instância{business.instances.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Business ID: {business.businessId}
                    </div>
                    <Button 
                      onClick={() => handleCreateInstance(business.id)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Instância
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <h3 className="text-lg font-medium">Todas as Instâncias</h3>
          
          <div className="grid gap-4">
            {businesses.flatMap(business => 
              business.instances.map(instance => {
                const status = getConnectionStatus(instance.connection);
                return (
                  <Card key={instance.instanceId}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5" />
                            <div>
                              <div className="font-medium">{instance.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {business.name} • {instance.instanceId}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.text}</span>
                          </Badge>
                          
                          <div className="flex gap-1">
                            {instance.connection !== 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConnectInstance(business.id, instance.instanceId)}
                              >
                                Conectar
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShowQRCode(business.id, instance.instanceId)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => actions.deleteInstance(business.id, instance.instanceId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
      <Dialog open={qrModal.show} onOpenChange={(open) => setQrModal({ show: open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code da Instância</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com o WhatsApp para conectar a instância
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrModal.qrCode ? (
              <QRCodeDisplay 
                qrCode={qrModal.qrCode} 
                instanceName={qrModal.instanceId || 'Instância'} 
              />
            ) : (
              <div className="text-center text-muted-foreground">
                Gerando QR Code...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setQrModal({ show: false })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CodeChatV2BusinessManager;