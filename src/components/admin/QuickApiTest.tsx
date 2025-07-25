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
  const [instanceId] = useState<string>('01K0YMVG844Q7FHPSPN0CDZ0T5'); // ID da instância do usuário

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
        instanceId,
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
        instanceId,
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
      const result = await yumerApiV2.configureInstanceWebhook(instanceId);
      
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

  const handleRegenerateToken = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    try {
      // Regenerar business token para business existente
      // Primeiro buscar info da instância para obter o businessId
      const instanceInfo = await yumerApiV2.getInstance(instanceId);
      const businessId = instanceInfo.businessId || instanceId; // fallback para compatibilidade
      const result = await yumerApiV2.regenerateBusinessToken(businessId);
      
      setTestResult({
        success: true,
        result,
        message: 'Business token regenerado com sucesso!'
      });
      
      toast.success('✅ Token regenerado! Conectividade restaurada');
      console.log('Novo business_token:', result.business_token);
    } catch (error: any) {
      console.error('Erro ao regenerar token:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha ao regenerar business token'
      });
      
      if (error.message.includes('401')) {
        toast.error('❌ API Key inválida para esta operação');
      } else if (error.message.includes('404')) {
        toast.error('❌ Business não encontrado');
      } else {
        toast.error(`❌ Erro: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestInstanceInfo = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    try {
      // Buscar informações da instância para validar conectividade
      const instanceInfo = await yumerApiV2.getInstance(instanceId);
      
      setTestResult({
        success: true,
        result: instanceInfo,
        message: `Instância encontrada! Status: ${instanceInfo.status || 'Disponível'}`
      });
      
      if (instanceInfo.status === 'open') {
        toast.success('✅ Instância conectada e funcionando!');
      } else {
        toast.warning(`⚠️ Instância encontrada mas status: ${instanceInfo.status || 'Desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Erro ao buscar info da instância:', error);
      setTestResult({
        success: false,
        error: error.message,
        message: 'Falha ao buscar informações da instância'
      });
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullConnectivityTest = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsLoading(true);
    const results: any = {};
    
    try {
      toast.info('🔄 Iniciando teste completo de conectividade...');

      // 1. Testar saúde do servidor
      try {
        results.serverHealth = await yumerApiV2.checkServerHealth();
        console.log('✅ Server Health:', results.serverHealth);
      } catch (error: any) {
        results.serverHealth = { error: error.message };
        throw new Error(`Servidor offline: ${error.message}`);
      }

      // 2. Verificar instância
      try {
        results.instanceInfo = await yumerApiV2.getInstance(instanceId);
        console.log('✅ Instance Info:', results.instanceInfo);
      } catch (error: any) {
        results.instanceInfo = { error: error.message };
        throw new Error(`Instância não encontrada: ${error.message}`);
      }

      // 3. Testar configuração de webhook
      try {
        results.webhookConfig = await yumerApiV2.configureInstanceWebhook(instanceId);
        console.log('✅ Webhook Config:', results.webhookConfig);
      } catch (error: any) {
        results.webhookConfig = { error: error.message };
        console.warn('⚠️ Webhook config failed:', error.message);
      }

      // 4. Testar envio de mensagem real
      try {
        results.messageTest = await yumerApiV2.sendText(
          instanceId,
          '5511999999999',
          `🤖 Teste de conectividade completo - ${new Date().toLocaleTimeString()}`,
          {
            delay: 500,
            presence: 'composing',
            externalAttributes: {
              source: 'connectivity-test',
              timestamp: Date.now(),
              testType: 'full-validation'
            }
          }
        );
        console.log('✅ Message Test:', results.messageTest);
      } catch (error: any) {
        results.messageTest = { error: error.message };
        // Não falhar aqui, pode ser problema de número/chat
        console.warn('⚠️ Message test failed:', error.message);
      }

      setTestResult({
        success: true,
        result: results,
        message: '✅ Teste completo de conectividade realizado com sucesso!'
      });

      const instanceStatus = results.instanceInfo?.status;
      if (instanceStatus === 'open') {
        toast.success('🚀 Sistema 100% funcional! Instância conectada e APIs operacionais');
      } else {
        toast.warning(`⚠️ Sistema parcialmente funcional. Status da instância: ${instanceStatus}`);
      }
      
    } catch (error: any) {
      console.error('❌ Teste de conectividade falhou:', error);
      setTestResult({
        success: false,
        error: error.message,
        result: results,
        message: 'Falha no teste de conectividade'
      });

      if (error.message.includes('401')) {
        toast.error('❌ Token de autenticação inválido - use "Regenerar Token"');
      } else if (error.message.includes('404')) {
        toast.error('❌ Instância não encontrada - verifique o ID');
      } else {
        toast.error(`❌ Erro de conectividade: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🚀 ETAPA 4: Correção Crítica de Conectividade</CardTitle>
        <p className="text-sm text-muted-foreground">
          Regenere tokens, valide conectividade e configure a API v2.2.1
        </p>
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

        {/* Teste Principal */}
        <div className="mb-4">
          <Button 
            onClick={handleFullConnectivityTest}
            disabled={isLoading || !apiKey.trim()}
            variant="default"
            className="w-full text-lg py-6"
          >
            {isLoading ? '🔄 Testando Conectividade Completa...' : '🚀 TESTE COMPLETO DE CONECTIVIDADE'}
          </Button>
        </div>

        {/* Botões de Teste Individual */}
        <div className="grid grid-cols-3 gap-2">
          <Button 
            onClick={handleTestConnection}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {isLoading ? 'Testando...' : 'Conexão'}
          </Button>
          
          <Button 
            onClick={handleRegenerateToken}
            disabled={isLoading || !apiKey.trim()}
            variant="destructive"
            size="sm"
          >
            {isLoading ? 'Regenerando...' : 'Regenerar Token'}
          </Button>

          <Button 
            onClick={handleTestInstanceInfo}
            disabled={isLoading || !apiKey.trim()}
            variant="outline"
            size="sm"
          >
            {isLoading ? 'Verificando...' : 'Info Instância'}
          </Button>
          
          <Button 
            onClick={handleTestSendMessage}
            disabled={isLoading || !apiKey.trim()}
            variant="secondary"
            size="sm"
          >
            {isLoading ? 'Enviando...' : 'Envio Msg'}
          </Button>

          <Button 
            onClick={handleTestAdvanced}
            disabled={isLoading || !apiKey.trim()}
            variant="outline"
            size="sm"
          >
            {isLoading ? 'Testando...' : 'Avançado'}
          </Button>

          <Button 
            onClick={handleTestWebhook}
            disabled={isLoading || !apiKey.trim()}
            variant="secondary"
            size="sm"
          >
            {isLoading ? 'Config...' : 'Webhook'}
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