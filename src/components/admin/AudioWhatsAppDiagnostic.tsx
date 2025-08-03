import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Play, Download } from "lucide-react";

export const AudioWhatsAppDiagnostic = () => {
  const [testing, setTesting] = useState(false);
  const [messageId, setMessageId] = useState("");
  const [results, setResults] = useState("");
  const [audioData, setAudioData] = useState<string | null>(null);
  const { toast } = useToast();

  const testWhatsAppAudio = async () => {
    if (!messageId.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o ID da mensagem",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setResults("🔄 Iniciando teste de áudio WhatsApp...\n");
    setAudioData(null);

    try {
      // Buscar mensagem no banco
      setResults(prev => prev + "🔍 Buscando mensagem no banco...\n");
      
      const { data: message, error: messageError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (messageError) {
        setResults(prev => prev + `❌ Erro ao buscar mensagem: ${messageError.message}\n`);
        return;
      }

      if (!message) {
        setResults(prev => prev + "❌ Mensagem não encontrada\n");
        return;
      }

      setResults(prev => prev + "✅ Mensagem encontrada\n");
      setResults(prev => prev + `📄 Tipo: ${(message as any).type || 'N/A'}\n`);
      setResults(prev => prev + `🔗 Media URL: ${(message as any).media_url || 'N/A'}\n`);
      setResults(prev => prev + `🎵 Audio Base64: ${(message as any).audio_base64 ? 'Presente' : 'Ausente'}\n`);

      // Testar decriptação se necessário
      if ((message as any).media_url && !(message as any).audio_base64) {
        setResults(prev => prev + "🔓 Testando decriptação de áudio...\n");
        
        try {
          const { data: decryptData, error: decryptError } = await supabase.functions.invoke('whatsapp-decrypt-audio', {
            body: { messageId: messageId }
          });

          if (decryptError) {
            setResults(prev => prev + `❌ Erro na decriptação: ${decryptError.message}\n`);
          } else {
            setResults(prev => prev + "✅ Áudio decriptado com sucesso\n");
            if (decryptData?.audioBase64) {
              setAudioData(decryptData.audioBase64);
              setResults(prev => prev + `📊 Tamanho do áudio: ${decryptData.audioBase64.length} chars\n`);
            }
          }
        } catch (decryptError) {
          setResults(prev => prev + `❌ Erro na decriptação: ${decryptError}\n`);
        }
      } else if ((message as any).audio_base64) {
        setAudioData((message as any).audio_base64);
        setResults(prev => prev + "✅ Audio base64 já disponível\n");
      }

      // Testar transcrição se temos áudio
      if (audioData || (message as any).audio_base64) {
        setResults(prev => prev + "🎤 Testando transcrição...\n");
        
        try {
          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('speech-to-text', {
            body: { 
              audio: audioData || (message as any).audio_base64,
              messageId: messageId
            }
          });

          if (transcriptError) {
            setResults(prev => prev + `❌ Erro na transcrição: ${transcriptError.message}\n`);
          } else {
            setResults(prev => prev + "✅ Transcrição realizada\n");
            setResults(prev => prev + `📝 Texto: ${transcriptData?.text || 'Nenhum texto detectado'}\n`);
          }
        } catch (transcriptError) {
          setResults(prev => prev + `❌ Erro na transcrição: ${transcriptError}\n`);
        }
      }

    } catch (error) {
      console.error('Erro no teste WhatsApp:', error);
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

  const downloadAudio = () => {
    if (!audioData) return;

    try {
      const byteCharacters = atob(audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/ogg' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${messageId}.ogg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download iniciado",
        description: "O arquivo de áudio foi baixado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo de áudio",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Diagnóstico de Áudio WhatsApp
          </CardTitle>
          <CardDescription>
            Testa decriptação e transcrição de áudios recebidos via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="messageId">ID da Mensagem</Label>
            <Input
              id="messageId"
              value={messageId}
              onChange={(e) => setMessageId(e.target.value)}
              placeholder="ID da mensagem de áudio para testar"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testWhatsAppAudio} 
              disabled={testing}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              {testing ? "Testando..." : "Executar Teste"}
            </Button>
            
            {audioData && (
              <Button 
                onClick={downloadAudio}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Áudio
              </Button>
            )}
          </div>
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
          <CardTitle>Pipeline de Processamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Fluxo de Áudio WhatsApp:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Mensagem recebida via webhook</li>
              <li>URL de mídia armazenada em <code>media_url</code></li>
              <li>Edge function <code>whatsapp-decrypt-audio</code> decripta</li>
              <li>Audio base64 salvo em <code>audio_base64</code></li>
              <li>Edge function <code>speech-to-text</code> transcreve</li>
              <li>Texto processado pelo assistente IA</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};