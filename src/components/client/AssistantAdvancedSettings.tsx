import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Image, Video, Trash2, Download, Eye, Settings, Mic, Clock, MessageSquare, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { assistantsService, AdvancedSettings, MultimediaConfig, HumanizationConfig } from "@/services/assistantsService";
import AssistantAudioSettings from "./AssistantAudioSettings";
import { multimediaAnalysisService } from "@/services/multimediaAnalysisService";
import { assistantHumanizationService, HumanizedPersonality } from "@/services/assistantHumanizationService";
import { AssistantHumanizationSettings } from "./AssistantHumanizationSettings";
import MultimediaAnalysisDashboard from "./MultimediaAnalysisDashboard";

interface AssistantAdvancedSettingsProps {
  assistantId: string;
  onClose: () => void;
}

const AssistantAdvancedSettings = ({ assistantId, onClose }: AssistantAdvancedSettingsProps) => {
  const [settings, setSettings] = useState<AdvancedSettings>({
    audio_processing_enabled: false,
    voice_cloning_enabled: false,
    eleven_labs_voice_id: "",
    eleven_labs_api_key: "",
    eleven_labs_model: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      style: 0.5
    },
    response_delay_seconds: 3,
    typing_indicator_enabled: true,
    recording_indicator_enabled: true,
    humanization_level: 'advanced',
    temperature: 0.7,
    max_tokens: 1000,
    custom_files: [],
    audio_library: [],
    recording_settings: {
      max_duration: 60,
      quality: 'medium',
      auto_transcribe: true
    },
    // Novas configurações multimídia
    multimedia_enabled: true,
    multimedia_config: {
      image_analysis_enabled: true,
      video_analysis_enabled: true,
      document_analysis_enabled: true,
      url_analysis_enabled: true,
      audio_transcription_enabled: true,
      image_model: 'gpt-4o',
      audio_model: 'whisper-1'
    },
    // Configurações de humanização
    humanization_config: {
      personality_id: 'professional',
      custom_personality: null,
      enabled: true
    }
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [personalities, setPersonalities] = useState<HumanizedPersonality[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    loadPersonalities();
  }, [assistantId]);

  const loadPersonalities = async () => {
    try {
      const availablePersonalities = assistantHumanizationService.getAvailablePersonalities();
      setPersonalities(availablePersonalities);
    } catch (error) {
      console.error('Erro ao carregar personalidades:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await assistantsService.getAssistantAdvancedSettings(assistantId);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações avançadas:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await assistantsService.updateAdvancedSettings(assistantId, settings);
      toast({
        title: "Configurações Salvas",
        description: "As configurações avançadas foram atualizadas com sucesso.",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/', 'application/pdf', 'video/'];
    const isValidType = allowedTypes.some(type => file.type.startsWith(type));
    
    if (!isValidType) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas imagens, PDFs e vídeos são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 100MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      
      // Simular upload (aqui você implementaria o upload real para o Supabase Storage)
      const fileId = `file_${Date.now()}`;
      const fileUrl = URL.createObjectURL(file); // Temporário para demonstração
      
      const newFile = {
        id: fileId,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' as const : 
              file.type === 'application/pdf' ? 'pdf' as const : 'video' as const,
        url: fileUrl,
        description: `Arquivo ${file.name} para referência do assistente`
      };

      setSettings(prev => ({
        ...prev,
        custom_files: [...prev.custom_files, newFile]
      }));

      toast({
        title: "Arquivo Adicionado",
        description: `${file.name} foi adicionado aos arquivos de referência`,
      });

    } catch (error) {
      toast({
        title: "Erro no Upload",
        description: "Falha ao fazer upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setSettings(prev => ({
      ...prev,
      custom_files: prev.custom_files.filter(f => f.id !== fileId)
    }));
    toast({
      title: "Arquivo Removido",
      description: "O arquivo foi removido dos arquivos de referência",
    });
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Configurações Avançadas</h2>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai">IA & Criatividade</TabsTrigger>
          <TabsTrigger value="multimedia">
            <Image className="w-4 h-4 mr-1" />
            Multimídia
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Volume2 className="w-4 h-4 mr-1" />
            Sistema de Áudio
          </TabsTrigger>
          <TabsTrigger value="behavior">
            <Clock className="w-4 h-4 mr-1" />
            Comportamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Parâmetros da IA</span>
              </CardTitle>
              <CardDescription>
                Configure a criatividade e o comportamento da IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="temperature">
                    Temperatura (Criatividade): {settings.temperature}
                  </Label>
                  <div className="mt-2">
                    <Slider
                      id="temperature"
                      value={[settings.temperature]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, temperature: value[0] }))}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Conservador (0.0)</span>
                    <span>Equilibrado (1.0)</span>
                    <span>Criativo (2.0)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {settings.temperature <= 0.3 && "Respostas mais conservadoras e consistentes"}
                    {settings.temperature > 0.3 && settings.temperature <= 1.0 && "Equilíbrio entre consistência e criatividade"}
                    {settings.temperature > 1.0 && "Respostas mais criativas e variadas"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="max_tokens">
                    Tamanho Máximo da Resposta: {settings.max_tokens} tokens
                  </Label>
                  <div className="mt-2">
                    <Slider
                      id="max_tokens"
                      value={[settings.max_tokens]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, max_tokens: value[0] }))}
                      min={100}
                      max={4000}
                      step={100}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Curto (100)</span>
                    <span>Médio (1000)</span>
                    <span>Longo (4000)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Controla o tamanho máximo das respostas do assistente
                  </p>
                </div>

                <div>
                  <Label htmlFor="humanization_level">Nível de Humanização</Label>
                  <Select 
                    value={settings.humanization_level} 
                    onValueChange={(value: 'basic' | 'advanced' | 'maximum') => 
                      setSettings(prev => ({ ...prev, humanization_level: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico - Respostas diretas</SelectItem>
                      <SelectItem value="advanced">Avançado - Mais natural</SelectItem>
                      <SelectItem value="maximum">Máximo - Muito humano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multimedia" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="w-5 h-5" />
                <span>Análise Multimídia</span>
              </CardTitle>
              <CardDescription>
                Configure o processamento automático de mídias (imagens, vídeos, áudios, documentos e URLs)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Switch principal */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Ativar Análise Multimídia</h4>
                  <p className="text-sm text-muted-foreground">
                    Processa automaticamente mídias enviadas pelos usuários
                  </p>
                </div>
                <Switch
                  checked={settings.multimedia_enabled}
                  onCheckedChange={(enabled) => 
                    setSettings(prev => ({ ...prev, multimedia_enabled: enabled }))
                  }
                />
              </div>

              {settings.multimedia_enabled && (
                <>
                  {/* Configurações por tipo de mídia */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium">Tipos de Mídia</h4>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Image className="w-4 h-4" />
                            <span className="text-sm">Análise de Imagens</span>
                          </div>
                          <Switch
                            checked={settings.multimedia_config?.image_analysis_enabled}
                            onCheckedChange={(enabled) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  image_analysis_enabled: enabled
                                }
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Video className="w-4 h-4" />
                            <span className="text-sm">Análise de Vídeos</span>
                          </div>
                          <Switch
                            checked={settings.multimedia_config?.video_analysis_enabled}
                            onCheckedChange={(enabled) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  video_analysis_enabled: enabled
                                }
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">Análise de Documentos</span>
                          </div>
                          <Switch
                            checked={settings.multimedia_config?.document_analysis_enabled}
                            onCheckedChange={(enabled) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  document_analysis_enabled: enabled
                                }
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Mic className="w-4 h-4" />
                            <span className="text-sm">Transcrição de Áudio</span>
                          </div>
                          <Switch
                            checked={settings.multimedia_config?.audio_transcription_enabled}
                            onCheckedChange={(enabled) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  audio_transcription_enabled: enabled
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">Modelos IA</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="image_model">Modelo para Imagens</Label>
                          <Select 
                            value={settings.multimedia_config?.image_model || 'gpt-4o'} 
                            onValueChange={(value) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  image_model: value
                                }
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gpt-4o">GPT-4 Vision (Recomendado)</SelectItem>
                              <SelectItem value="gpt-4-turbo">GPT-4 Turbo Vision</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="audio_model">Modelo para Áudio</Label>
                          <Select 
                            value={settings.multimedia_config?.audio_model || 'whisper-1'} 
                            onValueChange={(value) => 
                              setSettings(prev => ({
                                ...prev,
                                multimedia_config: {
                                  ...prev.multimedia_config!,
                                  audio_model: value
                                }
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whisper-1">Whisper (OpenAI)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard de análises */}
                  <div className="mt-6">
                    <MultimediaAnalysisDashboard clientId={assistantId} />
                  </div>
                </>
              )}
              
            </CardContent>
          </Card>

          {/* Arquivos de Referência - Movido para a tab de multimídia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Arquivos de Referência</span>
              </CardTitle>
              <CardDescription>
                Adicione imagens, PDFs e vídeos que o assistente pode referenciar nas conversas.
                <br />
                <strong>Como usar:</strong> No prompt do assistente, mencione que ele tem acesso a estes arquivos e como deve usá-los.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Upload Section */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*,application/pdf,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">
                    {uploading ? "Enviando..." : "Clique para adicionar arquivo"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Imagens, PDFs e vídeos até 100MB
                  </p>
                </label>
              </div>

              {/* Example Usage */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">💡 Exemplo de uso no prompt:</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>Para catálogo de produtos:</strong></p>
                  <p className="font-mono bg-blue-100 p-2 rounded">
                    "Você tem acesso a um catálogo com imagens dos produtos. Quando o cliente perguntar sobre produtos, descreva-os baseado nas imagens disponíveis..."
                  </p>
                  <p><strong>Para manual de instruções:</strong></p>
                  <p className="font-mono bg-blue-100 p-2 rounded">
                    "Use o manual em PDF para responder dúvidas técnicas. Sempre cite as informações do manual quando relevante..."
                  </p>
                </div>
              </div>

              {/* Files List */}
              {settings.custom_files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Arquivos Carregados ({settings.custom_files.length})</h4>
                  {settings.custom_files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-gray-500">{file.description}</p>
                        </div>
                        <Badge variant="outline">{file.type.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {settings.custom_files.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum arquivo carregado</p>
                  <p className="text-sm">Adicione arquivos de referência para o assistente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="audio" className="space-y-6">
          <AssistantAudioSettings
            assistantId={assistantId}
            settings={settings}
            onSettingsChange={setSettings}
          />
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <AssistantHumanizationSettings
            assistantId={assistantId}
            assistantName="Assistente"
            onConfigUpdate={(config) => {
              console.log('🎭 Configuração de humanização atualizada:', config);
              toast({
                title: "Humanização Atualizada",
                description: "Configurações de humanização salvas com sucesso!"
              });
            }}
          />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Indicadores Visuais</span>
              </CardTitle>
              <CardDescription>
                Configurações de indicadores visuais durante o uso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="recording_indicator_enabled">
                      Mostrar Indicador de Gravação
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Mostra o indicador de gravação enquanto o assistente gera áudio
                    </p>
                  </div>
                  <Switch
                    id="recording_indicator_enabled"
                    checked={settings.recording_indicator_enabled}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, recording_indicator_enabled: checked }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};

export default AssistantAdvancedSettings;
