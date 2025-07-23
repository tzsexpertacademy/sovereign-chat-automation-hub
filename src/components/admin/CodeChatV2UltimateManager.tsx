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

const CodeChatV2UltimateManager: React.FC = () => {
  // Estados principais
  const [businesses, setBusinesses] = useState<Types.BusinessFindResponse[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Types.BusinessFindResponse | null>(null);
  const [instances, setInstances] = useState<Types.InstanceCreateResponse[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Types.InstanceCreateResponse | null>(null);
  const [webhooks, setWebhooks] = useState<Types.WebhookResponse[]>([]);
  
  // Estados de UI
  const [activeTab, setActiveTab] = useState('admin');
  const [adminToken, setAdminToken] = useState('');
  const [businessToken, setBuinessToken] = useState('');
  const [instanceJWT, setInstanceJWT] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Administração</h3>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Criar Business
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Business</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo business.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={businessForm.name}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do business"
                  />
                </div>
                <div>
                  <Label htmlFor="attributes">Atributos (JSON)</Label>
                  <Textarea
                    id="attributes"
                    value={JSON.stringify(businessForm.attributes, null, 2)}
                    onChange={(e) => {
                      try {
                        const attrs = JSON.parse(e.target.value);
                        setBusinessForm(prev => ({ ...prev, attributes: attrs }));
                      } catch (error) {
                        // Ignorar erro de parsing durante a digitação
                      }
                    }}
                    placeholder='{"category": "sales"}'
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreateBusiness} disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Business'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="adminToken">Token de Admin</Label>
            <Input
              id="adminToken"
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Inserir token de admin"
            />
          </div>
          <Button onClick={loadBusinesses} disabled={!adminToken || loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Carregar Businesses
          </Button>
        </div>

        <div className="grid gap-4">
          {businesses.map((business) => (
            <Card key={business.businessId} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{business.name}</CardTitle>
                  <Badge variant="outline">{business.businessId}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Token: {business.businessToken.substring(0, 20)}...
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedBusiness(business)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Selecionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // ============ BUSINESS TAB ============
  const BusinessTab = () => {
    const [instanceForm, setInstanceForm] = useState<Types.InstanceCreateRequest>({
      instanceName: '',
      externalId: ''
    });

    const handleCreateInstance = async () => {
      if (!selectedBusiness || !businessToken) {
        toast({ title: "Erro", description: "Selecione um business e insira o token", variant: "destructive" });
        return;
      }

      try {
        const newInstance = await business.createInstance(selectedBusiness.businessId, instanceForm, businessToken);
        setInstances(prev => [...prev, newInstance]);
        setInstanceForm({ instanceName: '', externalId: '' });
      } catch (error) {
        console.error('Erro ao criar instância:', error);
      }
    };

    const loadInstances = async () => {
      if (!selectedBusiness || !businessToken) return;
      
      try {
        const data = await business.getConnectedInstances(selectedBusiness.businessId, businessToken);
        setInstances(data.Instances || []);
      } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gerenciamento de Business</h3>
        </div>

        {!selectedBusiness ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selecione um business na aba Admin primeiro.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Selecionado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Nome:</strong> {selectedBusiness.name}</p>
                  <p><strong>ID:</strong> {selectedBusiness.businessId}</p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="businessToken">Token do Business</Label>
              <Input
                id="businessToken"
                type="password"
                value={businessToken}
                onChange={(e) => setBuinessToken(e.target.value)}
                placeholder="Inserir token do business"
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Criar Nova Instância</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    value={instanceForm.instanceName}
                    onChange={(e) => setInstanceForm(prev => ({ ...prev, instanceName: e.target.value }))}
                    placeholder="nome-instancia"
                  />
                </div>
                <div>
                  <Label htmlFor="externalId">ID Externo</Label>
                  <Input
                    id="externalId"
                    value={instanceForm.externalId}
                    onChange={(e) => setInstanceForm(prev => ({ ...prev, externalId: e.target.value }))}
                    placeholder="id-externo-opcional"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateInstance} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Instância
                </Button>
                <Button variant="outline" onClick={loadInstances} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Carregar Instâncias
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {instances.map((inst) => (
                <Card key={inst.instanceId} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{inst.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={inst.state === 'active' ? 'default' : 'secondary'}>
                          {inst.state}
                        </Badge>
                        <Badge variant={inst.connection === 'open' ? 'default' : 'destructive'}>
                          {inst.connection}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        ID: {inst.instanceId}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedInstance(inst)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============ INSTANCE TAB ============
  const InstanceTab = () => {
    const [qrCode, setQrCode] = useState<string>('');
    const [connectionState, setConnectionState] = useState<any>(null);

    const handleConnect = async () => {
      if (!selectedInstance || !instanceJWT) {
        toast({ title: "Erro", description: "Selecione uma instância e insira o JWT", variant: "destructive" });
        return;
      }

      try {
        const result = await instance.connect(selectedInstance.instanceId, instanceJWT);
        setQrCode(result.base64);
      } catch (error) {
        console.error('Erro ao conectar:', error);
      }
    };

    const checkConnectionState = async () => {
      if (!selectedInstance || !instanceJWT) return;
      
      try {
        const state = await instance.getConnectionState(selectedInstance.instanceId, instanceJWT);
        setConnectionState(state);
      } catch (error) {
        console.error('Erro ao verificar conexão:', error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gerenciamento de Instância</h3>
        </div>

        {!selectedInstance ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selecione uma instância na aba Business primeiro.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Instância Selecionada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Nome:</strong> {selectedInstance.name}</p>
                  <p><strong>ID:</strong> {selectedInstance.instanceId}</p>
                  <p><strong>Estado:</strong> 
                    <Badge className="ml-2" variant={selectedInstance.state === 'active' ? 'default' : 'secondary'}>
                      {selectedInstance.state}
                    </Badge>
                  </p>
                  <p><strong>Conexão:</strong> 
                    <Badge className="ml-2" variant={selectedInstance.connection === 'open' ? 'default' : 'destructive'}>
                      {selectedInstance.connection}
                    </Badge>
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="instanceJWT">JWT da Instância</Label>
              <Input
                id="instanceJWT"
                type="password"
                value={instanceJWT}
                onChange={(e) => setInstanceJWT(e.target.value)}
                placeholder="Inserir JWT da instância"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={loading}>
                <Smartphone className="h-4 w-4 mr-2" />
                Conectar
              </Button>
              <Button variant="outline" onClick={checkConnectionState} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Verificar Status
              </Button>
            </div>

            {qrCode && (
              <Card>
                <CardHeader>
                  <CardTitle>QR Code para Conexão</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <img src={qrCode} alt="QR Code" className="max-w-xs" />
                </CardContent>
              </Card>
            )}

            {connectionState && (
              <Card>
                <CardHeader>
                  <CardTitle>Estado da Conexão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><strong>Estado:</strong> 
                      <Badge className="ml-2" variant={connectionState.state === 'open' ? 'default' : 'destructive'}>
                        {connectionState.state}
                      </Badge>
                    </p>
                    <p><strong>Status Reason:</strong> {connectionState.statusReason}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============ MESSAGES TAB ============
  const MessagesTab = () => {
    const [textMessage, setTextMessage] = useState({
      recipient: '',
      text: ''
    });

    const handleSendText = async () => {
      if (!selectedInstance || !instanceJWT || !textMessage.recipient || !textMessage.text) {
        toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
        return;
      }

      try {
        await message.sendText(selectedInstance.instanceId, {
          recipient: textMessage.recipient,
          textMessage: { text: textMessage.text }
        }, instanceJWT);
        
        toast({ title: "Sucesso", description: "Mensagem enviada!" });
        setTextMessage({ recipient: '', text: '' });
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envio de Mensagens</h3>
        </div>

        {!selectedInstance ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selecione uma instância conectada primeiro.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Enviar Mensagem de Texto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="recipient">Destinatário</Label>
                  <Input
                    id="recipient"
                    value={textMessage.recipient}
                    onChange={(e) => setTextMessage(prev => ({ ...prev, recipient: e.target.value }))}
                    placeholder="5511999999999"
                  />
                </div>
                <div>
                  <Label htmlFor="text">Mensagem</Label>
                  <Textarea
                    id="text"
                    value={textMessage.text}
                    onChange={(e) => setTextMessage(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Digite sua mensagem..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleSendText} disabled={loading}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Mensagem
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CodeChat API v2.2.1 - Gerenciador Completo</h1>
        <p className="text-muted-foreground mt-2">
          Interface completa para gerenciamento da API CodeChat v2.2.1
        </p>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
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
      </Tabs>
    </div>
  );
};

export default CodeChatV2UltimateManager;