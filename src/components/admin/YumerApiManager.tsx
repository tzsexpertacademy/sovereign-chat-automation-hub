
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useYumerApi } from '@/hooks/useYumerApi';
import { Building2, MessageSquare, Webhook, Settings, Users, Phone } from 'lucide-react';

export const YumerApiManager = () => {
  const {
    loading,
    error,
    admin,
    business,
    instance,
    webhook,
    message,
    chat
  } = useYumerApi();

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);

  // Estados para formulários
  const [businessForm, setBusinessForm] = useState({
    name: '',
    attributes: {}
  });

  const [instanceForm, setInstanceForm] = useState({
    instanceName: '',
    externalId: ''
  });

  const [messageForm, setMessageForm] = useState({
    number: '',
    text: ''
  });

  const [webhookForm, setWebhookForm] = useState({
    enabled: true,
    url: '',
    events: {
      qrcodeUpdated: true,
      messagesUpsert: true,
      messagesUpdated: true,
      sendMessage: true,
      contactsUpsert: true,
      chatsUpsert: true,
      connectionUpdated: true,
      statusInstance: true
    }
  });

  // Carregar businesses na inicialização
  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const result = await admin.getAllBusinesses();
      setBusinesses(result);
    } catch (error) {
      console.error('Erro ao carregar businesses:', error);
    }
  };

  const handleCreateBusiness = async () => {
    if (!businessForm.name.trim()) return;

    try {
      await admin.createBusiness({
        name: businessForm.name,
        attributes: businessForm.attributes
      });
      
      setBusinessForm({ name: '', attributes: {} });
      await loadBusinesses();
    } catch (error) {
      console.error('Erro ao criar business:', error);
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedBusiness || !instanceForm.instanceName.trim()) return;

    try {
      await business.createInstance(
        selectedBusiness.businessId,
        {
          instanceName: instanceForm.instanceName,
          externalId: instanceForm.externalId || undefined
        },
        selectedBusiness.businessToken
      );
      
      setInstanceForm({ instanceName: '', externalId: '' });
      // Recarregar instâncias conectadas
      await loadConnectedInstances(selectedBusiness);
    } catch (error) {
      console.error('Erro ao criar instância:', error);
    }
  };

  const loadConnectedInstances = async (business: any) => {
    try {
      const result = await business.getConnectedInstances(business.businessId, business.businessToken);
      setSelectedBusiness({ ...business, instances: result.Instances || [] });
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const handleConnectInstance = async (instance: any) => {
    try {
      const qrResult = await instance.getQRCode(instance.instanceId, instance.Auth.jwt);
      console.log('QR Code:', qrResult);
      setSelectedInstance({ ...instance, qrCode: qrResult.base64 });
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedInstance || !messageForm.number || !messageForm.text) return;

    try {
      await message.sendText(
        selectedInstance.instanceId,
        {
          number: messageForm.number,
          textMessage: { text: messageForm.text }
        },
        selectedInstance.Auth.jwt
      );
      
      setMessageForm({ number: '', text: '' });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleSetWebhook = async () => {
    if (!selectedInstance) return;

    try {
      await webhook.set(
        selectedInstance.instanceId,
        webhookForm,
        selectedInstance.Auth.jwt
      );
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Yumer API Manager</h1>
        {loading && <Badge variant="secondary">Carregando...</Badge>}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="businesses" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="businesses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Criar Business */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Criar Business</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="businessName">Nome do Business</Label>
                  <Input
                    id="businessName"
                    placeholder="Ex: Minha Empresa"
                    value={businessForm.name}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={handleCreateBusiness}
                  disabled={loading || !businessForm.name.trim()}
                  className="w-full"
                >
                  Criar Business
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Businesses */}
            <Card>
              <CardHeader>
                <CardTitle>Businesses Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {businesses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum business encontrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {businesses.map((biz) => (
                        <div
                          key={biz.businessId}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedBusiness?.businessId === biz.businessId
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedBusiness(biz);
                            loadConnectedInstances(biz);
                          }}
                        >
                          <div className="font-medium">{biz.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {biz.businessId.substring(0, 8)}...
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(biz.createdAt).toLocaleDateString()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          {selectedBusiness ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Criar Instância */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Phone className="h-5 w-5" />
                    <span>Criar Instância</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Business Selecionado</Label>
                    <p className="text-sm text-muted-foreground">{selectedBusiness.name}</p>
                  </div>
                  <div>
                    <Label htmlFor="instanceName">Nome da Instância</Label>
                    <Input
                      id="instanceName"
                      placeholder="Ex: WhatsApp Principal"
                      value={instanceForm.instanceName}
                      onChange={(e) => setInstanceForm(prev => ({ ...prev, instanceName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="externalId">ID Externo (Opcional)</Label>
                    <Input
                      id="externalId"
                      placeholder="Ex: sistema_123"
                      value={instanceForm.externalId}
                      onChange={(e) => setInstanceForm(prev => ({ ...prev, externalId: e.target.value }))}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateInstance}
                    disabled={loading || !instanceForm.instanceName.trim()}
                    className="w-full"
                  >
                    Criar Instância
                  </Button>
                </CardContent>
              </Card>

              {/* Lista de Instâncias */}
              <Card>
                <CardHeader>
                  <CardTitle>Instâncias do Business</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {!selectedBusiness.instances || selectedBusiness.instances.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhuma instância encontrada
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedBusiness.instances.map((inst: any) => (
                          <div
                            key={inst.instanceId}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedInstance?.instanceId === inst.instanceId
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedInstance(inst)}
                          >
                            <div className="font-medium">{inst.name}</div>
                            <div className="text-sm text-muted-foreground">
                              ID: {inst.instanceId.substring(0, 8)}...
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant={inst.state === 'active' ? 'default' : 'secondary'}>
                                {inst.state}
                              </Badge>
                              <Badge variant={inst.connection === 'open' ? 'default' : 'destructive'}>
                                {inst.connection}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConnectInstance(inst);
                              }}
                            >
                              Obter QR Code
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* QR Code */}
              {selectedInstance?.qrCode && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>QR Code - {selectedInstance.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <img
                      src={selectedInstance.qrCode}
                      alt="QR Code"
                      className="mx-auto max-w-xs border rounded-lg"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Escaneie este QR Code no WhatsApp para conectar a instância
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Selecione um business na aba anterior para gerenciar suas instâncias
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          {selectedInstance ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Enviar Mensagem</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Instância Selecionada</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstance.name}</p>
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="Ex: 5511999999999"
                    value={messageForm.number}
                    onChange={(e) => setMessageForm(prev => ({ ...prev, number: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="messageText">Mensagem</Label>
                  <textarea
                    id="messageText"
                    className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                    placeholder="Digite sua mensagem aqui..."
                    value={messageForm.text}
                    onChange={(e) => setMessageForm(prev => ({ ...prev, text: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={handleSendMessage}
                  disabled={loading || !messageForm.number || !messageForm.text}
                  className="w-full"
                >
                  Enviar Mensagem
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Selecione uma instância para enviar mensagens
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          {selectedInstance ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Webhook className="h-5 w-5" />
                  <span>Configurar Webhook</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Instância Selecionada</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstance.name}</p>
                </div>
                <div>
                  <Label htmlFor="webhookUrl">URL do Webhook</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://seu-site.com/webhook"
                    value={webhookForm.url}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Eventos</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(webhookForm.events).map(([event, enabled]) => (
                      <label key={event} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setWebhookForm(prev => ({
                            ...prev,
                            events: {
                              ...prev.events,
                              [event]: e.target.checked
                            }
                          }))}
                        />
                        <span className="text-sm">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={handleSetWebhook}
                  disabled={loading || !webhookForm.url}
                  className="w-full"
                >
                  Configurar Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Selecione uma instância para configurar webhooks
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
