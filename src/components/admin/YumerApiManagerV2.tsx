import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import yumerApiV2, { Instance, ApiKey, ConnectionState, QRCode, WebhookData } from '@/services/yumerApiV2Service';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, RefreshCw, Settings, MessageSquare, Users, Key, Webhook } from 'lucide-react';

export const YumerApiManagerV2: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('https://api.yumer.com.br');
  
  // States para diferentes seções
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  
  // Forms
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'qrcode.updated',
    'connection.update',
    'messages.upsert',
    'chats.upsert',
    'contacts.upsert'
  ]);

  useEffect(() => {
    if (apiKey) {
      yumerApiV2.setGlobalApiKey(apiKey);
      yumerApiV2.setBaseUrl(serverUrl);
    }
  }, [apiKey, serverUrl]);

  const handleTest = async (testType: string) => {
    setLoading(true);
    try {
      let result;
      
      switch (testType) {
        case 'list-keys':
          result = await yumerApiV2.listApiKeys();
          setApiKeys(result);
          break;
          
        case 'list-instances':
          result = await yumerApiV2.listInstances();
          setInstances(result);
          break;
          
        case 'connection-state':
          if (!selectedInstance) {
            toast({ title: 'Erro', description: 'Selecione uma instância', variant: 'destructive' });
            return;
          }
          result = await yumerApiV2.getConnectionState(selectedInstance);
          setConnectionState(result);
          break;
          
        case 'qr-code':
          if (!selectedInstance) {
            toast({ title: 'Erro', description: 'Selecione uma instância', variant: 'destructive' });
            return;
          }
          result = await yumerApiV2.getQRCode(selectedInstance);
          setQrCode(result.qrcode?.code || '');
          break;
      }
      
      toast({ title: 'Sucesso', description: `${testType} executado com sucesso` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast({ title: 'Erro', description: 'Digite um nome para a API Key', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      await yumerApiV2.createApiKey(newApiKeyName);
      setNewApiKeyName('');
      await handleTest('list-keys');
      toast({ title: 'Sucesso', description: 'API Key criada com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({ title: 'Erro', description: 'Digite um nome para a instância', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      await yumerApiV2.createInstance(newInstanceName);
      setNewInstanceName('');
      await handleTest('list-instances');
      toast({ title: 'Sucesso', description: 'Instância criada com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceName: string) => {
    setLoading(true);
    try {
      await yumerApiV2.connectInstance(instanceName);
      toast({ title: 'Sucesso', description: 'Comando de conexão enviado' });
      
      // Buscar QR Code após conectar
      setTimeout(() => handleTest('qr-code'), 2000);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a instância ${instanceName}?`)) return;
    
    setLoading(true);
    try {
      await yumerApiV2.deleteInstance(instanceName);
      await handleTest('list-instances');
      toast({ title: 'Sucesso', description: 'Instância deletada' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!selectedInstance || !webhookUrl) {
      toast({ title: 'Erro', description: 'Selecione uma instância e configure a URL do webhook', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      await yumerApiV2.setWebhook(selectedInstance, {
        enabled: true,
        url: webhookUrl,
        events: webhookEvents,
        webhook_by_events: true,
        webhook_base64: false
      });
      toast({ title: 'Sucesso', description: 'Webhook configurado' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'close': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            CodeChat API v2.2.1 - Manager Unificado
          </CardTitle>
          <CardDescription>
            Interface completa para gerenciar API Keys, instâncias e funcionalidades da API CodeChat v2.2.1
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="server-url">URL do Servidor</Label>
              <Input
                id="server-url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://api.yumer.com.br"
              />
            </div>
            <div>
              <Label htmlFor="api-key">API Key Global</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Sua API Key"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="api-keys" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="api-keys">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="instances">
            <Users className="h-4 w-4 mr-2" />
            Instâncias
          </TabsTrigger>
          <TabsTrigger value="connection">
            <RefreshCw className="h-4 w-4 mr-2" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="webhook">
            <Webhook className="h-4 w-4 mr-2" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Mensagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar API Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                  placeholder="Nome da nova API Key"
                />
                <Button onClick={handleCreateApiKey} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Criar
                </Button>
              </div>
              
              <Button onClick={() => handleTest('list-keys')} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Listar API Keys
              </Button>
              
              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">API Keys Cadastradas:</h4>
                  {apiKeys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span>{key.name}</span>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{key.key}</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Instâncias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Nome da nova instância"
                />
                <Button onClick={handleCreateInstance} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Criar
                </Button>
              </div>
              
              <Button onClick={() => handleTest('list-instances')} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Listar Instâncias
              </Button>
              
              {instances.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Instâncias:</h4>
                  {instances.map((instance, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <p className="font-medium">{instance.instanceName}</p>
                        <p className="text-sm text-gray-600">{instance.owner}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleConnectInstance(instance.instanceName)}>
                          Conectar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteInstance(instance.instanceName)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status de Conexão e QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="instance-select">Selecionar Instância</Label>
                <select
                  id="instance-select"
                  value={selectedInstance}
                  onChange={(e) => setSelectedInstance(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Selecione uma instância</option>
                  {instances.map((instance) => (
                    <option key={instance.instanceName} value={instance.instanceName}>
                      {instance.instanceName}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => handleTest('connection-state')} disabled={!selectedInstance || loading}>
                  Verificar Status
                </Button>
                <Button onClick={() => handleTest('qr-code')} disabled={!selectedInstance || loading}>
                  Gerar QR Code
                </Button>
              </div>
              
              {connectionState && (
                <Alert>
                  <AlertDescription>
                    Status da conexão: <Badge className={getStateColor(connectionState.state)}>{connectionState.state}</Badge>
                  </AlertDescription>
                </Alert>
              )}
              
              {qrCode && (
                <div className="text-center">
                  <h4 className="font-medium mb-2">QR Code para Conexão:</h4>
                  <QRCodeDisplay qrCode={qrCode} instanceName={selectedInstance} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="webhook-url">URL do Webhook</Label>
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://sua-url.com/webhook"
                />
              </div>
              
              <div>
                <Label>Eventos para Receber</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    'qrcode.updated',
                    'connection.update',
                    'messages.upsert',
                    'messages.update',
                    'chats.upsert',
                    'contacts.upsert'
                  ].map((event) => (
                    <div key={event} className="flex items-center space-x-2">
                      <Switch
                        checked={webhookEvents.includes(event)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWebhookEvents([...webhookEvents, event]);
                          } else {
                            setWebhookEvents(webhookEvents.filter(e => e !== event));
                          }
                        }}
                      />
                      <Label className="text-sm">{event}</Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button onClick={handleSetWebhook} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                Configurar Webhook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Testar Envio de Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Funcionalidade de teste de mensagens será implementada aqui.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};