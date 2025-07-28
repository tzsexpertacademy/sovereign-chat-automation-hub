import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { businessTokenService } from '@/services/businessTokenService';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface BusinessTokenRegeneratorProps {
  clientId: string;
}

export function BusinessTokenRegenerator({ clientId }: BusinessTokenRegeneratorProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastRegeneration, setLastRegeneration] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    
    try {
      console.log('🔄 [TOKEN-REGENERATOR] Iniciando regeneração para cliente:', clientId);
      
      const result = await businessTokenService.regenerateBusinessToken(clientId);
      
      if (result.success) {
        setLastRegeneration(new Date());
        toast({
          title: "✅ Token Regenerado",
          description: `Business token renovado com sucesso. Expira em: ${result.expiresAt?.toLocaleString()}`,
        });
        
        console.log('✅ [TOKEN-REGENERATOR] Token regenerado com sucesso:', {
          tokenLength: result.token?.length,
          expiresAt: result.expiresAt
        });
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('❌ [TOKEN-REGENERATOR] Erro ao regenerar token:', error);
      toast({
        title: "❌ Erro na Regeneração",
        description: error.message || 'Erro ao regenerar business token',
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Regenerador de Business Token
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Cliente ID:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded">{clientId}</code>
          </div>
          
          {lastRegeneration && (
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Regenerado: {lastRegeneration.toLocaleTimeString()}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <strong>Importante:</strong> Regenerar o token irá invalidar o token atual e criar um novo com 4 horas de validade.
          </div>
        </div>

        <Button 
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="w-full"
        >
          {isRegenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Regenerando Token...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar Business Token
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}