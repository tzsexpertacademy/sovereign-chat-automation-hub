import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Play, Pause, Trash2, Volume2, Mic, TestTube, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { assistantsService, ELEVENLABS_MODELS, type AdvancedSettings, type AudioLibraryItem } from "@/services/assistantsService";
import { elevenLabsService } from "@/services/elevenLabsService";
import { fishAudioService } from "@/services/fishAudioService";
import ElevenLabsVoiceSelector from "./ElevenLabsVoiceSelector";
import FishAudioVoiceSelector from "./FishAudioVoiceSelector";

interface AssistantAudioSettingsProps {
  assistantId: string;
  settings: AdvancedSettings;
  onSettingsChange: (settings: AdvancedSettings) => void;
}

const AssistantAudioSettings = ({ assistantId, settings, onSettingsChange }: AssistantAudioSettingsProps) => {
  const [testingVoice, setTestingVoice] = useState(false);
  const [validatingApi, setValidatingApi] = useState(false);
  const [testingFishVoice, setTestingFishVoice] = useState(false);
  const [validatingFishApi, setValidatingFishApi] = useState(false);
  const [newAudioTrigger, setNewAudioTrigger] = useState("");
  const [newAudioCategory, setNewAudioCategory] = useState("geral");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const handleVoiceTest = async () => {
    if (!settings.eleven_labs_api_key || !settings.eleven_labs_voice_id) {
      toast({
        title: "Configuração Incompleta",
        description: "Configure a API Key e selecione uma voz primeiro",
        variant: "destructive",
      });
      return;
    }

    setTestingVoice(true);
    try {
      const testText = "Olá! Esta é uma demonstração da minha voz. Como você acha que ficou?";
      const audioBase64 = await elevenLabsService.testVoice(
        settings.eleven_labs_api_key,
        settings.eleven_labs_voice_id,
        testText,
        settings.eleven_labs_model
      );

      // Converter base64 para blob e reproduzir
      const byteCharacters = atob(audioBase64);
      const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.play();
      
      toast({
        title: "Teste de Voz",
        description: "Reproduzindo amostra da voz selecionada",
      });
    } catch (error: any) {
      toast({
        title: "Erro no Teste",
        description: error.message || "Não foi possível testar a voz. Verifique suas configurações.",
        variant: "destructive",
      });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleApiValidation = async () => {
    if (!settings.eleven_labs_api_key) {
      toast({
        title: "API Key Necessária",
        description: "Insira sua API Key do ElevenLabs primeiro",
        variant: "destructive",
      });
      return;
    }

    setValidatingApi(true);
    try {
      const isValid = await elevenLabsService.validateApiKey(settings.eleven_labs_api_key);

      if (isValid) {
        toast({
          title: "API Válida",
          description: "Conexão com ElevenLabs estabelecida com sucesso",
        });
      } else {
        toast({
          title: "API Inválida",
          description: "Verifique sua API Key do ElevenLabs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de Validação",
        description: "Não foi possível validar a API Key",
        variant: "destructive",
      });
    } finally {
      setValidatingApi(false);
    }
  };

  const handleFishApiValidation = async () => {
    if (!settings.fish_audio_api_key) {
      toast({
        title: "API Key Necessária",
        description: "Insira sua API Key do Fish.Audio primeiro",
        variant: "destructive",
      });
      return;
    }

    setValidatingFishApi(true);
    try {
      const isValid = await fishAudioService.validateApiKey(settings.fish_audio_api_key);

      if (isValid) {
        toast({
          title: "API Válida",
          description: "Conexão com Fish.Audio estabelecida com sucesso",
        });
      } else {
        toast({
          title: "API Inválida",
          description: "Verifique sua API Key do Fish.Audio",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de Validação",
        description: "Não foi possível validar a API Key do Fish.Audio",
        variant: "destructive",
      });
    } finally {
      setValidatingFishApi(false);
    }
  };

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!newAudioTrigger.trim()) {
      toast({
        title: "Trigger Necessário",
        description: "Defina um trigger para este áudio (ex: audiogeobemvindo)",
        variant: "destructive",
      });
      return;
    }

    // Validar formato do arquivo
    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Formato Inválido",
        description: "Apenas arquivos MP3, WAV, OGG e M4A são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo Muito Grande",
        description: "O áudio deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    // Adicionar à biblioteca
    assistantsService.uploadAudioToLibrary(
      assistantId,
      file,
      newAudioTrigger.trim(),
      newAudioCategory
    ).then(() => {
      toast({
        title: "Áudio Adicionado",
        description: `Áudio "${file.name}" foi adicionado à biblioteca`,
      });
      setNewAudioTrigger("");
    }).catch((error) => {
      toast({
        title: "Erro no Upload",
        description: "Não foi possível adicionar o áudio à biblioteca",
        variant: "destructive",
      });
    });
  };

  const removeAudio = (audioId: string) => {
    assistantsService.removeAudioFromLibrary(assistantId, audioId)
      .then(() => {
        toast({
          title: "Áudio Removido",
          description: "O áudio foi removido da biblioteca",
        });
      })
      .catch(() => {
        toast({
          title: "Erro",
          description: "Não foi possível remover o áudio",
          variant: "destructive",
        });
      });
  };

  return (
    <Tabs defaultValue="provider" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="provider">Provedor</TabsTrigger>
        <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
        <TabsTrigger value="fishaudio">Fish.Audio</TabsTrigger>
        <TabsTrigger value="library">Biblioteca</TabsTrigger>
        <TabsTrigger value="recording">Configurações</TabsTrigger>
      </TabsList>

      <TabsContent value="provider" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5" />
              <span>Seleção de Provedor de Áudio</span>
            </CardTitle>
            <CardDescription>
              Escolha qual provedor de text-to-speech usar para gerar áudios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  settings.audio_provider === 'elevenlabs' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, audio_provider: 'elevenlabs' })}
              >
                <h3 className="font-medium mb-2">ElevenLabs</h3>
                <p className="text-sm text-muted-foreground">
                  Vozes ultra-realistas e emocionais. Ideal para conteúdo profissional.
                </p>
                <Badge variant={settings.audio_provider === 'elevenlabs' ? 'default' : 'outline'} className="mt-2">
                  Premium
                </Badge>
              </div>
              
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  settings.audio_provider === 'fishaudio' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, audio_provider: 'fishaudio' })}
              >
                <h3 className="font-medium mb-2">Fish.Audio</h3>
                <p className="text-sm text-muted-foreground">
                  Clonagem de voz avançada e customizável. Ideal para vozes específicas.
                </p>
                <Badge variant={settings.audio_provider === 'fishaudio' ? 'default' : 'outline'} className="mt-2">
                  Clonagem
                </Badge>
              </div>
              
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  settings.audio_provider === 'both' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, audio_provider: 'both' })}
              >
                <h3 className="font-medium mb-2">Ambos</h3>
                <p className="text-sm text-muted-foreground">
                  Use os dois provedores com fallback automático para máxima disponibilidade.
                </p>
                <Badge variant={settings.audio_provider === 'both' ? 'default' : 'outline'} className="mt-2">
                  Híbrido
                </Badge>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">💡 Como usar comandos de áudio:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p><code className="bg-blue-100 px-1 rounded">audio:texto</code> - Gera áudio com voz clonada do provedor selecionado</p>
                <p><code className="bg-blue-100 px-1 rounded">audiogeonomedoaudio:</code> - Reproduz áudio da biblioteca</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="elevenlabs" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5" />
              <span>Configuração ElevenLabs</span>
            </CardTitle>
            <CardDescription>
              Configure a integração com ElevenLabs para gerar áudio das respostas do assistente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="voice_cloning_enabled">Habilitar Geração de Áudio</Label>
              <Switch
                id="voice_cloning_enabled"
                checked={settings.voice_cloning_enabled}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, voice_cloning_enabled: checked })
                }
              />
            </div>

            {settings.voice_cloning_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="eleven_labs_api_key">API Key do ElevenLabs</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="eleven_labs_api_key"
                      type="password"
                      value={settings.eleven_labs_api_key || ''}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, eleven_labs_api_key: e.target.value })
                      }
                      placeholder="Sua API Key do ElevenLabs..."
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleApiValidation}
                      disabled={validatingApi}
                    >
                      {validatingApi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Validar"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eleven_labs_model">Modelo TTS</Label>
                  <Select 
                    value={settings.eleven_labs_model || 'eleven_multilingual_v2'} 
                    onValueChange={(value) => 
                      onSettingsChange({ ...settings, eleven_labs_model: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ELEVENLABS_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {settings.eleven_labs_api_key && (
                  <ElevenLabsVoiceSelector
                    apiKey={settings.eleven_labs_api_key}
                    selectedVoiceId={settings.eleven_labs_voice_id || ''}
                    onVoiceChange={(voiceId) => 
                      onSettingsChange({ ...settings, eleven_labs_voice_id: voiceId })
                    }
                    model={settings.eleven_labs_model || 'eleven_multilingual_v2'}
                  />
                )}

                <div className="space-y-4">
                  <Label>Configurações de Voz</Label>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="stability" className="text-sm">
                        Estabilidade: {settings.voice_settings?.stability || 0.5}
                      </Label>
                    </div>
                    <Slider
                      id="stability"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[settings.voice_settings?.stability || 0.5]}
                      onValueChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          voice_settings: { ...settings.voice_settings, stability: value[0] }
                        })
                      }
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="similarity_boost" className="text-sm">
                        Similarity Boost: {settings.voice_settings?.similarity_boost || 0.5}
                      </Label>
                    </div>
                    <Slider
                      id="similarity_boost"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[settings.voice_settings?.similarity_boost || 0.5]}
                      onValueChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          voice_settings: { ...settings.voice_settings, similarity_boost: value[0] }
                        })
                      }
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleVoiceTest}
                  disabled={testingVoice || !settings.eleven_labs_voice_id}
                  className="w-full"
                >
                  {testingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Testando Voz...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Testar Voz ElevenLabs
                    </>
                  )}
                </Button>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">🎭 ElevenLabs Features:</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Vozes ultra-realistas com emoção</li>
                    <li>• Múltiplos idiomas e sotaques</li>
                    <li>• Controle fino de estabilidade</li>
                    <li>• Modelos otimizados para diferentes usos</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="fishaudio" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5" />
              <span>Configuração Fish.Audio</span>
            </CardTitle>
            <CardDescription>
              Configure a integração com Fish.Audio para clonagem de voz avançada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="fish_audio_enabled">Habilitar Fish.Audio TTS</Label>
              <Switch
                id="fish_audio_enabled"
                checked={settings.fish_audio_enabled || false}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, fish_audio_enabled: checked })
                }
              />
            </div>

            {settings.fish_audio_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fish_audio_api_key">API Key do Fish.Audio</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="fish_audio_api_key"
                      type="password"
                      value={settings.fish_audio_api_key || ''}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, fish_audio_api_key: e.target.value })
                      }
                      placeholder="Sua API Key do Fish.Audio..."
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleFishApiValidation}
                      disabled={validatingFishApi}
                    >
                      {validatingFishApi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Validar"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fish_audio_format">Formato de Áudio</Label>
                    <Select 
                      value={settings.fish_audio_format || 'mp3'} 
                      onValueChange={(value: 'mp3' | 'wav' | 'pcm') => 
                        onSettingsChange({ ...settings, fish_audio_format: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3 (Recomendado)</SelectItem>
                        <SelectItem value="wav">WAV (Alta qualidade)</SelectItem>
                        <SelectItem value="pcm">PCM (Raw audio)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fish_audio_quality">Qualidade/Latência</Label>
                    <Select 
                      value={settings.fish_audio_quality || 'balanced'} 
                      onValueChange={(value: 'normal' | 'balanced') => 
                        onSettingsChange({ ...settings, fish_audio_quality: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal (Mais rápido)</SelectItem>
                        <SelectItem value="balanced">Balanceado (Qualidade/Velocidade)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {settings.fish_audio_api_key && (
                  <FishAudioVoiceSelector
                    apiKey={settings.fish_audio_api_key}
                    selectedVoiceId={settings.fish_audio_voice_id || ''}
                    onVoiceChange={(voiceId) => 
                      onSettingsChange({ ...settings, fish_audio_voice_id: voiceId })
                    }
                  />
                )}

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">🐟 Fish.Audio Features:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Clonagem de voz com alta fidelidade</li>
                    <li>• Suporte a múltiplas linguagens</li>
                    <li>• Controle fino de qualidade e latência</li>
                    <li>• Formatos de áudio flexíveis</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="elevenlabs" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5" />
              <span>Configuração ElevenLabs</span>
            </CardTitle>
            <CardDescription>
              Configure a integração com ElevenLabs para gerar áudio das respostas do assistente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="voice_cloning_enabled">Habilitar Geração de Áudio</Label>
              <Switch
                id="voice_cloning_enabled"
                checked={settings.voice_cloning_enabled}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, voice_cloning_enabled: checked })
                }
              />
            </div>

            {settings.voice_cloning_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="eleven_labs_api_key">API Key do ElevenLabs</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="eleven_labs_api_key"
                      type="password"
                      value={settings.eleven_labs_api_key}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, eleven_labs_api_key: e.target.value })
                      }
                      placeholder="sk_..."
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleApiValidation}
                      disabled={validatingApi}
                    >
                      {validatingApi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Validar"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eleven_labs_model">Modelo de TTS</Label>
                  <Select 
                    value={settings.eleven_labs_model} 
                    onValueChange={(value) => 
                      onSettingsChange({ ...settings, eleven_labs_model: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ELEVENLABS_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-muted-foreground">{model.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {settings.eleven_labs_api_key && (
                  <ElevenLabsVoiceSelector
                    apiKey={settings.eleven_labs_api_key}
                    selectedVoiceId={settings.eleven_labs_voice_id}
                    onVoiceChange={(voiceId) => 
                      onSettingsChange({ ...settings, eleven_labs_voice_id: voiceId })
                    }
                    model={settings.eleven_labs_model}
                  />
                )}

                <div className="space-y-4">
                  <Label>Configurações de Voz</Label>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="stability">
                        Estabilidade: {settings.voice_settings?.stability || 0.5}
                      </Label>
                      <Slider
                        id="stability"
                        value={[settings.voice_settings?.stability || 0.5]}
                        onValueChange={(value) => 
                          onSettingsChange({ 
                            ...settings, 
                            voice_settings: { 
                              ...settings.voice_settings, 
                              stability: value[0] 
                            } 
                          })
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <Label htmlFor="similarity_boost">
                        Clareza: {settings.voice_settings?.similarity_boost || 0.5}
                      </Label>
                      <Slider
                        id="similarity_boost"
                        value={[settings.voice_settings?.similarity_boost || 0.5]}
                        onValueChange={(value) => 
                          onSettingsChange({ 
                            ...settings, 
                            voice_settings: { 
                              ...settings.voice_settings, 
                              similarity_boost: value[0] 
                            } 
                          })
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleVoiceTest} 
                    disabled={testingVoice || !settings.eleven_labs_api_key || !settings.eleven_labs_voice_id}
                  >
                    {testingVoice ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <TestTube className="w-4 h-4 mr-2" />
                    )}
                    {testingVoice ? "Testando..." : "Testar Voz"}
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Como usar no prompt:</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Para que o assistente responda com áudio, inclua a palavra <code className="bg-blue-100 px-1 rounded">audio:</code> antes da resposta no prompt:
                  </p>
                  <p className="text-sm font-mono bg-blue-100 p-2 rounded text-blue-900">
                    "Quando o cliente perguntar sobre preços, responda: audio: Nossos preços começam em R$ 100..."
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="library" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Biblioteca de Áudios</span>
            </CardTitle>
            <CardDescription>
              Faça upload de áudios pré-gravados para usar nas conversas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="audio_trigger">Trigger do Áudio *</Label>
                    <Input
                      id="audio_trigger"
                      value={newAudioTrigger}
                      onChange={(e) => setNewAudioTrigger(e.target.value)}
                      placeholder="audiogeobemvindo"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ex: audiogeobemvindo, audiogeodespedida, audioproduto1
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="audio_category">Categoria</Label>
                    <Select value={newAudioCategory} onValueChange={setNewAudioCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="saudacao">Saudação</SelectItem>
                        <SelectItem value="despedida">Despedida</SelectItem>
                        <SelectItem value="produtos">Produtos</SelectItem>
                        <SelectItem value="promocoes">Promoções</SelectItem>
                        <SelectItem value="suporte">Suporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Áudio
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-900 mb-2">💡 Como usar no prompt:</h4>
              <p className="text-sm text-yellow-800 mb-2">
                Para reproduzir um áudio da biblioteca, use o padrão <code className="bg-yellow-100 px-1 rounded">audiogeonomedoaudio:</code> no prompt:
              </p>
              <p className="text-sm font-mono bg-yellow-100 p-2 rounded text-yellow-900">
                "Para dar boas-vindas, responda: audiogeobemvindo:"
              </p>
            </div>

            {settings.audio_library && settings.audio_library.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Áudios Carregados ({settings.audio_library.length})</h4>
                {settings.audio_library.map((audio) => (
                  <div key={audio.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{audio.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{audio.trigger}</Badge>
                          <Badge variant="secondary">{audio.category}</Badge>
                          {audio.duration > 0 && <span>{audio.duration}s</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => removeAudio(audio.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(!settings.audio_library || settings.audio_library.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>Nenhum áudio na biblioteca</p>
                <p className="text-sm">Adicione áudios pré-gravados para usar nas conversas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="recording" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="w-5 h-5" />
              <span>Configurações de Gravação</span>
            </CardTitle>
            <CardDescription>
              Configure como os áudios são processados e gravados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="max_duration">
                  Duração Máxima da Gravação: {settings.recording_settings?.max_duration || 60}s
                </Label>
                <Slider
                  id="max_duration"
                  value={[settings.recording_settings?.max_duration || 60]}
                  onValueChange={(value) => 
                    onSettingsChange({ 
                      ...settings, 
                      recording_settings: { 
                        ...settings.recording_settings, 
                        max_duration: value[0] 
                      } 
                    })
                  }
                  min={10}
                  max={180}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10s</span>
                  <span>180s</span>
                </div>
              </div>

              <div>
                <Label htmlFor="quality">Qualidade do Áudio</Label>
                <Select 
                  value={settings.recording_settings?.quality || 'medium'} 
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    onSettingsChange({ 
                      ...settings, 
                      recording_settings: { 
                        ...settings.recording_settings, 
                        quality: value 
                      } 
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa (menor tamanho)</SelectItem>
                    <SelectItem value="medium">Média (balanceado)</SelectItem>
                    <SelectItem value="high">Alta (melhor qualidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_transcribe">Transcrição Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Transcrever automaticamente áudios enviados pelos usuários
                  </p>
                </div>
                <Switch
                  id="auto_transcribe"
                  checked={settings.recording_settings?.auto_transcribe || false}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ 
                      ...settings, 
                      recording_settings: { 
                        ...settings.recording_settings, 
                        auto_transcribe: checked 
                      } 
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default AssistantAudioSettings;
