
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Image, Video, Volume2, Clock, MessageSquare } from "lucide-react";

interface AssistantAdvancedSettingsProps {
  settings: {
    audio_processing_enabled: boolean;
    voice_cloning_enabled: boolean;
    eleven_labs_voice_id: string;
    eleven_labs_api_key: string;
    response_delay_seconds: number;
    message_processing_delay_seconds: number;
    message_batch_timeout_seconds: number;
    typing_indicator_enabled: boolean;
    recording_indicator_enabled: boolean;
    humanization_level: 'basic' | 'advanced' | 'maximum';
    temperature: number;
    max_tokens: number;
    custom_files: Array<{
      id: string;
      name: string;
      type: 'image' | 'pdf' | 'video';
      url: string;
      description?: string;
    }>;
  };
  onChange: (settings: any) => void;
}

const ELEVEN_LABS_VOICES = [
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria (Feminina)" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger (Masculina)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Feminina)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (Feminina)" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie (Masculina)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Masculina)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Masculina)" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte (Feminina)" },
];

const AssistantAdvancedSettings = ({ settings, onChange }: AssistantAdvancedSettingsProps) => {
  const [uploadingFile, setUploadingFile] = useState(false);

  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploadingFile(true);
    try {
      // Aqui implementaríamos o upload real para Supabase Storage
      for (const file of files) {
        const fileType = file.type.startsWith('image/') ? 'image' : 
                        file.type === 'application/pdf' ? 'pdf' : 'video';
        
        const newFile = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          type: fileType as 'image' | 'pdf' | 'video',
          url: URL.createObjectURL(file), // Temporário - substituir por URL do Supabase
          description: ''
        };

        const updatedFiles = [...settings.custom_files, newFile];
        updateSetting('custom_files', updatedFiles);
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = settings.custom_files.filter(f => f.id !== fileId);
    updateSetting('custom_files', updatedFiles);
  };

  return (
    <div className="space-y-6">
      {/* Processamento de Áudio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Processamento de Áudio
          </CardTitle>
          <CardDescription>
            Configure como o assistente processa e responde com áudio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Interpretar mensagens de áudio</Label>
              <p className="text-sm text-muted-foreground">
                Converte áudios recebidos em texto para processamento
              </p>
            </div>
            <Switch
              checked={settings.audio_processing_enabled}
              onCheckedChange={(checked) => updateSetting('audio_processing_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enviar respostas em áudio</Label>
              <p className="text-sm text-muted-foreground">
                Usa voz clonada via Eleven Labs para responder
              </p>
            </div>
            <Switch
              checked={settings.voice_cloning_enabled}
              onCheckedChange={(checked) => updateSetting('voice_cloning_enabled', checked)}
            />
          </div>

          {settings.voice_cloning_enabled && (
            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label>Chave API Eleven Labs</Label>
                <Input
                  type="password"
                  value={settings.eleven_labs_api_key}
                  onChange={(e) => updateSetting('eleven_labs_api_key', e.target.value)}
                  placeholder="Sua chave da Eleven Labs"
                />
              </div>

              <div className="space-y-2">
                <Label>Voz para clonagem</Label>
                <Select
                  value={settings.eleven_labs_voice_id}
                  onValueChange={(value) => updateSetting('eleven_labs_voice_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma voz" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEVEN_LABS_VOICES.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timing Humanizado
          </CardTitle>
          <CardDescription>
            Configure delays e tempos para tornar as respostas mais naturais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Delay de resposta (segundos)</Label>
              <Input
                type="number"
                min="0"
                max="60"
                value={settings.response_delay_seconds}
                onChange={(e) => updateSetting('response_delay_seconds', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Tempo antes de começar a processar
              </p>
            </div>

            <div className="space-y-2">
              <Label>Processamento antecipado (segundos)</Label>
              <Input
                type="number"
                min="0"
                max="30"
                value={settings.message_processing_delay_seconds}
                onChange={(e) => updateSetting('message_processing_delay_seconds', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Inicia processamento antes do envio
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timeout para lote (segundos)</Label>
              <Input
                type="number"
                min="5"
                max="60"
                value={settings.message_batch_timeout_seconds}
                onChange={(e) => updateSetting('message_batch_timeout_seconds', parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-muted-foreground">
                Agrupa mensagens quebradas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores Visuais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Indicadores Visuais
          </CardTitle>
          <CardDescription>
            Simule comportamentos humanos durante as conversas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mostrar "digitando..."</Label>
              <p className="text-sm text-muted-foreground">
                Exibe bolinhas de digitação antes das mensagens de texto
              </p>
            </div>
            <Switch
              checked={settings.typing_indicator_enabled}
              onCheckedChange={(checked) => updateSetting('typing_indicator_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mostrar "gravando áudio..."</Label>
              <p className="text-sm text-muted-foreground">
                Exibe indicador de gravação antes de enviar áudios
              </p>
            </div>
            <Switch
              checked={settings.recording_indicator_enabled}
              onCheckedChange={(checked) => updateSetting('recording_indicator_enabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Nível de humanização</Label>
            <Select
              value={settings.humanization_level}
              onValueChange={(value) => updateSetting('humanization_level', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Básico</SelectItem>
                <SelectItem value="advanced">Avançado</SelectItem>
                <SelectItem value="maximum">Máximo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controla variações de tempo, erros de digitação simulados, etc.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Arquivos de Personalização
          </CardTitle>
          <CardDescription>
            Faça upload de imagens, PDFs ou vídeos para personalizar o prompt do assistente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Upload de arquivos</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                multiple
                accept="image/*,application/pdf,video/*"
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
              {uploadingFile && <div className="text-sm text-muted-foreground">Enviando...</div>}
            </div>
            <p className="text-xs text-muted-foreground">
              Aceita imagens, PDFs e vídeos. Estes arquivos serão referenciados no prompt.
            </p>
          </div>

          {settings.custom_files.length > 0 && (
            <div className="space-y-2">
              <Label>Arquivos carregados</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {settings.custom_files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 border rounded">
                    {file.type === 'image' && <Image className="h-4 w-4" />}
                    {file.type === 'pdf' && <FileText className="h-4 w-4" />}
                    {file.type === 'video' && <Video className="h-4 w-4" />}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {file.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssistantAdvancedSettings;
