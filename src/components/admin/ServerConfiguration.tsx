
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  Server, 
  Shield, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { useServerConfig } from "@/hooks/useServerConfig";
import { toast } from "sonner";

const ServerConfiguration = () => {
  const { 
    config, 
    status, 
    updateConfig, 
    saveConfig, 
    testConnection, 
    validateConfig,
    exportConfig,
    importConfig,
    resetToDefaults,
    rollbackConfig,
    isLoading,
    isSaving
  } = useServerConfig();

  const [localConfig, setLocalConfig] = useState(config);
  const [configJson, setConfigJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    updateConfig({ [field]: value });
  };

  const handleSaveConfig = async () => {
    const success = await saveConfig();
    if (success) {
      toast.success('Configuração CodeChat API v2.2.1 salva com sucesso!');
    } else {
      toast.error('Erro ao salvar configuração da API v2.2.1');
    }
  };

  const handleTestConnection = async () => {
    const result = await testConnection();
    if (result.isOnline) {
      toast.success('Conexão CodeChat API v2.2.1 testada com sucesso!');
    } else {
      toast.error(`Erro na conexão CodeChat API v2.2.1: ${result.error || 'Desconhecido'}`);
    }
  };

  const handleValidateConfig = async () => {
    const isValid = await validateConfig();
    if (isValid) {
      toast.success('Configuração CodeChat API v2.2.1 válida!');
    } else {
      toast.error('Configuração CodeChat API v2.2.1 inválida');
    }
  };

  const handleExportConfig = () => {
    const exported = exportConfig();
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codechat-v2.2.1-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuração CodeChat API v2.2.1 exportada!');
  };

  const handleImportConfig = () => {
    try {
      const success = importConfig(configJson);
      if (success) {
        setLocalConfig(config);
        setConfigJson('');
        setShowImport(false);
        toast.success('Configuração CodeChat API v2.2.1 importada com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao importar configuração da API v2.2.1');
    }
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    setLocalConfig(config);
    toast.success('Configuração resetada para padrões CodeChat API v2.2.1');
  };

  const handleRollback = () => {
    const success = rollbackConfig();
    if (success) {
      setLocalConfig(config);
      toast.success('Configuração anterior da API v2.2.1 restaurada');
    } else {
      toast.error('Nenhuma configuração anterior da API v2.2.1 encontrada');
    }
  };

  const getStatusIcon = () => {
    if (status.isOnline) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status.error) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <Server className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    if (status.isOnline) {
      return <Badge variant="default">API v2.2.1 Conectada</Badge>;
    } else if (status.error) {
      return <Badge variant="destructive">API v2.2.1 Erro</Badge>;
    } else {
      return <Badge variant="outline">API v2.2.1 Desconectada</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-6 h-6 text-blue-500" />
              <div>
                <CardTitle className="text-xl">Configuração CodeChat API v2.2.1</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configuração avançada da API CodeChat v2.2.1 - Servidor Yumer
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div className="text-right">
                {getStatusBadge()}
                {status.lastCheck && (
                  <p className="text-xs text-muted-foreground">
                    Último teste: {new Date(status.lastCheck).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Configuration */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnóstico</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        {/* Basic Configuration */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="w-5 h-5" />
                <span>Configuração Básica - CodeChat API v2.2.1</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">URL do Servidor CodeChat v2.2.1</Label>
                  <Input
                    id="serverUrl"
                    value={localConfig.serverUrl}
                    onChange={(e) => handleConfigChange('serverUrl', e.target.value)}
                    placeholder="https://api.yumer.com.br"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiVersion">Versão da API CodeChat</Label>
                  <Input
                    id="apiVersion"
                    value={localConfig.apiVersion}
                    onChange={(e) => handleConfigChange('apiVersion', e.target.value)}
                    placeholder="v2.2.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="basePath">Base Path API v2.2.1</Label>
                  <Input
                    id="basePath"
                    value={localConfig.basePath}
                    onChange={(e) => handleConfigChange('basePath', e.target.value)}
                    placeholder="/api/v2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="globalApiKey">API Key Global v2.2.1</Label>
                  <Input
                    id="globalApiKey"
                    type="password"
                    value={localConfig.globalApiKey}
                    onChange={(e) => handleConfigChange('globalApiKey', e.target.value)}
                    placeholder="Sua API Key CodeChat v2.2.1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sslRequired"
                  checked={localConfig.sslRequired}
                  onCheckedChange={(checked) => handleConfigChange('sslRequired', checked)}
                />
                <Label htmlFor="sslRequired">SSL Obrigatório (API v2.2.1)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="corsEnabled"
                  checked={localConfig.corsEnabled}
                  onCheckedChange={(checked) => handleConfigChange('corsEnabled', checked)}
                />
                <Label htmlFor="corsEnabled">CORS Habilitado (API v2.2.1)</Label>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Salvando API v2.2.1...' : 'Salvar API v2.2.1'}
                </Button>
                
                <Button onClick={handleTestConnection} variant="outline" disabled={isLoading}>
                  <TestTube className="w-4 h-4 mr-2" />
                  {isLoading ? 'Testando API v2.2.1...' : 'Testar API v2.2.1'}
                </Button>
                
                <Button onClick={handleValidateConfig} variant="outline">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validar API v2.2.1
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Configuração Avançada - CodeChat API v2.2.1</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requestTimeout">Timeout API v2.2.1 (ms)</Label>
                  <Input
                    id="requestTimeout"
                    type="number"
                    value={localConfig.requestTimeout}
                    onChange={(e) => handleConfigChange('requestTimeout', parseInt(e.target.value))}
                    placeholder="15000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryAttempts">Tentativas de Retry API v2.2.1</Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    value={localConfig.retryAttempts}
                    onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminToken">Token Admin CodeChat v2.2.1</Label>
                  <Input
                    id="adminToken"
                    type="password"
                    value={localConfig.adminToken}
                    onChange={(e) => handleConfigChange('adminToken', e.target.value)}
                    placeholder="Token de administração API v2.2.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitRequests">Rate Limit API v2.2.1 (requests)</Label>
                  <Input
                    id="rateLimitRequests"
                    type="number"
                    value={localConfig.rateLimitRequests}
                    onChange={(e) => handleConfigChange('rateLimitRequests', parseInt(e.target.value))}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="webSocketEnabled"
                    checked={localConfig.webSocketEnabled}
                    onCheckedChange={(checked) => handleConfigChange('webSocketEnabled', checked)}
                  />
                  <Label htmlFor="webSocketEnabled">WebSocket Habilitado (API v2.2.1)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="configCache"
                    checked={localConfig.configCache}
                    onCheckedChange={(checked) => handleConfigChange('configCache', checked)}
                  />
                  <Label htmlFor="configCache">Cache de Configuração API v2.2.1</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="offlineMode"
                    checked={localConfig.offlineMode}
                    onCheckedChange={(checked) => handleConfigChange('offlineMode', checked)}
                  />
                  <Label htmlFor="offlineMode">Modo Offline API v2.2.1</Label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Avançado v2.2.1
                </Button>
                
                <Button onClick={handleResetToDefaults} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resetar para v2.2.1
                </Button>
                
                <Button onClick={handleRollback} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rollback v2.2.1
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostic Tab */}
        <TabsContent value="diagnostic" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Diagnóstico CodeChat API v2.2.1:</strong> Use as ferramentas avançadas de diagnóstico para testar a conectividade e validar a configuração da API v2.2.1.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="w-5 h-5" />
                <span>Backup & Restauração - CodeChat API v2.2.1</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Button onClick={handleExportConfig}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Config v2.2.1
                </Button>
                
                <Button onClick={() => setShowImport(!showImport)} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Config v2.2.1
                </Button>
              </div>

              {showImport && (
                <div className="space-y-4 p-4 border rounded">
                  <Label htmlFor="configJson">JSON da Configuração CodeChat API v2.2.1</Label>
                  <textarea
                    id="configJson"
                    className="w-full h-32 p-2 border rounded font-mono text-sm"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder="Cole aqui o JSON da configuração CodeChat API v2.2.1 exportada..."
                  />
                  
                  <div className="flex space-x-2">
                    <Button onClick={handleImportConfig} disabled={!configJson.trim()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar v2.2.1
                    </Button>
                    <Button onClick={() => setShowImport(false)} variant="outline">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Sempre faça backup da configuração CodeChat API v2.2.1 antes de fazer alterações importantes.
                  A importação sobrescreverá todas as configurações atuais da API v2.2.1.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServerConfiguration;
