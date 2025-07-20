
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useServerConfig } from '@/hooks/useServerConfig';
import { 
  Server, 
  Shield, 
  Settings, 
  Database, 
  TestTube, 
  Download, 
  Upload, 
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Wifi
} from 'lucide-react';

const ServerConfiguration = () => {
  const { 
    config, 
    status, 
    isLoading, 
    updateConfig, 
    testConnection, 
    validateConfig,
    exportConfig,
    importConfig,
    resetToDefaults 
  } = useServerConfig();

  const { toast } = useToast();
  const [importData, setImportData] = useState('');
  const [validationResults, setValidationResults] = useState<{ valid: boolean; errors: string[] } | null>(null);

  const handleConfigChange = (field: string, value: any) => {
    updateConfig({ [field]: value });
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection();
      if (result.isOnline) {
        toast({
          title: "✅ Conexão bem-sucedida",
          description: `Latência: ${result.latency}ms`,
        });
      } else {
        toast({
          title: "❌ Falha na conexão",
          description: result.error || "Servidor não responde",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Erro no teste",
        description: "Não foi possível testar a conexão",
        variant: "destructive"
      });
    }
  };

  const handleValidateConfig = async () => {
    try {
      const results = await validateConfig();
      setValidationResults(results);
      
      if (results.valid) {
        toast({
          title: "✅ Configuração válida",
          description: "Todas as validações passaram",
        });
      } else {
        toast({
          title: "⚠️ Problemas encontrados",
          description: `${results.errors.length} erro(s) detectado(s)`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Erro na validação",
        description: "Não foi possível validar a configuração",
        variant: "destructive"
      });
    }
  };

  const handleExportConfig = () => {
    const configData = exportConfig();
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yumer-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "📁 Configuração exportada",
      description: "Arquivo baixado com sucesso",
    });
  };

  const handleImportConfig = () => {
    try {
      const success = importConfig(importData);
      
      if (success) {
        toast({
          title: "📂 Configuração importada",
          description: "Configuração aplicada com sucesso",
        });
        setImportData('');
      } else {
        toast({
          title: "❌ Erro na importação",
          description: "Formato de configuração inválido",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Erro na importação",
        description: "Não foi possível importar a configuração",
        variant: "destructive"
      });
    }
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    toast({
      title: "🔄 Configuração resetada",
      description: "Valores padrão restaurados",
    });
  };

  const getStatusBadge = () => {
    if (status.isOnline) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Online</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuração do Servidor</h1>
          <p className="text-gray-600">Gerencie as configurações de conexão com o backend</p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge()}
          <div className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            Última verificação: {new Date(status.lastCheck).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{status.isOnline ? 'Online' : 'Offline'}</div>
              <div className="text-sm text-gray-500">Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{status.latency}ms</div>
              <div className="text-sm text-gray-500">Latência</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{config.serverUrl}</div>
              <div className="text-sm text-gray-500">Servidor Atual</div>
            </div>
          </div>
          
          {status.error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResults && (
        <Card>
          <CardHeader>
            <CardTitle className={validationResults.valid ? "text-green-700" : "text-red-700"}>
              {validationResults.valid ? "✅ Configuração Válida" : "⚠️ Problemas Encontrados"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!validationResults.valid && (
              <ul className="list-disc list-inside space-y-1 text-red-600">
                {validationResults.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Tabs */}
      <Tabs defaultValue="primary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="primary">
            <Server className="w-4 h-4 mr-2" />
            Servidor
          </TabsTrigger>
          <TabsTrigger value="auth">
            <Shield className="w-4 h-4 mr-2" />
            Autenticação
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Settings className="w-4 h-4 mr-2" />
            Avançado
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="w-4 h-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="tests">
            <TestTube className="w-4 h-4 mr-2" />
            Testes
          </TabsTrigger>
        </TabsList>

        {/* Primary Server Configuration */}
        <TabsContent value="primary">
          <Card>
            <CardHeader>
              <CardTitle>Configuração Primária do Servidor</CardTitle>
              <CardDescription>Configure a URL e porta do servidor backend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serverUrl">URL Completa do Servidor</Label>
                  <Input
                    id="serverUrl"
                    value={config.serverUrl}
                    onChange={(e) => handleConfigChange('serverUrl', e.target.value)}
                    placeholder="https://yumer.yumerflow.app:8083"
                  />
                </div>
                <div>
                  <Label htmlFor="host">Host/Domínio</Label>
                  <Input
                    id="host"
                    value={config.host}
                    onChange={(e) => handleConfigChange('host', e.target.value)}
                    placeholder="yumer.yumerflow.app"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    type="number"
                    value={config.port}
                    onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="protocol">Protocolo</Label>
                  <Select value={config.protocol} onValueChange={(value) => handleConfigChange('protocol', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https">HTTPS (Recomendado)</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="basePath">Path Base (opcional)</Label>
                  <Input
                    id="basePath"
                    value={config.basePath}
                    onChange={(e) => handleConfigChange('basePath', e.target.value)}
                    placeholder="/api/v1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Configuration */}
        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>Autenticação e Segurança</CardTitle>
              <CardDescription>Configure as chaves de acesso e timeouts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="globalApiKey">Chave API Global</Label>
                <Input
                  id="globalApiKey"
                  type="password"
                  value={config.globalApiKey}
                  onChange={(e) => handleConfigChange('globalApiKey', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="jwtSecret">JWT Secret (WebSocket)</Label>
                <Input
                  id="jwtSecret"
                  type="password"
                  value={config.jwtSecret}
                  onChange={(e) => handleConfigChange('jwtSecret', e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="requestTimeout">Timeout de Requisições (ms)</Label>
                  <Input
                    id="requestTimeout"
                    type="number"
                    value={config.requestTimeout}
                    onChange={(e) => handleConfigChange('requestTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="retryAttempts">Tentativas de Retry</Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    value={config.retryAttempts}
                    onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Avançadas</CardTitle>
              <CardDescription>WebSocket, CORS e outras configurações técnicas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="webSocketEnabled">WebSocket Habilitado</Label>
                  <Switch
                    id="webSocketEnabled"
                    checked={config.webSocketEnabled}
                    onCheckedChange={(checked) => handleConfigChange('webSocketEnabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="corsEnabled">CORS Habilitado</Label>
                  <Switch
                    id="corsEnabled"
                    checked={config.corsEnabled}
                    onCheckedChange={(checked) => handleConfigChange('corsEnabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="sslRequired">SSL Obrigatório</Label>
                  <Switch
                    id="sslRequired"
                    checked={config.sslRequired}
                    onCheckedChange={(checked) => handleConfigChange('sslRequired', checked)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="webSocketPort">Porta WebSocket (opcional)</Label>
                  <Input
                    id="webSocketPort"
                    type="number"
                    value={config.webSocketPort || ''}
                    onChange={(e) => handleConfigChange('webSocketPort', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Mesma porta da API"
                  />
                </div>
                
                <div>
                  <Label htmlFor="environment">Ambiente</Label>
                  <Select value={config.environment} onValueChange={(value) => handleConfigChange('environment', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Desenvolvimento</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Configuration */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup e Fallback</CardTitle>
              <CardDescription>Configure opções de backup e recuperação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fallbackServerUrl">Servidor de Fallback (opcional)</Label>
                <Input
                  id="fallbackServerUrl"
                  value={config.fallbackServerUrl || ''}
                  onChange={(e) => handleConfigChange('fallbackServerUrl', e.target.value)}
                  placeholder="https://backup-server.com:8083"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="offlineMode">Modo Offline</Label>
                  <p className="text-sm text-gray-500">Continuar funcionando sem backend</p>
                </div>
                <Switch
                  id="offlineMode"
                  checked={config.offlineMode}
                  onCheckedChange={(checked) => handleConfigChange('offlineMode', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="configCache">Cache de Configurações</Label>
                  <p className="text-sm text-gray-500">Salvar configurações localmente</p>
                </div>
                <Switch
                  id="configCache"
                  checked={config.configCache}
                  onCheckedChange={(checked) => handleConfigChange('configCache', checked)}
                />
              </div>

              {/* Import/Export */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleExportConfig} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Configuração
                  </Button>
                  <Button onClick={handleResetToDefaults} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Resetar Padrões
                  </Button>
                </div>
                
                <div>
                  <Label htmlFor="importData">Importar Configuração (JSON)</Label>
                  <Textarea
                    id="importData"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="Cole aqui o JSON da configuração..."
                    rows={4}
                  />
                  <Button onClick={handleImportConfig} disabled={!importData.trim()} className="mt-2">
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests and Validation */}
        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle>Testes e Validação</CardTitle>
              <CardDescription>Verifique se a configuração está funcionando corretamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={handleTestConnection} disabled={isLoading}>
                  <TestTube className="w-4 h-4 mr-2" />
                  {isLoading ? 'Testando...' : 'Testar Conectividade'}
                </Button>
                
                <Button onClick={handleValidateConfig} disabled={isLoading} variant="outline">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isLoading ? 'Validando...' : 'Validar Configuração'}
                </Button>
              </div>
              
              {/* Test Results Display */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Informações da Configuração Atual:</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div><strong>API URL:</strong> {config.serverUrl}{config.basePath}</div>
                  <div><strong>WebSocket URL:</strong> {config.webSocketEnabled ? `wss://${config.host}:${config.webSocketPort || config.port}${config.basePath}` : 'Desabilitado'}</div>
                  <div><strong>Ambiente:</strong> {config.environment}</div>
                  <div><strong>Última atualização:</strong> {new Date(config.lastUpdated).toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServerConfiguration;
