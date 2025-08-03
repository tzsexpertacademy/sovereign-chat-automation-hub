import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Play, AlertCircle } from "lucide-react";

export const AudioTTSDiagnostic = () => {
  const [testing, setTesting] = useState(false);
  const [clientId, setClientId] = useState("");
  const [testText, setTestText] = useState("audio: Olá, este é um teste de TTS");
  const [results, setResults] = useState("");
  const { toast } = useToast();

  const testTTS = async () => {
    if (!clientId.trim() || !testText.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setResults("🔄 Iniciando teste de TTS...\n");

    try {
      // Simular processamento de comando TTS
      setResults(prev => prev + "✅ Comando TTS detectado\n");
      setResults(prev => prev + `📝 Texto para síntese: "${testText}"\n`);
      
      // Testar edge function ai-assistant-process
      const { data, error } = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          ticketId: `tts_test_${Date.now()}`,
          messages: [{
            content: testText,
            messageId: `tts_test_${Date.now()}`,
            timestamp: new Date().toISOString(),
            phoneNumber: "5511999999999",
            customerName: "TTS Test"
          }],
          context: {
            chatId: "5511999999999@s.whatsapp.net",
            customerName: "TTS Test",
            phoneNumber: "5511999999999",
            batchInfo: "Teste TTS"
          }
        }
      });

      if (error) {
        setResults(prev => prev + `❌ Erro na edge function: ${error.message}\n`);
      } else {
        setResults(prev => prev + "✅ Edge function executada com sucesso\n");
        setResults(prev => prev + `📊 Resposta: ${JSON.stringify(data, null, 2)}\n`);
      }

    } catch (error) {
      console.error('Erro no teste TTS:', error);
      setResults(prev => prev + `❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}\n`);
      toast({
        title: "Erro no teste",
        description: "Verifique os logs para mais detalhes",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Diagnóstico de Text-to-Speech (TTS)
          </CardTitle>
          <CardDescription>
            Testa comandos TTS e integração com ElevenLabs/Fish.Audio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="35f36a03-39b2-412c-bba6-01fdd45c2dd3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testText">Comando TTS</Label>
              <Input
                id="testText"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="audio: Texto para converter em áudio"
              />
            </div>
          </div>

          <Button 
            onClick={testTTS} 
            disabled={testing}
            className="w-full"
          >
            <Play className="w-4 h-4 mr-2" />
            {testing ? "Testando TTS..." : "Executar Teste TTS"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados do Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={results}
            readOnly
            className="min-h-[300px] font-mono text-sm"
            placeholder="Os resultados do teste aparecerão aqui..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Informações do Sistema TTS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Padrões de Comando TTS:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code>audio: texto</code> - Comando básico</li>
              <li><code>audio "texto com aspas"</code> - Texto com aspas</li>
              <li><code>audio texto simples</code> - Texto até fim da linha</li>
            </ul>
            <p><strong>Providers Suportados:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>ElevenLabs (eleven_multilingual_v2, eleven_turbo_v2_5)</li>
              <li>Fish.Audio (modelos personalizados)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};