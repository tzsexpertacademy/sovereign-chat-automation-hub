import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export function EmergencyImageFix() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runEmergencyFix = async () => {
    setIsFixing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('force-image-processing-emergency');
      
      if (error) {
        setResult({ 
          success: false, 
          error: error.message,
          details: 'Erro ao executar correção emergencial'
        });
      } else {
        setResult({ 
          success: true, 
          ...data,
          details: 'Correção emergencial executada com sucesso'
        });
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        error: error.message,
        details: 'Erro de conexão com a função emergencial'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-red-600">🚨 Correção Emergencial de Imagem</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Força o processamento da mensagem de imagem específica que falhou (3EB07072704AA397730C7E).
          Inclui descriptografia forçada e reprocessamento do batch.
        </p>
        
        <Button 
          onClick={runEmergencyFix}
          disabled={isFixing}
          variant="destructive"
          className="w-full"
        >
          {isFixing ? 'Executando Correção...' : '🚨 Executar Correção Emergencial'}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <AlertDescription>
              <div className="space-y-2">
                <div><strong>Status:</strong> {result.success ? '✅ Sucesso' : '❌ Erro'}</div>
                <div><strong>Detalhes:</strong> {result.details}</div>
                {result.error && <div><strong>Erro:</strong> {result.error}</div>}
                {result.analysis && <div><strong>Análise:</strong> {result.analysis}</div>}
                {result.messageId && <div><strong>Message ID:</strong> {result.messageId}</div>}
                {result.reprocessed !== undefined && (
                  <div><strong>Batch Reprocessado:</strong> {result.reprocessed ? 'Sim' : 'Não'}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}