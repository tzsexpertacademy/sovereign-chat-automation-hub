import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { businessTokenService } from '@/services/businessTokenService';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, AlertTriangle, Copy } from 'lucide-react';

export function QuickBusinessTokenRegenerator() {
  const [clientId, setClientId] = useState('35f36a03-39b2-412c-bba6-01fdd45c2dd3'); // ID padrão para teste
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    if (!clientId.trim()) {
      toast({
        title: "❌ Cliente ID Necessário",
        description: "Por favor, insira um Client ID válido",
        variant: "destructive"
      });
      return;
    }

    setIsRegenerating(true);
    
    try {
      console.log('🔄 [QUICK-REGENERATOR] Regenerando token para cliente:', clientId);
      
      const result = await businessTokenService.regenerateBusinessToken(clientId);
      
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "✅ Token Regenerado!",
          description: `Business token renovado com sucesso. Expira em: ${result.expiresAt?.toLocaleString()}`,
        });
        
        console.log('✅ [QUICK-REGENERATOR] Sucesso:', {
          tokenLength: result.token?.length,
          expiresAt: result.expiresAt
        });
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('❌ [QUICK-REGENERATOR] Erro:', error);
      setLastResult({ success: false, error: error.message });
      
      toast({
        title: "❌ Erro na Regeneração",
        description: error.message || 'Erro ao regenerar business token',
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyClientId = () => {
    navigator.clipboard.writeText(clientId);
    toast({
      title: "📋 Copiado!",
      description: "Client ID copiado para a área de transferência",
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Regenerador Rápido de Business Token
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ferramenta para regenerar business tokens expirados rapidamente
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Input do Client ID */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium">Client ID:</label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="35f36a03-39b2-412c-bba6-01fdd45c2dd3"
              className="font-mono text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={copyClientId}
            className="mt-6"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {/* Botão de Regenerar */}
        <Button 
          onClick={handleRegenerate}
          disabled={isRegenerating || !clientId.trim()}
          className="w-full"
          size="lg"
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

        {/* Resultado */}
        {lastResult && (
          <div className={`p-4 rounded-lg border ${
            lastResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Sucesso
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-700 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Erro
                </Badge>
              )}
            </div>
            
            {lastResult.success ? (
              <div className="space-y-2 text-sm">
                <p><strong>Token Length:</strong> {lastResult.token?.length} chars</p>
                <p><strong>Expira em:</strong> {lastResult.expiresAt?.toLocaleString()}</p>
                <p className="text-green-700">✅ Business token regenerado e salvo no banco!</p>
              </div>
            ) : (
              <p className="text-sm text-red-700">
                <strong>Erro:</strong> {lastResult.error}
              </p>
            )}
          </div>
        )}

        {/* Aviso importante */}
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <strong>Importante:</strong> Regenerar o token irá invalidar o token atual. 
            O novo token terá validade de 4 horas e será automaticamente salvo no banco de dados.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}