import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function ImageProcessingTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testImageProcessing = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      console.log('🧪 Iniciando teste de processamento de imagem...');
      
      const { data, error } = await supabase.functions.invoke('test-image-processing', {
        body: {}
      });
      
      if (error) {
        throw error;
      }
      
      setResult(data);
      toast.success('Processamento de imagem executado com sucesso!');
      console.log('✅ Resultado:', data);
      
    } catch (error: any) {
      console.error('❌ Erro no teste:', error);
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>🧪 Teste de Processamento de Imagem</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button 
            onClick={testImageProcessing}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Testando...' : '🖼️ Testar Processamento Imagem'}
          </Button>
        </div>
        
        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">✅ Resultado do Teste</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Message ID:</strong> {result.messageId}</p>
                <p><strong>Image Size:</strong> {result.imageSize} bytes</p>
                <p><strong>Success:</strong> {result.success ? 'Sim' : 'Não'}</p>
              </div>
            </div>
            
            {result.analysis && (
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">🖼️ Análise da Imagem</h3>
                <p className="text-sm whitespace-pre-wrap">{result.analysis}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}