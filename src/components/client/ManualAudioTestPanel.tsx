import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { manualAudioTestService } from '@/services/manualAudioTestService';

export const ManualAudioTestPanel = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTestAudio = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      console.log('🧪 Iniciando teste manual de áudio...');
      const testResult = await manualAudioTestService.processLatestAudio();
      setResult(testResult);
      
      if (testResult.success) {
        console.log('✅ Teste concluído com sucesso!');
      } else {
        console.error('❌ Teste falhou:', testResult.error);
      }
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Teste Manual de Processamento de Áudio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Este painel processa manualmente o último áudio não transcrito para testar o sistema.
        </div>
        
        <Button 
          onClick={handleTestAudio}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? '🔄 Processando...' : '🎵 Processar Último Áudio'}
        </Button>
        
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "✅ Sucesso" : "❌ Falha"}
              </Badge>
            </div>
            
            {result.success ? (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-medium text-green-800 dark:text-green-200">
                  Processamento Concluído
                </div>
                <div className="text-sm space-y-1">
                  <div><strong>Message ID:</strong> {result.messageId}</div>
                  <div><strong>Formato:</strong> {result.audioFormat}</div>
                  <div><strong>Transcrição:</strong></div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded text-sm italic">
                    "{result.transcription}"
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-200">
                  Erro no Processamento
                </div>
                <div className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {result.error}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground space-y-1">
          <div>• Verifica os logs do console para detalhes técnicos</div>
          <div>• O hook useAudioAutoProcessor deve estar ativo</div>
          <div>• A edge function speech-to-text deve estar deployada</div>
        </div>
      </CardContent>
    </Card>
  );
};