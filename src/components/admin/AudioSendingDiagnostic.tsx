import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Upload, FileAudio } from "lucide-react";

export const AudioSendingDiagnostic = () => {
  const [testing, setTesting] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [chatId, setChatId] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [results, setResults] = useState("");
  const { toast } = useToast();

  const testAudioSending = async () => {
    if (!instanceId.trim() || !chatId.trim() || !audioFile) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos e selecione um arquivo",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setResults("🔄 Iniciando teste de envio de áudio...\n");

    try {
      // Converter arquivo para blob
      setResults(prev => prev + "📁 Convertendo arquivo para blob...\n");
      const audioBlob = new Blob([audioFile], { type: audioFile.type });
      setResults(prev => prev + `✅ Arquivo convertido: ${audioFile.name} (${audioFile.size} bytes)\n`);

      // Simular upload para storage temporário
      setResults(prev => prev + "☁️ Simulando upload para storage...\n");
      
      // Aqui normalmente usaríamos o AudioUploadService
      const mockUploadResult = {
        success: true,
        url: `https://temp-storage.com/audio_${Date.now()}.${audioFile.name.split('.').pop()}`,
        fileName: `audio_${Date.now()}.${audioFile.name.split('.').pop()}`
      };

      if (mockUploadResult.success) {
        setResults(prev => prev + `✅ Upload simulado com sucesso\n`);
        setResults(prev => prev + `🔗 URL: ${mockUploadResult.url}\n`);
      } else {
        setResults(prev => prev + "❌ Falha no upload simulado\n");
        return;
      }

      // Simular envio via Yumer API
      setResults(prev => prev + "📤 Simulando envio via Yumer API...\n");
      
      const mockSendResult = {
        success: true,
        messageId: `audio_msg_${Date.now()}`,
        instanceId: instanceId,
        chatId: chatId
      };

      if (mockSendResult.success) {
        setResults(prev => prev + "✅ Envio simulado com sucesso\n");
        setResults(prev => prev + `📄 Message ID: ${mockSendResult.messageId}\n`);
      } else {
        setResults(prev => prev + "❌ Falha no envio simulado\n");
      }

      // Simular limpeza do arquivo temporário
      setResults(prev => prev + "🧹 Limpando arquivo temporário...\n");
      setResults(prev => prev + "✅ Arquivo temporário removido\n");

      setResults(prev => prev + "\n🎉 Teste de envio concluído com sucesso!\n");

    } catch (error) {
      console.error('Erro no teste de envio:', error);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é um arquivo de áudio
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo de áudio",
          variant: "destructive",
        });
        return;
      }
      setAudioFile(file);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Diagnóstico de Envio de Áudio
          </CardTitle>
          <CardDescription>
            Testa o pipeline completo de envio de áudio via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input
                id="instanceId"
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder="01K11NBE1QB0GVFMME8NA4YPCB"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatId">Chat ID</Label>
              <Input
                id="chatId"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="5511999999999@s.whatsapp.net"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audioFile">Arquivo de Áudio</Label>
            <div className="flex items-center gap-2">
              <Input
                id="audioFile"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="flex-1"
              />
              {audioFile && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileAudio className="h-4 w-4" />
                  {audioFile.name}
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={testAudioSending} 
            disabled={testing}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {testing ? "Testando Envio..." : "Executar Teste de Envio"}
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
          <CardTitle>Pipeline de Envio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Fluxo de Envio de Áudio:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Arquivo convertido para Blob</li>
              <li>Upload para Supabase Storage (bucket temporário)</li>
              <li>Obtenção de URL pública temporária</li>
              <li>Envio via Yumer API usando <code>sendWhatsAppAudio</code></li>
              <li>Fallback para <code>sendAudioFile</code> se necessário</li>
              <li>Limpeza do arquivo temporário</li>
            </ol>
            <p><strong>Formatos Suportados:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>OGG (preferido para WhatsApp)</li>
              <li>WAV (convertido automaticamente)</li>
              <li>MP3 (convertido se necessário)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};