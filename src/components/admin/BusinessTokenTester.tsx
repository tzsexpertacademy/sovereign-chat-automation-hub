import React, { useState } from 'react';
import { BusinessTokenMonitor } from './BusinessTokenMonitor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBusinessToken } from '@/hooks/useBusinessToken';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Play } from 'lucide-react';

export const BusinessTokenTester: React.FC = () => {
  const [clientId, setClientId] = useState('35f36a03-39b2-412c-bba6-01fdd45c2dd3'); // Cliente de teste
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const { getValidToken } = useBusinessToken();

  const testTokenGeneration = async () => {
    if (!clientId) return;
    
    setIsTestingToken(true);
    setTestResult(null);
    
    try {
      console.log('🧪 [TOKEN-TEST] Iniciando teste de token para cliente:', clientId);
      
      // Testar obtenção de token válido
      const token = await getValidToken(clientId);
      
      if (token) {
        // Decodificar token para mostrar informações
        try {
          const tokenParts = token.split('.');
          const header = JSON.parse(atob(tokenParts[0]));
          const payload = JSON.parse(atob(tokenParts[1]));
          
          setTestResult({
            success: true,
            token: token.substring(0, 50) + '...',
            header,
            payload,
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            isValid: Date.now() < (payload.exp * 1000)
          });
        } catch (decodeError) {
          setTestResult({
            success: true,
            token: token.substring(0, 50) + '...',
            error: 'Não foi possível decodificar o token',
            raw: token
          });
        }
      } else {
        setTestResult({
          success: false,
          error: 'Não foi possível obter token válido'
        });
      }
    } catch (error: any) {
      console.error('❌ [TOKEN-TEST] Erro no teste:', error);
      setTestResult({
        success: false,
        error: error.message || 'Erro desconhecido'
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Testador de Business Token</CardTitle>
          <CardDescription>
            Ferramenta para testar a geração e validação de business tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Cliente ID</Label>
            <Input
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="UUID do cliente"
            />
          </div>
          
          <Button 
            onClick={testTokenGeneration}
            disabled={!clientId || isTestingToken}
            className="w-full"
          >
            <Play className={`w-4 h-4 mr-2 ${isTestingToken ? 'animate-spin' : ''}`} />
            {isTestingToken ? 'Testando...' : 'Testar Geração de Token'}
          </Button>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">
                    {testResult.success ? 'Token obtido com sucesso!' : 'Erro ao obter token'}
                  </div>
                  
                  {testResult.error && (
                    <div className="text-sm text-red-600">
                      <strong>Erro:</strong> {testResult.error}
                    </div>
                  )}
                  
                  {testResult.token && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Token:</strong>
                        <code className="block mt-1 p-2 bg-gray-100 rounded text-xs break-all">
                          {testResult.token}
                        </code>
                      </div>
                      
                      {testResult.payload && (
                        <>
                          <div>
                            <strong>Expira em:</strong> {testResult.expiresAt}
                          </div>
                          <div>
                            <strong>Status:</strong>{' '}
                            <span className={testResult.isValid ? 'text-green-600' : 'text-red-600'}>
                              {testResult.isValid ? 'Válido' : 'Expirado'}
                            </span>
                          </div>
                          <div>
                            <strong>Payload:</strong>
                            <Textarea
                              className="mt-1 font-mono text-xs"
                              value={JSON.stringify(testResult.payload, null, 2)}
                              readOnly
                              rows={8}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {clientId && (
        <BusinessTokenMonitor 
          clientId={clientId}
          instanceId="df819481-e19b-41ce-ab0e-abfc1bae1dac"
        />
      )}
    </div>
  );
};