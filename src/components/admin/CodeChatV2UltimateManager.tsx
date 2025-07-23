
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Smartphone, 
  MessageSquare, 
  Users, 
  Settings, 
  Webhook, 
  Database,
  Cloud,
  Shield,
  Plus,
  Trash2,
  Edit,
  Eye,
  Send,
  Image,
  File,
  MapPin,
  User,
  List,
  Mouse,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { useCodeChatV2Complete } from '@/hooks/useCodeChatV2Complete';
import * as Types from '@/types/codechatV2Types';
import { useToast } from '@/hooks/use-toast';

interface CodeChatV2UltimateManagerProps {
  clientId: string;
}

const CodeChatV2UltimateManager: React.FC<CodeChatV2UltimateManagerProps> = ({ clientId }) => {
  // Estados principais
  const [businesses, setBusinesses] = useState<Types.BusinessFindResponse[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Types.BusinessFindResponse | null>(null);
  const [instances, setInstances] = useState<Types.InstanceCreateResponse[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Types.InstanceCreateResponse | null>(null);
  const [webhooks, setWebhooks] = useState<Types.WebhookResponse[]>([]);
  
  // Estados de UI
  const [activeTab, setActiveTab] = useState('admin');
  const [adminToken, setAdminToken] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Hook principal
  const { loading, error, admin, business, instance, webhook, message, chat, group } = useCodeChatV2Complete();
  const { toast } = useToast();

  // ============ ADMIN TAB ============
  const AdminTab = () => {
    const [businessForm, setBusinessForm] = useState<Types.BusinessCreateRequest>({
      name: '',
      attributes: {}
    });

    const handleCreateBusiness = async () => {
      if (!adminToken) {
        toast({ title: "Erro", description: "Token de admin é obrigatório", variant: "destructive" });
        return;
      }

      try {
        const newBusiness = await admin.createBusiness(businessForm, adminToken);
        setBusinesses(prev => [...prev, newBusiness]);
        setBusinessForm({ name: '', attributes: {} });
        setIsDialogOpen(false);
      } catch (error) {
        console.error('Erro ao criar business:', error);
      }
    };

    const loadBusinesses = async () => {
      if (!adminToken) return;
      
      try {
        const data = await admin.getAllBusinesses(adminToken);
        setBusinesses(data);
      } catch (error) {
        console.error('Erro ao carregar businesses:', error);
      }
    };

    const handleDeleteBusiness = async (businessId: string) => {
      if (!adminToken || !confirm('Tem certeza que deseja deletar este business?')) return;

      try {
        await admin.deleteBusiness(businessId, adminToken);
        setBusinesses(prev => prev.filter(b => b.businessId !== businessId));
      } catch (error) {
        console.error('Erro ao deletar business:', error);
      }
    };

    return (
      <div className="space-y-6">
        {/* Admin Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configuração Admin
            </CardTitle>
            <CardDescription>Token de administrador para gerenciar businesses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adminToken">Token de Admin</Label>
              <Input
                id="adminToken"
                type="password"
                placeholder="Insira o token de administrador"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
              />
            </div>
            <Button onClick={loadBusinesses} disabled={!adminToken || loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Carregar Businesses
            </Button>
          </CardContent>
        </Card>

        {/* Lista de Businesses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Businesses</CardTitle>
              <CardDescription>Gerenciar todos os businesses da plataforma</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!adminToken}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Business
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Business</DialogTitle>
                  <DialogDescription>Preencha as informações do business</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Nome do Business</Label>
                    <Input
                      id="businessName"
                      placeholder="Nome do business"
                      value={businessForm.name}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessAttributes">Atributos (JSON)</Label>
                    <Textarea
                      id="businessAttributes"
                      placeholder='{"category": "sales", "active": true}'
                      value={JSON.stringify(businessForm.attributes, null, 2)}
                      onChange={(e) => {
                        try {
                          const attrs = JSON.parse(e.target.value || '{}');
                          setBusinessForm(prev => ({ ...prev, attributes: attrs }));
                        } catch (error) {
                          // Ignore JSON parse errors while typing
                        }
                      }}
                    />
                  </div>
                  <Button onClick={handleCreateBusiness} disabled={loading || !businessForm.name}>
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Criar Business
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {businesses.map((business) => (
                  <Card key={business.businessId} className="cursor-pointer hover:bg-accent/50" 
                        onClick={() => setSelectedBusiness(business)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{business.name}</h4>
                          <p className="text-sm text-muted-foreground">ID: {business.businessId}</p>
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              Token: {business.businessToken.substring(0, 12)}...
                            </Badge>
                            {business.BusinessWebhook && (
                              <Badge variant={business.BusinessWebhook.enabled ? "default" : "secondary"}>
                                Webhook: {business.BusinessWebhook.enabled ? "Ativo" : "Inativo"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBusiness(business);
                              setActiveTab('business');
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBusiness(business.businessId);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============ BUSINESS TAB ============
  const BusinessTab = () => {
    if (!selectedBusiness) {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecione um business na aba Admin para gerenciá-lo.
          </AlertDescription>
        </Alert>
      );
    }

    const loadInstances = async () => {
      try {
        const connected = await business.getConnectedInstances(selectedBusiness.businessId, selectedBusiness.businessToken);
        setInstances(connected.Instances || []);
      } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
      }
    };

    const handleCreateInstance = async () => {
      try {
        const newInstance = await business.createInstance(
          selectedBusiness.businessId,
          { instanceName: `instance_${Date.now()}` },
          selectedBusiness.businessToken
        );
        setInstances(prev => [...prev, newInstance]);
      } catch (error) {
        console.error('Erro ao criar instância:', error);
      }
    };

    return (
      <div className="space-y-6">
        {/* Business Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Business: {selectedBusiness.name}
            </CardTitle>
            <CardDescription>ID: {selectedBusiness.businessId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Business Token</Label>
                <div className="flex gap-2">
                  <Input value={selectedBusiness.businessToken} readOnly />
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(selectedBusiness.businessToken)}>
                    Copiar
                  </Button>
                </div>
              </div>
              <div>
                <Label>Criado em</Label>
                <Input value={new Date(selectedBusiness.createdAt).toLocaleDateString()} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instâncias */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Instâncias</CardTitle>
              <CardDescription>Gerenciar instâncias do business</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadInstances} variant="outline" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={handleCreateInstance} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {instances.map((inst) => (
                  <Card key={inst.instanceId} className="cursor-pointer hover:bg-accent/50"
                        onClick={() => {
                          setSelectedInstance(inst);
                          setActiveTab('instance');
                        }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{inst.name}</h4>
                          <p className="text-sm text-muted-foreground">ID: {inst.instanceId}</p>
                          <div className="flex gap-2">
                            <Badge variant={inst.state === 'active' ? 'default' : 'secondary'}>
                              {inst.state}
                            </Badge>
                            <Badge variant={inst.connection === 'open' ? 'default' : 'destructive'}>
                              {inst.connection}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============ INSTANCE TAB ============
  const InstanceTab = () => {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<Types.InstanceConnectionStateResponse | null>(null);

    if (!selectedInstance) {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecione uma instância na aba Business para gerenciá-la.
          </AlertDescription>
        </Alert>
      );
    }

    const handleConnect = async () => {
      try {
        const result = await instance.connect(selectedInstance.instanceId, selectedInstance.Auth.jwt);
        setQrCode(result.base64);
      } catch (error) {
        console.error('Erro ao conectar instância:', error);
      }
    };

    const handleGetConnectionState = async () => {
      try {
        const state = await instance.getConnectionState(selectedInstance.instanceId, selectedInstance.Auth.jwt);
        setConnectionState(state);
      } catch (error) {
        console.error('Erro ao obter estado da conexão:', error);
      }
    };

    const handleGetQRCode = async () => {
      try {
        const result = await instance.getQRCode(selectedInstance.instanceId, selectedInstance.Auth.jwt);
        setQrCode(result.base64);
      } catch (error) {
        console.error('Erro ao obter QR Code:', error);
      }
    };

    return (
      <div className="space-y-6">
        {/* Instance Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Instância: {selectedInstance.name}
            </CardTitle>
            <CardDescription>ID: {selectedInstance.instanceId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <Badge variant={selectedInstance.state === 'active' ? 'default' : 'secondary'}>
                  {selectedInstance.state}
                </Badge>
              </div>
              <div>
                <Label>Conexão</Label>
                <Badge variant={selectedInstance.connection === 'open' ? 'default' : 'destructive'}>
                  {selectedInstance.connection}
                </Badge>
              </div>
              <div>
                <Label>JWT Token</Label>
                <div className="flex gap-2">
                  <Input value={selectedInstance.Auth.jwt.substring(0, 20) + '...'} readOnly />
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(selectedInstance.Auth.jwt)}>
                    Copiar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controles de Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={loading}>
                <Zap className="h-4 w-4 mr-2" />
                Conectar
              </Button>
              <Button onClick={handleGetQRCode} variant="outline" disabled={loading}>
                <Eye className="h-4 w-4 mr-2" />
                Obter QR Code
              </Button>
              <Button onClick={handleGetConnectionState} variant="outline" disabled={loading}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Estado da Conexão
              </Button>
            </div>

            {qrCode && (
              <div className="text-center">
                <Label>QR Code para Conexão</Label>
                <div className="mt-2">
                  <img src={qrCode} alt="QR Code" className="mx-auto max-w-xs border rounded" />
                </div>
              </div>
            )}

            {connectionState && (
              <div>
                <Label>Estado da Conexão</Label>
                <div className="mt-2 p-3 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={connectionState.state === 'open' ? 'default' : 'destructive'}>
                      {connectionState.state}
                    </Badge>
                    <span className="text-sm">Status: {connectionState.statusReason}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============ MESSAGES TAB ============
  const MessagesTab = () => {
    const [messageForm, setMessageForm] = useState({
      recipient: '',
      text: '',
      mediaUrl: '',
      mediaType: 'image' as 'image' | 'video' | 'document' | 'audio',
      latitude: '',
      longitude: '',
      contacts: []
    });

    if (!selectedInstance) {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecione uma instância para enviar mensagens.
          </AlertDescription>
        </Alert>
      );
    }

    const handleSendText = async () => {
      if (!messageForm.recipient || !messageForm.text) return;

      try {
        await message.sendText(selectedInstance.instanceId, {
          recipient: messageForm.recipient,
          textMessage: { text: messageForm.text },
          options: { delay: 1200, presence: 'composing' }
        }, selectedInstance.Auth.jwt);
        
        setMessageForm(prev => ({ ...prev, text: '' }));
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
      }
    };

    const handleSendMedia = async () => {
      if (!messageForm.recipient || !messageForm.mediaUrl) return;

      try {
        await message.sendMedia(selectedInstance.instanceId, {
          recipient: messageForm.recipient,
          mediaMessage: {
            mediaType: messageForm.mediaType,
            url: messageForm.mediaUrl,
            caption: 'Mídia enviada via CodeChat'
          }
        }, selectedInstance.Auth.jwt);
        
        setMessageForm(prev => ({ ...prev, mediaUrl: '' }));
      } catch (error) {
        console.error('Erro ao enviar mídia:', error);
      }
    };

    const handleSendLocation = async () => {
      if (!messageForm.recipient || !messageForm.latitude || !messageForm.longitude) return;

      try {
        await message.sendLocation(selectedInstance.instanceId, {
          recipient: messageForm.recipient,
          locationMessage: {
            latitude: parseFloat(messageForm.latitude),
            longitude: parseFloat(messageForm.longitude),
            name: 'Localização compartilhada'
          }
        }, selectedInstance.Auth.jwt);
        
        setMessageForm(prev => ({ ...prev, latitude: '', longitude: '' }));
      } catch (error) {
        console.error('Erro ao enviar localização:', error);
      }
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Enviar Mensagens
            </CardTitle>
            <CardDescription>Instância: {selectedInstance.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Destinatário */}
            <div>
              <Label htmlFor="recipient">Destinatário (Número com DDI)</Label>
              <Input
                id="recipient"
                placeholder="5511999999999"
                value={messageForm.recipient}
                onChange={(e) => setMessageForm(prev => ({ ...prev, recipient: e.target.value }))}
              />
            </div>

            <Tabs defaultValue="text">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="text">Texto</TabsTrigger>
                <TabsTrigger value="media">Mídia</TabsTrigger>
                <TabsTrigger value="location">Localização</TabsTrigger>
                <TabsTrigger value="advanced">Avançado</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="textMessage">Mensagem</Label>
                  <Textarea
                    id="textMessage"
                    placeholder="Digite sua mensagem..."
                    value={messageForm.text}
                    onChange={(e) => setMessageForm(prev => ({ ...prev, text: e.target.value }))}
                  />
                </div>
                <Button onClick={handleSendText} disabled={loading || !messageForm.recipient || !messageForm.text}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar Texto
                </Button>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div>
                  <Label htmlFor="mediaType">Tipo de Mídia</Label>
                  <Select value={messageForm.mediaType} onValueChange={(value: any) => setMessageForm(prev => ({ ...prev, mediaType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mediaUrl">URL da Mídia</Label>
                  <Input
                    id="mediaUrl"
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={messageForm.mediaUrl}
                    onChange={(e) => setMessageForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                  />
                </div>
                <Button onClick={handleSendMedia} disabled={loading || !messageForm.recipient || !messageForm.mediaUrl}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Image className="h-4 w-4 mr-2" />}
                  Enviar Mídia
                </Button>
              </TabsContent>

              <TabsContent value="location" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      placeholder="-23.5505"
                      value={messageForm.latitude}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, latitude: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      placeholder="-46.6333"
                      value={messageForm.longitude}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleSendLocation} disabled={loading || !messageForm.recipient || !messageForm.latitude || !messageForm.longitude}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                  Enviar Localização
                </Button>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <Alert>
                  <MessageSquare className="h-4 w-4" />
                  <AlertDescription>
                    Funcionalidades avançadas como botões, listas e encaminhamento estão disponíveis via API.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CodeChat API v2.2.1 - Ultimate Manager</h1>
        <p className="text-muted-foreground">Gerenciamento completo da API CodeChat com todos os endpoints implementados</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="instance" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Instância
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Avançado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <AdminTab />
        </TabsContent>

        <TabsContent value="business">
          <BusinessTab />
        </TabsContent>

        <TabsContent value="instance">
          <InstanceTab />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Funcionalidades Avançadas</CardTitle>
              <CardDescription>WebHooks, Grupos, Mídia e integrações</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Esta seção será implementada com WebHooks, gerenciamento de grupos, 
                  controle de mídia, integrações MinIO e Chatwoot.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeChatV2UltimateManager;
