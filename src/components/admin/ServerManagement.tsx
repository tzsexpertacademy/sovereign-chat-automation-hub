import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Server, 
  Shield, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Globe,
  Lock,
  RefreshCw,
  Zap,
  Wifi,
  HardDrive,
  Settings,
  FileText
} from "lucide-react";
import { useServerConfig } from "@/hooks/useServerConfig";
import { toast } from "@/hooks/use-toast";
import ServerAdvancedDiagnostic from "./ServerAdvancedDiagnostic";

const ServerManagement = () => {
  const location = useLocation();
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh when accessing the page
  useEffect(() => {
    if (location.pathname === '/admin/server') {
      console.log('🔄 [ServerManagement] Auto-refresh ao acessar página');
      refreshServerData();
    }
  }, [location.pathname]);

  const refreshServerData = async () => {
    setIsRefreshing(true);
    try {
      await testConnection();
      const result = await validateConfig();
      return result;
    } catch (error) {
      console.error('Erro ao atualizar dados do servidor:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    updateConfig({ [field]: value });
  };

  const handleSaveConfig = async () => {
    await saveConfig();
    toast({
      title: "Configuração salva",
      description: "As configurações do servidor foram salvas com sucesso.",
    });
  };

  const handleTestConnection = async () => {
    const result = await testConnection();
    if (result.isOnline) {
      toast({
        title: "Conexão bem-sucedida",
        description: "O servidor está respondendo corretamente.",
      });
    } else {
      toast({
        title: "Falha na conexão",
        description: result.error || "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    }
  };

  const handleValidateConfig = async () => {
    try {
      const result = await validateConfig();
      if (result && result.valid) {
        toast({
          title: "Configuração válida",
          description: "Todas as configurações estão corretas.",
        });
      }
    } catch (error) {
      console.error('Erro ao validar configuração:', error);
    }
  };

  const handleExportConfig = () => {
    exportConfig();
    toast({
      title: "Configuração exportada",
      description: "O arquivo de configuração foi baixado.",
    });
  };

  const handleImportConfig = () => {
    try {
      importConfig(configJson);
      setLocalConfig(config);
      setConfigJson('');
      setShowImport(false);
      toast({
        title: "Configuração importada",
        description: "A configuração foi importada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: "JSON inválido ou formato incorreto.",
        variant: "destructive",
      });
    }
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    setLocalConfig(config);
    toast({
      title: "Configuração resetada",
      description: "A configuração foi restaurada para os valores padrão.",
    });
  };

  const handleRollback = () => {
    try {
      rollbackConfig();
      setLocalConfig(config);
      toast({
        title: "Configuração restaurada",
        description: "A configuração anterior foi restaurada.",
      });
    } catch (error) {
      toast({
        title: "Erro ao restaurar",
        description: "Não há configuração anterior para restaurar.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    if (isLoading || isRefreshing) {
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (status.isOnline) {
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    } else if (status.error) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <Server className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusBadge = () => {
    if (isLoading || isRefreshing) {
      return <Badge variant="secondary" className="animate-pulse">Verificando...</Badge>;
    }
    if (status.isOnline) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">Online</Badge>;
    } else if (status.error) {
      return <Badge variant="destructive">Erro</Badge>;
    } else {
      return <Badge variant="secondary">Offline</Badge>;
    }
  };

  const getConnectionQuality = () => {
    if (!status.isOnline) return null;
    
    const latency = status.latency || 0;
    if (latency < 100) return { label: "Excelente", color: "text-emerald-500", icon: Zap };
    if (latency < 300) return { label: "Boa", color: "text-blue-500", icon: Wifi };
    if (latency < 600) return { label: "Regular", color: "text-yellow-500", icon: Activity };
    return { label: "Lenta", color: "text-red-500", icon: AlertTriangle };
  };

  const connectionQuality = getConnectionQuality();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-6 h-6" />
                <div>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Skeleton className="w-5 h-5" />
                <Skeleton className="w-20 h-6" />
              </div>
            </div>
          </CardHeader>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Header with Status */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Server className="w-8 h-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Servidor
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerenciamento e configuração do servidor WhatsApp
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshServerData}
                disabled={isRefreshing}
                className="hidden sm:flex"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <div className="flex items-center space-x-3">
                {getStatusIcon()}
                <div className="text-right">
                  {getStatusBadge()}
                  {status.lastCheck && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(status.lastCheck).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connection Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${status.isOnline ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <Globe className={`w-5 h-5 ${status.isOnline ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Conectividade</p>
                  <p className="text-xs text-muted-foreground">
                    {status.isOnline ? 'Servidor online' : 'Servidor offline'}
                  </p>
                </div>
              </div>
              {connectionQuality && (
                <div className="text-right">
                  <p className={`text-sm font-medium ${connectionQuality.color}`}>
                    {connectionQuality.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.latency}ms
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${localConfig.sslRequired ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                  <Lock className={`w-5 h-5 ${localConfig.sslRequired ? 'text-emerald-500' : 'text-yellow-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Segurança</p>
                  <p className="text-xs text-muted-foreground">
                    {localConfig.sslRequired ? 'SSL habilitado' : 'SSL desabilitado'}
                  </p>
                </div>
              </div>
              {localConfig.globalApiKey && (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <HardDrive className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Configuração</p>
                  <p className="text-xs text-muted-foreground">
                    API v{localConfig.apiVersion}
                  </p>
                </div>
              </div>
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Configuration Tabs */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
          <TabsTrigger value="basic" className="flex items-center space-x-2 py-3">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Básico</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2 py-3">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Avançado</span>
          </TabsTrigger>
          <TabsTrigger value="diagnostic" className="flex items-center space-x-2 py-3">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Diagnóstico</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center space-x-2 py-3">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
        </TabsList>

        {/* Basic Configuration */}
        <TabsContent value="basic" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="w-5 h-5" />
                <span>Configuração Básica</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure os parâmetros principais do servidor
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl" className="text-sm font-medium">
                    URL do Servidor
                  </Label>
                  <Input
                    id="serverUrl"
                    value={localConfig.serverUrl}
                    onChange={(e) => handleConfigChange('serverUrl', e.target.value)}
                    placeholder="https://api.yumer.com.br"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Endereço base do servidor da API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiVersion" className="text-sm font-medium">
                    Versão da API
                  </Label>
                  <Input
                    id="apiVersion"
                    value={localConfig.apiVersion}
                    onChange={(e) => handleConfigChange('apiVersion', e.target.value)}
                    placeholder="v2.2.1"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Versão da API CodeChat
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="basePath" className="text-sm font-medium">
                    Caminho Base
                  </Label>
                  <Input
                    id="basePath"
                    value={localConfig.basePath}
                    onChange={(e) => handleConfigChange('basePath', e.target.value)}
                    placeholder="/api/v2"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Caminho base para todas as requisições
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="globalApiKey" className="text-sm font-medium">
                    Chave da API
                  </Label>
                  <Input
                    id="globalApiKey"
                    type="password"
                    value={localConfig.globalApiKey}
                    onChange={(e) => handleConfigChange('globalApiKey', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Chave de autenticação da API
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Configurações de Segurança</h4>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="sslRequired" className="text-sm font-medium">
                        SSL Obrigatório
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Força o uso de HTTPS para todas as conexões
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="sslRequired"
                    checked={localConfig.sslRequired}
                    onCheckedChange={(checked) => handleConfigChange('sslRequired', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="corsEnabled" className="text-sm font-medium">
                        CORS Habilitado
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Permite requisições de diferentes origens
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="corsEnabled"
                    checked={localConfig.corsEnabled}
                    onCheckedChange={(checked) => handleConfigChange('corsEnabled', checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSaveConfig} disabled={isSaving} className="flex-1 sm:flex-none">
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
                
                <Button onClick={handleTestConnection} variant="outline" disabled={isLoading} className="flex-1 sm:flex-none">
                  <TestTube className="w-4 h-4 mr-2" />
                  {isLoading ? 'Testando...' : 'Testar'}
                </Button>
                
                <Button onClick={handleValidateConfig} variant="outline" className="flex-1 sm:flex-none">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Configuração Avançada</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Parâmetros avançados para otimização e controle
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="requestTimeout" className="text-sm font-medium">
                    Timeout (ms)
                  </Label>
                  <Input
                    id="requestTimeout"
                    type="number"
                    value={localConfig.requestTimeout}
                    onChange={(e) => handleConfigChange('requestTimeout', parseInt(e.target.value))}
                    placeholder="30000"
                    min="1000"
                    max="120000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo limite para requisições em milissegundos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryAttempts" className="text-sm font-medium">
                    Tentativas de Retry
                  </Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    value={localConfig.retryAttempts}
                    onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
                    placeholder="3"
                    min="0"
                    max="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de tentativas em caso de falha
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminToken" className="text-sm font-medium">
                    Token Admin
                  </Label>
                  <Input
                    id="adminToken"
                    type="password"
                    value={localConfig.adminToken}
                    onChange={(e) => handleConfigChange('adminToken', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Token de administração para operações privilegiadas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitRequests" className="text-sm font-medium">
                    Rate Limit (req/min)
                  </Label>
                  <Input
                    id="rateLimitRequests"
                    type="number"
                    value={localConfig.rateLimitRequests}
                    onChange={(e) => handleConfigChange('rateLimitRequests', parseInt(e.target.value))}
                    placeholder="60"
                    min="1"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limite de requisições por minuto
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Recursos Avançados</h4>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Wifi className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="webSocketEnabled" className="text-sm font-medium">
                        WebSocket
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Conexão em tempo real via WebSocket
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="webSocketEnabled"
                    checked={localConfig.webSocketEnabled}
                    onCheckedChange={(checked) => handleConfigChange('webSocketEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="configCache" className="text-sm font-medium">
                        Cache de Configuração
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Armazena configurações em cache local
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="configCache"
                    checked={localConfig.configCache}
                    onCheckedChange={(checked) => handleConfigChange('configCache', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="offlineMode" className="text-sm font-medium">
                        Modo Offline
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Funciona sem conexão com o servidor
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="offlineMode"
                    checked={localConfig.offlineMode}
                    onCheckedChange={(checked) => handleConfigChange('offlineMode', checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Avançado
                </Button>
                
                <Button onClick={handleResetToDefaults} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resetar
                </Button>
                
                <Button onClick={handleRollback} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rollback
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostic Tab */}
        <TabsContent value="diagnostic" className="space-y-4 mt-6">
          <ServerAdvancedDiagnostic />
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="w-5 h-5" />
                <span>Backup & Restauração</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Gerencie backups e restauração das configurações
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportConfig} className="flex-1 sm:flex-none">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Configuração
                </Button>
                
                <Button onClick={() => setShowImport(!showImport)} variant="outline" className="flex-1 sm:flex-none">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Configuração
                </Button>
              </div>

              {showImport && (
                <div className="space-y-4 p-6 border rounded-lg bg-muted/50">
                  <Label htmlFor="configJson" className="text-sm font-medium">
                    JSON da Configuração
                  </Label>
                  <textarea
                    id="configJson"
                    className="w-full h-32 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder="Cole aqui o JSON da configuração exportada..."
                  />
                  
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleImportConfig} disabled={!configJson.trim()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar
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
                  <strong>Importante:</strong> Sempre faça backup da configuração antes de fazer alterações importantes.
                  A importação sobrescreverá todas as configurações atuais.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServerManagement;