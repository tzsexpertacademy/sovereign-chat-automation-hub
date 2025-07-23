// Dashboard para CodeChat API v2.1.3 - Business/Instance Management
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useCodeChatV2 } from '@/hooks/useCodeChatV2';
import { codeChatV2Service } from '@/services/codechatV2Service';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { CheckCircle, XCircle, Loader2, Building2, Smartphone, MessageSquare } from 'lucide-react';

export const CodeChatV2Dashboard: React.FC = () => {
  const {
    business,
    instance,
    isLoading,
    connectionStatus,
    createBusiness,
    createInstance,
    connectInstance,
    checkConnectionState,
    sendMessage,
    loadPersistedData,
    clearData,
    hasBusinessToken,
    hasInstanceJWT,
    isConnected
  } = useCodeChatV2();

  const [qrCode, setQrCode] = useState<string>('');
  const [businessForm, setBusinessForm] = useState({
    name: 'Yumer Teste',
    slug: `yumer-teste-${Date.now()}`,
    email: 'contato@yumer.com.br',
    phone: '+55 54 99999-9999'
  });
  const [testMessage, setTestMessage] = useState({
    number: '',
    text: 'Olá! Esta é uma mensagem de teste do CodeChat API v2.1.3'
  });
  const [connectionTest, setConnectionTest] = useState<{ status: string; latency?: number }>({ status: 'idle' });

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  const handleCreateBusiness = async () => {
    const result = await createBusiness(businessForm);
    if (result) {
      console.log('✅ Business criado:', result);
    }
  };

  const handleCreateInstance = async () => {
    const result = await createInstance();
    if (result) {
      console.log('✅ Instância criada:', result);
    }
  };

  const handleConnect = async () => {
    const result = await connectInstance();
    if (result.success && result.qrCode) {
      setQrCode(result.qrCode);
    }
  };

  const handleSendTestMessage = async () => {
    if (testMessage.number && testMessage.text) {
      await sendMessage(testMessage.number, testMessage.text);
    }
  };

  const handleTestConnection = async () => {
    setConnectionTest({ status: 'testing' });
    
    try {
      const result = await codeChatV2Service.testConnection();
      setConnectionTest({
        status: result.success ? 'success' : 'error',
        latency: result.latency
      });
    } catch (error) {
      setConnectionTest({ status: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'close':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CodeChat API v2.1.3</h1>
          <p className="text-muted-foreground">Business/Instance Management Dashboard</p>
        </div>
        <Button variant="outline" onClick={handleTestConnection} disabled={connectionTest.status === 'testing'}>
          {connectionTest.status === 'testing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão'
          )}
        </Button>
      </div>

      {connectionTest.status !== 'idle' && (
        <Alert>
          <AlertDescription>
            {connectionTest.status === 'testing' && 'Testando conexão com CodeChat API v2.1.3...'}
            {connectionTest.status === 'success' && (
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Conexão OK - Latência: {connectionTest.latency}ms
              </div>
            )}
            {connectionTest.status === 'error' && (
              <div className="flex items-center">
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                Erro na conexão com API
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEÇÃO 1: BUSINESS MANAGEMENT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Business Management
            </CardTitle>
            <CardDescription>
              Criar e gerenciar businesses na CodeChat API v2.1.3
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBusinessToken ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-name">Nome</Label>
                    <Input
                      id="business-name"
                      value={businessForm.name}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-slug">Slug</Label>
                    <Input
                      id="business-slug"
                      value={businessForm.slug}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, slug: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-email">Email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={businessForm.email}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-phone">Telefone</Label>
                    <Input
                      id="business-phone"
                      value={businessForm.phone}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateBusiness} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando Business...
                    </>
                  ) : (
                    'Criar Business'
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Business Criado</span>
                  <Badge variant="default">Ativo</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><strong>ID:</strong> {business.businessId}</p>
                  <p><strong>Nome:</strong> {business.name}</p>
                  <p><strong>Slug:</strong> {business.slug}</p>
                  <p><strong>Token:</strong> {business.businessToken?.substring(0, 20)}...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEÇÃO 2: INSTANCE MANAGEMENT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Smartphone className="h-5 w-5 mr-2" />
              Instance Management
            </CardTitle>
            <CardDescription>
              Criar e conectar instâncias WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasInstanceJWT ? (
              <Button 
                onClick={handleCreateInstance} 
                disabled={!hasBusinessToken || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando Instância...
                  </>
                ) : (
                  'Criar Instância'
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Instância Criada</span>
                    <Badge className={getStatusColor(connectionStatus)} variant="secondary">
                      {connectionStatus}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>ID:</strong> {instance.instanceId}</p>
                    <p><strong>Nome:</strong> {instance.name}</p>
                    <p><strong>Estado:</strong> {instance.state}</p>
                    <p><strong>JWT:</strong> {instance.instanceJWT?.substring(0, 20)}...</p>
                  </div>
                </div>

                {!isConnected && (
                  <Button onClick={handleConnect} disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      'Conectar WhatsApp'
                    )}
                  </Button>
                )}

                <Button onClick={checkConnectionState} variant="outline" className="w-full">
                  Verificar Status
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR CODE DISPLAY */}
      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle>QR Code - WhatsApp</CardTitle>
            <CardDescription>
              Escaneie este código com o WhatsApp para conectar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <QRCodeDisplay qrCode={qrCode} instanceName={instance.name || 'Instance'} />
          </CardContent>
        </Card>
      )}

      {/* TESTE DE MENSAGEM */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Teste de Mensagem
            </CardTitle>
            <CardDescription>
              Enviar mensagem de teste via CodeChat API v2.1.3
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="test-number">Número</Label>
                <Input
                  id="test-number"
                  placeholder="5511999999999"
                  value={testMessage.number}
                  onChange={(e) => setTestMessage(prev => ({ ...prev, number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="test-text">Mensagem</Label>
                <Input
                  id="test-text"
                  value={testMessage.text}
                  onChange={(e) => setTestMessage(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
            </div>
            <Button 
              onClick={handleSendTestMessage}
              disabled={!testMessage.number || !testMessage.text || isLoading}
              className="w-full"
            >
              Enviar Mensagem de Teste
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AÇÕES ADMINISTRATIVAS */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Administrativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={clearData} variant="destructive" className="w-full">
            Limpar Todos os Dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};