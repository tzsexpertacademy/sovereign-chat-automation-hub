
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Settings, Zap, Brain, Volume2, Key, CheckCircle, XCircle, Bot } from "lucide-react";
import { assistantsService, type Assistant } from "@/services/assistantsService";
import { aiConfigService } from "@/services/aiConfigService";
import { useToast } from "@/hooks/use-toast";


interface AssistantFormProps {
  clientId: string;
  assistant?: Assistant | null;
  onSave: () => void;
  onCancel: () => void;
}

const AI_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Recomendado)" },
  { value: "gpt-4o", label: "GPT-4o (Mais Poderoso)" },
  { value: "gpt-4", label: "GPT-4 (Legado)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Econômico)" }
];

// Função helper para converter Json para string[]
const jsonToStringArray = (json: any): string[] => {
  if (Array.isArray(json)) {
    return json.filter(item => typeof item === 'string') as string[];
  }
  return [];
};

// Componente inline para configurações avançadas simplificadas
const SimpleAdvancedSettings = ({ 
  settings, 
  onChange 
}: {
  settings: any;
  onChange: (settings: any) => void;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Configurações de Humanização
        </CardTitle>
        <CardDescription>
          Configure o comportamento humanizado do assistente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="humanization_level">Nível de Humanização</Label>
          <Select 
            value={settings.humanization_level} 
            onValueChange={(value: 'basic' | 'advanced' | 'maximum') => 
              onChange({ ...settings, humanization_level: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Básico - Respostas diretas</SelectItem>
              <SelectItem value="advanced">Avançado - Mais natural</SelectItem>
              <SelectItem value="maximum">Máximo - Muito humano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label htmlFor="response_delay">
            Delay na Resposta (segundos): {settings.response_delay_seconds}
          </Label>
          <Input
            id="response_delay"
            type="range"
            min="0"
            max="10"
            step="1"
            value={settings.response_delay_seconds}
            onChange={(e) => onChange({ 
              ...settings, 
              response_delay_seconds: parseInt(e.target.value) 
            })}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Tempo de espera antes de enviar a resposta para parecer mais humano
          </p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-900 mb-2">🎵 Sistema de Áudio</h4>
          <p className="text-sm text-green-800 mb-2">
            Para configurar respostas em áudio do assistente:
          </p>
          <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
            <li>Salve este assistente primeiro</li>
            <li>Vá para "Configurações"</li>
            <li>Configure o ElevenLabs na aba "Sistema de Áudio"</li>
            <li>Use os padrões no prompt:</li>
          </ol>
          <div className="mt-2 space-y-1 text-sm">
            <p><code className="bg-green-100 px-1 rounded">audio: texto aqui</code> - Para gerar com IA</p>
            <p><code className="bg-green-100 px-1 rounded">audiogeonomedoaudio: trigger</code> - Para áudio gravado</p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">🖼️ Sistema de Imagens</h4>
          <p className="text-sm text-blue-800 mb-2">
            Para enviar imagens automáticas do assistente:
          </p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Salve este assistente primeiro</li>
            <li>Vá para "Configurações" na lista de assistentes</li>
            <li>Use a aba "Imagens" para enviar imagens</li>
            <li>Configure triggers únicos para cada imagem</li>
          </ol>
          <div className="mt-2 space-y-1 text-sm">
            <p><code className="bg-blue-100 px-1 rounded">image: logo</code> - Para enviar o logo</p>
            <p><code className="bg-blue-100 px-1 rounded">image: catalogo</code> - Para enviar catálogo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AssistantForm = ({ clientId, assistant, onSave, onCancel }: AssistantFormProps) => {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Configurações de IA
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  
  // Configuração OpenAI
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState("");
  
  const { toast } = useToast();
  
  // Configurações avançadas
  const [advancedSettings, setAdvancedSettings] = useState({
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
    message_processing_delay_seconds: 10,
    message_batch_timeout_seconds: 10,
    typing_indicator_enabled: true,
    recording_indicator_enabled: true,
    humanization_level: 'advanced' as 'basic' | 'advanced' | 'maximum',
    temperature: 0.7,
    max_tokens: 1000,
    custom_files: [] as Array<{
      id: string;
      name: string;
      type: 'image' | 'pdf' | 'video';
      url: string;
      description?: string;
    }>,
    audio_library: [] as Array<{
      id: string;
      name: string;
      trigger: string;
      url: string;
      duration: number;
      category: string;
    }>,
    recording_settings: {
      max_duration: 60,
      quality: 'medium' as 'low' | 'medium' | 'high',
      auto_transcribe: true
    }
  });

  useEffect(() => {
    // Carregar configuração da OpenAI do cliente
    const loadOpenAIConfig = async () => {
      try {
        const config = await aiConfigService.getClientConfig(clientId);
        if (config) {
          setOpenaiApiKey(config.openai_api_key || "");
          setDefaultModel(config.default_model || "gpt-4o-mini");
          setKeyValidationStatus(config.openai_api_key ? 'valid' : 'idle');
        }
      } catch (error) {
        console.error('Erro ao carregar configuração OpenAI:', error);
      }
    };

    loadOpenAIConfig();

    if (assistant) {
      setName(assistant.name || "");
      setPrompt(assistant.prompt || "");
      setModel(assistant.model || "gpt-4o-mini");
      setTriggers(jsonToStringArray(assistant.triggers));
      
      // Carregar configurações avançadas se existirem
      if (assistant.advanced_settings) {
        try {
          const savedSettings = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          
          const updatedSettings = { ...advancedSettings, ...savedSettings };
          setAdvancedSettings(updatedSettings);
          setTemperature(updatedSettings.temperature || 0.7);
          setMaxTokens(updatedSettings.max_tokens || 1000);
        } catch (error) {
          console.error('Erro ao carregar configurações avançadas:', error);
        }
      }
    }
  }, [assistant, clientId]);

  const addTrigger = () => {
    if (newTrigger.trim() && !triggers.includes(newTrigger.trim())) {
      setTriggers([...triggers, newTrigger.trim()]);
      setNewTrigger("");
    }
  };

  const removeTrigger = (trigger: string) => {
    setTriggers(triggers.filter(t => t !== trigger));
  };

  const validateApiKey = async () => {
    if (!openaiApiKey.trim()) {
      setValidationError("API Key é obrigatória");
      setKeyValidationStatus('invalid');
      return;
    }

    setKeyValidationStatus('validating');
    setValidationError("");

    try {
      const result = await aiConfigService.validateOpenAIKey(openaiApiKey);
      if (result.valid) {
        setKeyValidationStatus('valid');
        toast({
          title: "API Key válida!",
          description: "Sua API Key da OpenAI foi validada com sucesso.",
        });
      } else {
        setKeyValidationStatus('invalid');
        setValidationError(result.error || "API Key inválida");
        toast({
          title: "API Key inválida",
          description: result.error || "Verifique sua API Key e tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setKeyValidationStatus('invalid');
      setValidationError("Erro ao validar API Key");
      toast({
        title: "Erro de validação",
        description: "Não foi possível validar a API Key. Verifique sua conexão.",
        variant: "destructive",
      });
    }
  };

  const saveOpenAIConfig = async () => {
    if (keyValidationStatus !== 'valid') {
      toast({
        title: "Validação necessária",
        description: "Valide a API Key antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await aiConfigService.createOrUpdateConfig({
        client_id: clientId,
        openai_api_key: openaiApiKey,
        default_model: defaultModel,
      });

      toast({
        title: "Configuração salva!",
        description: "Configuração da OpenAI salva com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar config OpenAI:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !prompt.trim()) {
      alert("Por favor, preencha nome e prompt do assistente");
      return;
    }

    try {
      setLoading(true);
      
      // Atualizar configurações avançadas com temperatura e max_tokens
      const updatedAdvancedSettings = {
        ...advancedSettings,
        temperature,
        max_tokens: maxTokens
      };
      
      const assistantData = {
        client_id: clientId,
        name: name.trim(),
        prompt: prompt.trim(),
        model,
        triggers: triggers,
        advanced_settings: JSON.stringify(updatedAdvancedSettings),
        is_active: true
      };

      if (assistant) {
        await assistantsService.updateAssistant(assistant.id, assistantData);
      } else {
        await assistantsService.createAssistant(assistantData);
      }
      
      onSave();
    } catch (error) {
      console.error('Erro ao salvar assistente:', error);
      alert("Erro ao salvar assistente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>
          {assistant ? "Editar Assistente" : "Novo Assistente"}
        </CardTitle>
        <CardDescription>
          Configure o comportamento e as características do seu assistente de IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Básicas
              </TabsTrigger>
              <TabsTrigger value="openai" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                OpenAI Config
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Áudio Básico
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Assistente *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Atendente Virtual"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Modelo IA *</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map((aiModel) => (
                        <SelectItem key={aiModel.value} value={aiModel.value}>
                          {aiModel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt do Assistente *</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descreva como o assistente deve se comportar, suas características, tom de voz, expertise, etc..."
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Este é o "cérebro" do seu assistente. Seja específico sobre como ele deve responder.
                </p>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-medium text-amber-900 mb-2">🎯 Gatilhos de Transferência</h4>
                <p className="text-sm text-amber-800 mb-2">
                  Os gatilhos de transferência agora são configurados nas filas, não mais nos assistentes:
                </p>
                <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Salve este assistente primeiro</li>
                  <li>Vá para "Sistema de Filas"</li>
                  <li>Use a aba "Gatilhos" para configurar transferências</li>
                  <li>Configure palavras como "atendimento humano", "falar com pessoa"</li>
                </ol>
                <div className="mt-2 text-sm">
                  <p><strong>Exemplo:</strong> Na Fila 1, configure o gatilho "atendimento humano" para transferir para Fila 2</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Configuração OpenAI
                  </CardTitle>
                  <CardDescription>
                    Configure sua API Key da OpenAI para este cliente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="openai-key">OpenAI API Key *</Label>
                      <div className="space-y-2">
                        <Input
                          id="openai-key"
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => {
                            setOpenaiApiKey(e.target.value);
                            setKeyValidationStatus('idle');
                            setValidationError("");
                          }}
                          placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="font-mono text-sm"
                        />
                        
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={validateApiKey}
                            disabled={keyValidationStatus === 'validating' || !openaiApiKey.trim()}
                            size="sm"
                          >
                            {keyValidationStatus === 'validating' ? 'Validando...' : 'Testar Conectividade'}
                          </Button>
                          
                          {keyValidationStatus === 'valid' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Válida</span>
                            </div>
                          )}
                          
                          {keyValidationStatus === 'invalid' && (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">Inválida</span>
                            </div>
                          )}
                        </div>
                        
                        {validationError && (
                          <p className="text-sm text-red-600">{validationError}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="default-model">Modelo Padrão</Label>
                      <Select value={defaultModel} onValueChange={setDefaultModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODELS.map((aiModel) => (
                            <SelectItem key={aiModel.value} value={aiModel.value}>
                              {aiModel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Modelo padrão que será usado pelos assistentes deste cliente
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      onClick={saveOpenAIConfig}
                      disabled={keyValidationStatus !== 'valid'}
                    >
                      Salvar Configuração OpenAI
                    </Button>
                    
                    {keyValidationStatus === 'valid' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Configuração válida</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Sobre a Configuração OpenAI</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>Controle de Custos:</strong> Use sua própria API Key para ter controle total dos gastos</li>
                      <li>• <strong>Segurança:</strong> Sua API Key é armazenada de forma segura e criptografada</li>
                      <li>• <strong>Flexibilidade:</strong> Escolha diferentes modelos baseado nas suas necessidades</li>
                      <li>• <strong>Fallback:</strong> Se não configurado, usará a chave global do sistema</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-medium text-amber-900 mb-2">💰 Custos Estimados da OpenAI</h4>
                    <ul className="text-sm text-amber-800 space-y-1">
                      <li>• <strong>GPT-4o Mini:</strong> $0.15/1M tokens entrada + $0.60/1M saída (Recomendado)</li>
                      <li>• <strong>GPT-4o:</strong> $2.50/1M tokens entrada + $10.00/1M saída</li>
                      <li>• <strong>Média por conversa:</strong> 100-500 tokens (~$0.001-$0.005 por interação)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="audio" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Configuração Rápida de Áudio
                  </CardTitle>
                  <CardDescription>
                    Configurações básicas de áudio. Para configurações avançadas, use "Configurações Avançadas" após salvar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-medium text-amber-900 mb-2">⚠️ Configuração Completa</h4>
                    <p className="text-sm text-amber-800 mb-3">
                      Para configurar completamente o sistema de áudio:
                    </p>
                    <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                      <li>Salve este assistente primeiro</li>
                      <li>Vá para "Configurações Avançadas"</li>
                      <li>Configure ElevenLabs e biblioteca de áudios</li>
                      <li>Use os padrões de áudio no prompt</li>
                    </ol>
                  </div>
                  
                  <div className="space-y-3">
                    <h5 className="font-medium">Padrões de Áudio para o Prompt:</h5>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <code className="font-mono text-blue-800">audio: Olá! Como posso ajudar você hoje?</code>
                        <p className="text-blue-700 mt-1">Gera áudio com ElevenLabs</p>
                      </div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <code className="font-mono text-green-800">audiogeobemvindo:</code>
                        <p className="text-green-700 mt-1">Reproduz áudio da biblioteca</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : assistant ? "Atualizar" : "Criar"} Assistente
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssistantForm;
