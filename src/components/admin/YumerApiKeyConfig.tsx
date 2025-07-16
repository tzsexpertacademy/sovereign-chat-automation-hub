import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Key, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getYumerGlobalApiKey, 
  setYumerGlobalApiKey, 
  clearYumerGlobalApiKey, 
  hasYumerGlobalApiKey 
} from '@/config/environment';
import { yumerJwtService } from '@/services/yumerJwtService';

export const YumerApiKeyConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // JWT Configuration
  const [jwtSecret, setJwtSecret] = useState('');
  const [instanceName, setInstanceName] = useState('yumer01');
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [generatedJWT, setGeneratedJWT] = useState('');
  const [jwtLoading, setJwtLoading] = useState(false);

  useEffect(() => {
    const currentKey = getYumerGlobalApiKey();
    setIsConfigured(hasYumerGlobalApiKey());
    if (currentKey) {
      setApiKey(currentKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('Por favor, insira uma API Key válida');
      return;
    }

    setIsLoading(true);
    console.log('🔄 Tentando salvar API Key:', apiKey.trim());
    
    try {
      setYumerGlobalApiKey(apiKey.trim());
      
      // Verificar se foi salvo
      const savedKey = getYumerGlobalApiKey();
      console.log('✅ API Key salva:', savedKey);
      console.log('📋 LocalStorage yumer_global_api_key:', localStorage.getItem('yumer_global_api_key'));
      
      setIsConfigured(true);
      toast.success('API Key configurada com sucesso!', {
        description: 'A autenticação agora funcionará com o backend YUMER'
      });
    } catch (error) {
      toast.error('Erro ao salvar API Key');
      console.error('❌ Error saving API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveApiKey = () => {
    setIsLoading(true);
    
    try {
      clearYumerGlobalApiKey();
      setApiKey('');
      setIsConfigured(false);
      toast.success('API Key removida com sucesso');
    } catch (error) {
      toast.error('Erro ao remover API Key');
      console.error('Error removing API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  const toggleShowJwtSecret = () => {
    setShowJwtSecret(!showJwtSecret);
  };

  const handleGenerateJWT = () => {
    if (!jwtSecret.trim()) {
      toast.error('Por favor, insira a JWT Secret');
      return;
    }
    
    if (!instanceName.trim()) {
      toast.error('Por favor, insira o Instance Name');
      return;
    }

    setJwtLoading(true);
    
    try {
      const token = yumerJwtService.generateLocalJWT(jwtSecret.trim(), instanceName.trim());
      setGeneratedJWT(token);
      
      toast.success('JWT gerado com sucesso!', {
        description: 'Token JWT pronto para uso no WebSocket'
      });
    } catch (error: any) {
      toast.error('Erro ao gerar JWT');
      console.error('❌ Erro ao gerar JWT:', error);
    } finally {
      setJwtLoading(false);
    }
  };

  const copyJWTToClipboard = () => {
    navigator.clipboard.writeText(generatedJWT);
    toast.success('JWT copiado para a área de transferência');
  };

  const getStatusInfo = () => {
    if (isConfigured) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        status: 'Configurada',
        variant: 'default' as const,
        description: 'API Key está configurada e funcionando'
      };
    } else {
      return {
        icon: <XCircle className="h-4 w-4 text-red-500" />,
        status: 'Não Configurada',
        variant: 'destructive' as const,
        description: 'API Key necessária para acessar APIs do YUMER'
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Configuração API Key YUMER</CardTitle>
          </div>
          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
            {statusInfo.icon}
            {statusInfo.status}
          </Badge>
        </div>
        <CardDescription>
          Configure a API Key global para autenticação com o backend YUMER
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">Global API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Insira a API Key global do YUMER"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={toggleShowApiKey}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button 
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {isConfigured && (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                API Key configurada e ativa
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRemoveApiKey}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              {isLoading ? 'Removendo...' : 'Remover'}
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• A API Key será usada para todas as requisições autenticadas</p>
          <p>• A configuração é salva localmente no navegador</p>
          <p>• Reinicie a aplicação após configurar para garantir funcionamento completo</p>
        </div>

        <Separator className="my-6" />

        {/* Seção de Configuração JWT */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Configuração JWT para WebSocket</h3>
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O backend YUMER espera um JWT válido no WebSocket. Use a secret: <code className="font-mono bg-muted px-1 rounded">sfdgs8152g5s1s5</code>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* JWT Secret */}
            <div className="space-y-2">
              <Label htmlFor="jwtSecret">JWT Secret</Label>
              <div className="relative">
                <Input
                  id="jwtSecret"
                  type={showJwtSecret ? 'text' : 'password'}
                  value={jwtSecret}
                  onChange={(e) => setJwtSecret(e.target.value)}
                  placeholder="sfdgs8152g5s1s5"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={toggleShowJwtSecret}
                >
                  {showJwtSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Instance Name */}
            <div className="space-y-2">
              <Label htmlFor="instanceName">Instance Name</Label>
              <Input
                id="instanceName"
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="yumer01"
              />
            </div>
          </div>

          {/* Gerar JWT */}
          <div className="flex gap-2">
            <Button 
              onClick={handleGenerateJWT}
              disabled={!jwtSecret.trim() || !instanceName.trim() || jwtLoading}
              className="shrink-0"
            >
              {jwtLoading ? 'Gerando...' : 'Gerar JWT'}
            </Button>
          </div>

          {/* JWT Gerado */}
          {generatedJWT && (
            <div className="space-y-2">
              <Label>JWT Gerado</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedJWT}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyJWTToClipboard}
                  className="shrink-0"
                >
                  Copiar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>• Este JWT nunca expira (EXPIRES_IN=0)</p>
                <p>• Use na URL: <code className="font-mono bg-muted px-1 rounded">wss://146.59.227.248:8083/ws/events?event=MESSAGE_RECEIVED&token=SEU_JWT</code></p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};