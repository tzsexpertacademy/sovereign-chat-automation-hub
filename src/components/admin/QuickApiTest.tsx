import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import yumerApiV2 from '@/services/yumerApiV2Service';
import { getYumerGlobalApiKey, setYumerGlobalApiKey } from '@/config/environment';

export const QuickApiTest: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    // Carregar API key atual
    const currentKey = getYumerGlobalApiKey();
    if (currentKey) {
      setApiKey(currentKey);
    }
  }, []);

  const handleConfigureApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('API Key não pode estar vazia');
      return;
    }

    try {
      // Configurar API key no serviço
      yumerApiV2.setGlobalApiKey(apiKey);
      setYumerGlobalApiKey(apiKey);
      toast.success('API Key configurada com sucesso!');
    } catch (error) {
      console.error('Erro ao configurar API key:', error);
      toast.error('Erro ao configurar API key');
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // Testar conexão com API
      const health = await yumerApiV2.checkServerHealth();
      setTestResult({
        success: true,
        health,
        message: 'Conexão estabelecida com sucesso!'
      });
      toast.success('✅ API funcionando corretamente!');
    } catch (error: any) {
      console.error('Erro no teste de conexão:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha na conexão com a API'
      });
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSendMessage = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    try {
      // Testar envio de mensagem para instância existente com externalAttributes
      const result = await yumerApiV2.sendText(
        '01K0YMVG844Q7FHPSPN0CDZ0T5',
        '5511999999999',
        'Teste de mensagem do sistema v2.2.1 ✅',
        {
          delay: 800,
          presence: 'composing',
          externalAttributes: {
            source: 'lovable-test',
            timestamp: Date.now(),
            testId: 'api-v2.2.1-test'
          }
        }
      );
      
      setTestResult({
        success: true,
        result,
        message: 'Mensagem de teste enviada com sucesso!'
      });
      toast.success('✅ Mensagem enviada!');
    } catch (error: any) {
      console.error('Erro no envio de mensagem:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha no envio da mensagem'
      });
      
      if (error.message.includes('401')) {
        toast.error('❌ API Key inválida ou expirada');
      } else {
        toast.error(`❌ Erro: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAdvanced = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    try {
      // Testar funcionalidades avançadas
      await yumerApiV2.sendButtons(
        '01K0YMVG844Q7FHPSPN0CDZ0T5',
        '5511999999999',
        'Menu de Teste',
        'Escolha uma opção:',
        [
          { type: 'reply', displayText: 'Opção 1', id: 'opt1' },
          { type: 'reply', displayText: 'Opção 2', id: 'opt2' }
        ]
      );
      
      setTestResult({
        success: true,
        message: 'Botões interativos enviados com sucesso!'
      });
      toast.success('✅ Funcionalidades avançadas funcionando!');
    } catch (error: any) {
      console.error('Erro no teste avançado:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha no teste avançado'
      });
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    try {
      // Configurar webhook automaticamente
      const result = await yumerApiV2.configureInstanceWebhook('01K0YMVG844Q7FHPSPN0CDZ0T5');
      
      setTestResult({
        success: result,
        message: result ? 'Webhook configurado com sucesso!' : 'Falha ao configurar webhook'
      });
      
      if (result) {
        toast.success('✅ Webhook configurado para receber mensagens em tempo real!');
      } else {
        toast.error('❌ Falha ao configurar webhook');
      }
    } catch (error: any) {
      console.error('Erro ao configurar webhook:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha na configuração do webhook'
      });
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔧 Teste Rápido da API v2.2.1</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuração da API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key Global</Label>
          <div className="flex gap-2">
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Insira sua API Key do Yumer"
              className="flex-1"
            />
            <Button onClick={handleConfigureApiKey} variant="outline">
              Configurar
            </Button>
          </div>
        </div>

        {/* Botões de Teste */}
        <div className="flex gap-2">
          <Button 
            onClick={handleTestConnection}
            disabled={isLoading}
            variant="default"
          >
            {isLoading ? 'Testando...' : 'Testar Conexão'}
          </Button>
          
          <Button 
            onClick={handleTestSendMessage}
            disabled={isLoading || !apiKey.trim()}
            variant="secondary"
          >
            {isLoading ? 'Enviando...' : 'Testar Envio'}
          </Button>

          <Button 
            onClick={handleTestAdvanced}
            disabled={isLoading || !apiKey.trim()}
            variant="outline"
          >
            {isLoading ? 'Testando...' : 'Testar Avançado'}
          </Button>

          <Button 
            onClick={handleTestWebhook}
            disabled={isLoading || !apiKey.trim()}
            variant="secondary"
          >
            {isLoading ? 'Configurando...' : 'Config. Webhook'}
          </Button>
        </div>

        {/* Resultado do Teste */}
        {testResult && (
          <Card className={`border-l-4 ${testResult.success ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
            <CardContent className="pt-4">
              <h4 className={`font-semibold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.success ? '✅ Sucesso' : '❌ Erro'}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {testResult.message}
              </p>
              {testResult.error && (
                <code className="block text-xs bg-gray-100 p-2 mt-2 rounded">
                  {testResult.error}
                </code>
              )}
              {testResult.result && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer">Ver detalhes</summary>
                  <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto">
                    {JSON.stringify(testResult.result, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};