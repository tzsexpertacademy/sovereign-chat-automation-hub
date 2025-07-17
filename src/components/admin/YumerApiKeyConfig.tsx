import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Key, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { getYumerGlobalApiKey, setYumerGlobalApiKey, clearYumerGlobalApiKey } from "@/config/environment";
import { useToast } from '@/hooks/use-toast';

const YumerApiKeyConfig = () => {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const currentKey = getYumerGlobalApiKey();
    if (currentKey) {
      setApiKey(currentKey);
      setIsConfigured(true);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Inválida",
        description: "Digite uma API Key válida",
        variant: "destructive"
      });
      return;
    }

    setYumerGlobalApiKey(apiKey.trim());
    setIsConfigured(true);
    
    toast({
      title: "API Key Configurada",
      description: "API Key do YUMER salva com sucesso",
    });
  };

  const handleClearApiKey = () => {
    clearYumerGlobalApiKey();
    setApiKey('');
    setIsConfigured(false);
    
    toast({
      title: "API Key Removida",
      description: "API Key do YUMER foi removida",
    });
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Necessária",
        description: "Configure uma API Key antes de testar",
        variant: "destructive"
      });
      return;
    }

    setIsTestingKey(true);
    
    try {
      const response = await fetch('https://yumer.yumerflow.app:8083/instance/fetchInstances', {
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey.trim()
        }
      });

      if (response.ok) {
        toast({
          title: "API Key Válida",
          description: "API Key testada com sucesso - conectando ao YUMER",
        });
      } else if (response.status === 403) {
        toast({
          title: "API Key Inválida",
          description: "A API Key não tem permissões ou está incorreta",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro no Teste",
          description: `HTTP ${response.status} - Verificar servidor YUMER`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor YUMER",
        variant: "destructive"
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const maskedApiKey = apiKey ? `${apiKey.substring(0, 8)}${'*'.repeat(Math.max(0, apiKey.length - 12))}${apiKey.substring(Math.max(8, apiKey.length - 4))}` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Configuração API Key YUMER</span>
          </div>
          {isConfigured ? (
            <Badge className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configurada
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              Não Configurada
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-700">API Key necessária</p>
                <p className="text-sm text-yellow-600 mt-1">
                  Configure sua API Key do YUMER para usar os recursos de WhatsApp
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Digite sua API Key do YUMER..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
              Salvar API Key
            </Button>
            
            <Button 
              onClick={testApiKey} 
              variant="outline" 
              disabled={!apiKey.trim() || isTestingKey}
            >
              {isTestingKey ? 'Testando...' : 'Testar'}
            </Button>
            
            {isConfigured && (
              <Button onClick={handleClearApiKey} variant="destructive">
                Remover
              </Button>
            )}
          </div>
        </div>

        {isConfigured && (
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-muted-foreground">
              <strong>API Key atual:</strong> {showKey ? apiKey : maskedApiKey}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Como obter sua API Key:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Acesse o painel administrativo do YUMER</li>
            <li>Vá para configurações de API</li>
            <li>Gere ou copie sua API Key</li>
            <li>Cole aqui e clique em "Salvar"</li>
          </ol>
          <p className="mt-2">
            <strong>Nota:</strong> A API Key é armazenada localmente no seu navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default YumerApiKeyConfig;