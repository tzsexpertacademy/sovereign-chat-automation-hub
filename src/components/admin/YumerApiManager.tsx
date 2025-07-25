
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import yumerApiV2 from '@/services/yumerApiV2Service';
import { validateEndpointCoverage } from '@/services/obsoleteServicesCleanup';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Database,
  Users,
  MessageSquare,
  Settings,
  Webhook,
  Image,
  Phone,
  Tag,
  UserPlus
} from 'lucide-react';

interface TestResult {
  endpoint: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

export const YumerApiManager: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [instanceName, setInstanceName] = useState('test-instance');
  const [testData, setTestData] = useState('{}');
  const [coverage, setCoverage] = useState(validateEndpointCoverage());
  const { toast } = useToast();

  useEffect(() => {
    setCoverage(validateEndpointCoverage());
  }, []);

  const runEndpointTest = async (
    name: string,
    testFunction: () => Promise<any>
  ) => {
    const startTime = Date.now();
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        endpoint: name,
        success: result.success || false,
        duration,
        data: result.data,
        error: result.error
      };
      
      setTestResults(prev => [...prev.filter(r => r.endpoint !== name), testResult]);
      
      if (result.success) {
        toast({
          title: `✅ ${name}`,
          description: `Sucesso em ${duration}ms`,
        });
      } else {
        toast({
          title: `❌ ${name}`,
          description: result.error || 'Erro desconhecido',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        endpoint: name,
        success: false,
        duration,
        error: error.message
      };
      
      setTestResults(prev => [...prev.filter(r => r.endpoint !== name), testResult]);
      
      toast({
        title: `❌ ${name}`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testBasicEndpoints = async () => {
    setLoading(true);
    setTestResults([]);

    // Testes básicos
    await runEndpointTest('List API Keys', async () => ({ success: true, data: await yumerApiV2.listApiKeys() }));
    await runEndpointTest('List Instances', async () => ({ success: true, data: await yumerApiV2.listInstances() }));
    await runEndpointTest('Config Check', async () => ({ success: true, data: yumerApiV2.getConfig() }));

    setLoading(false);
  };

  const testInstanceEndpoints = async () => {
    if (!instanceName) {
      toast({
        title: "Erro",
        description: "Nome da instância é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Testes de instância
    await runEndpointTest('Connection State', async () => ({ success: true, data: await yumerApiV2.getConnectionState(instanceName) }));
    await runEndpointTest('QR Code', async () => ({ success: true, data: await yumerApiV2.getQRCode(instanceName) }));
    await runEndpointTest('Webhook Config', async () => ({ success: true, data: await yumerApiV2.getWebhookConfig(instanceName) }));

    setLoading(false);
  };

  const testChatEndpoints = async () => {
    if (!instanceName) {
      toast({
        title: "Erro",
        description: "Nome da instância é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Testes de chat
    await runEndpointTest('Find Chats', async () => ({ success: true, data: await yumerApiV2.findChats(instanceName) }));
    await runEndpointTest('Find Contacts', async () => ({ success: true, data: await yumerApiV2.findContacts(instanceName) }));
    await runEndpointTest('Find Messages', async () => ({ success: true, data: await yumerApiV2.findMessages(instanceName, '5511999999999@c.us') }));

    setLoading(false);
  };

  const testCustomEndpoint = async () => {
    try {
      const data = JSON.parse(testData);
      setLoading(true);
      
      // Exemplo de teste customizado
      await runEndpointTest('Send Text', async () => ({ 
        success: true, 
        data: await yumerApiV2.sendText(instanceName, data.number || '5511999999999', data.message || 'Teste da API') 
      }));
      
      setLoading(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "JSON inválido nos dados de teste",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{coverage.implemented.length}</p>
              <p className="text-sm text-muted-foreground">Implementados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <XCircle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{coverage.missing.length}</p>
              <p className="text-sm text-muted-foreground">Faltando</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Database className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{coverage.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <AlertCircle className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">
                {Math.round((coverage.implemented.length / coverage.total) * 100)}%
              </p>
              <p className="text-sm text-muted-foreground">Cobertura</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="instance">Instância</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="group">Grupos</TabsTrigger>
          <TabsTrigger value="media">Mídia</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Testes Básicos da API
              </CardTitle>
              <CardDescription>
                Testar endpoints fundamentais (health, info, business, instances)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testBasicEndpoints} 
                disabled={loading}
                className="w-full"
              >
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Executar Testes Básicos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Testes de Instância
              </CardTitle>
              <CardDescription>
                Testar gerenciamento de instâncias WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome da instância"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <Button 
                onClick={testInstanceEndpoints} 
                disabled={loading || !instanceName}
                className="w-full"
              >
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Testar Instância
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Testes de Chat
              </CardTitle>
              <CardDescription>
                Testar funcionalidades de chat e mensagens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome da instância"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <Button 
                onClick={testChatEndpoints} 
                disabled={loading || !instanceName}
                className="w-full"
              >
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                Testar Chat
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Testes de Grupos
              </CardTitle>
              <CardDescription>
                Em desenvolvimento - Endpoints de grupos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Em breve</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Testes de Mídia
              </CardTitle>
              <CardDescription>
                Em desenvolvimento - Upload/Download de mídia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Em breve</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Teste Customizado
              </CardTitle>
              <CardDescription>
                Executar teste personalizado com dados JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome da instância"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <Textarea
                placeholder='{"number": "5511999999999", "message": "Teste"}'
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                rows={4}
              />
              <Button 
                onClick={testCustomEndpoint} 
                disabled={loading || !instanceName}
                className="w-full"
              >
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Executar Teste Custom
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resultados dos testes */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados dos Testes</CardTitle>
            <CardDescription>
              Últimos testes executados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">{result.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.duration}ms
                    </Badge>
                    {result.error && (
                      <Badge variant="outline" className="text-xs">
                        {result.error}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoints faltando */}
      {coverage.missing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Endpoints Faltando</CardTitle>
            <CardDescription>
              Endpoints da API oficial que ainda não foram implementados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {coverage.missing.map((endpoint, index) => (
                <Badge key={index} variant="outline" className="justify-start">
                  {endpoint}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default YumerApiManager;
