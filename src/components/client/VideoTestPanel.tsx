import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function VideoTestPanel() {
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAIDirectly = async () => {
    setIsTestingAI(true);
    setError(null);
    setResults(null);

    try {
      console.log('🧪 [VIDEO-TEST] Testando AI diretamente...');

      const { data, error } = await supabase.functions.invoke('test-ai-video-command', {
        body: {}
      });

      if (error) {
        throw new Error(error.message || 'Erro na chamada da edge function');
      }

      setResults(data);
      toast({
        title: "Teste Concluído",
        description: data.success ? "AI processou o comando com sucesso!" : "AI falhou no processamento",
        variant: data.success ? "default" : "destructive"
      });

    } catch (err: any) {
      console.error('🧪 [VIDEO-TEST] Erro:', err);
      setError(err.message);
      toast({
        title: "Erro no Teste",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  const testWebhookFlow = async () => {
    setIsTestingWebhook(true);
    setError(null);
    setResults(null);

    try {
      console.log('🧪 [VIDEO-TEST] Testando fluxo completo via webhook...');

      // Simular webhook call
      const webhookUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-unified-webhook';
      
      const mockWebhookData = {
        event: 'messages.upsert',
        instance: {
          instanceId: '01K11NBE1QB0GVFMME8NA4YPCB',
          name: 'Thalis Teste'
        },
        data: {
          keyRemoteJid: '554796451886@s.whatsapp.net',
          keyId: 'TEST_' + Date.now(),
          keyFromMe: false,
          pushName: 'Thalis Zulianello Silva',
          content: {
            text: 'video testeoficial'
          },
          contentType: 'text',
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mockWebhookData)
      });

      const result = await response.json();
      
      setResults(result);
      toast({
        title: "Teste Webhook Concluído",
        description: result.success ? "Webhook processou com sucesso!" : "Webhook falhou",
        variant: result.success ? "default" : "destructive"
      });

    } catch (err: any) {
      console.error('🧪 [VIDEO-TEST] Erro webhook:', err);
      setError(err.message);
      toast({
        title: "Erro no Teste Webhook",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Teste de Comando de Vídeo
        </CardTitle>
        <CardDescription>
          Testar o comando "video testeoficial" diretamente na AI e via webhook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={testAIDirectly}
            disabled={isTestingAI}
            className="flex items-center gap-2"
          >
            {isTestingAI ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Testar AI Diretamente
          </Button>

          <Button
            onClick={testWebhookFlow}
            disabled={isTestingWebhook}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isTestingWebhook ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Testar Via Webhook
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={results.success ? "default" : "destructive"}>
                {results.success ? "✅ SUCESSO" : "❌ FALHA"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {results.message}
              </span>
            </div>

            {results.result && (
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(results.result, null, 2)}
                </pre>
              </div>
            )}

            {results.error && (
              <div className="bg-destructive/10 p-3 rounded-md">
                <pre className="text-xs text-destructive overflow-auto">
                  {JSON.stringify(results.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}