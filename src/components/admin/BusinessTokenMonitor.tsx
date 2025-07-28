import React, { useState, useEffect } from 'react';
import { useBusinessToken } from '@/hooks/useBusinessToken';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, RefreshCw, Key } from 'lucide-react';

interface BusinessTokenMonitorProps {
  clientId: string;
  instanceId?: string;
}

export const BusinessTokenMonitor: React.FC<BusinessTokenMonitorProps> = ({
  clientId,
  instanceId
}) => {
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid' | 'expired'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { isRegenerating, regenerateToken, validateToken } = useBusinessToken();

  const checkTokenStatus = async () => {
    setTokenStatus('checking');
    
    try {
      const isValid = await validateToken(clientId);
      setTokenStatus(isValid ? 'valid' : 'expired');
      setLastCheck(new Date());
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      setTokenStatus('invalid');
      setLastCheck(new Date());
    }
  };

  const handleRegenerateToken = async () => {
    const result = await regenerateToken(clientId);
    
    if (result.success) {
      setTokenStatus('valid');
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    checkTokenStatus();
    
    // Verificar a cada 5 minutos
    const interval = setInterval(checkTokenStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [clientId]);

  const getStatusBadge = () => {
    switch (tokenStatus) {
      case 'checking':
        return <Badge variant="outline">Verificando...</Badge>;
      case 'valid':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Válido
          </Badge>
        );
      case 'expired':
      case 'invalid':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {tokenStatus === 'expired' ? 'Expirado' : 'Inválido'}
          </Badge>
        );
    }
  };

  const getStatusIcon = () => {
    switch (tokenStatus) {
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'expired':
      case 'invalid':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Key className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">Business Token</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Status do token de autenticação para envio de mensagens
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {(tokenStatus === 'expired' || tokenStatus === 'invalid') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O business token está {tokenStatus === 'expired' ? 'expirado' : 'inválido'}. 
              Isto pode impedir o envio de mensagens pelo assistente. 
              Clique em "Regenerar Token" para resolver o problema.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Cliente ID:</span>
            <p className="font-mono text-xs mt-1">{clientId}</p>
          </div>
          {instanceId && (
            <div>
              <span className="font-medium text-muted-foreground">Instância:</span>
              <p className="font-mono text-xs mt-1">{instanceId}</p>
            </div>
          )}
        </div>

        {lastCheck && (
          <div className="text-sm text-muted-foreground">
            Última verificação: {lastCheck.toLocaleString('pt-BR')}
          </div>
        )}

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkTokenStatus}
            disabled={tokenStatus === 'checking'}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${tokenStatus === 'checking' ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
          
          <Button
            variant={tokenStatus === 'valid' ? 'outline' : 'default'}
            size="sm"
            onClick={handleRegenerateToken}
            disabled={isRegenerating}
          >
            <Key className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerando...' : 'Regenerar Token'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};