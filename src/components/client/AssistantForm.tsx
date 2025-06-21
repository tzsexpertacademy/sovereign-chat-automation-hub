
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Settings, Zap, Brain } from "lucide-react";
import { assistantsService, type Assistant } from "@/services/assistantsService";

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

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">💡 Arquivos de Referência</h4>
          <p className="text-sm text-blue-800 mb-2">
            Para adicionar imagens, PDFs e vídeos que o assistente pode usar:
          </p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Salve este assistente primeiro</li>
            <li>Vá para a lista de assistentes</li>
            <li>Clique em "Configurações Avançadas"</li>
            <li>Use a aba "Arquivos de Referência"</li>
          </ol>
          <p className="text-sm text-blue-800 mt-2">
            <strong>Exemplo no prompt:</strong> "Você tem acesso a um catálogo com imagens dos produtos. Use essas imagens para descrever os produtos quando perguntado..."
          </p>
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
  
  // Configurações avançadas
  const [advancedSettings, setAdvancedSettings] = useState({
    audio_processing_enabled: false,
    voice_cloning_enabled: false,
    eleven_labs_voice_id: "",
    eleven_labs_api_key: "",
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
    }>
  });

  useEffect(() => {
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
  }, [assistant]);

  const addTrigger = () => {
    if (newTrigger.trim() && !triggers.includes(newTrigger.trim())) {
      setTriggers([...triggers, newTrigger.trim()]);
      setNewTrigger("");
    }
  };

  const removeTrigger = (trigger: string) => {
    setTriggers(triggers.filter(t => t !== trigger));
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
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                IA & Criatividade
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Humanização
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

              <div className="space-y-3">
                <Label>Gatilhos para Transferência de Fila</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    placeholder="Ex: falar com humano, suporte, preço"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTrigger())}
                  />
                  <Button type="button" onClick={addTrigger} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {triggers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {triggers.map((trigger, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {trigger}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeTrigger(trigger)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Palavras-chave que farão o assistente transferir a conversa para outra fila
                </p>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Configurações de IA
                  </CardTitle>
                  <CardDescription>
                    Ajuste o comportamento e criatividade das respostas da IA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="temperature">
                        Temperatura (Criatividade): {temperature}
                      </Label>
                      <Input
                        id="temperature"
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Conservador (0.0)</span>
                        <span>Balanceado (1.0)</span>
                        <span>Criativo (2.0)</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {temperature <= 0.3 ? "Respostas muito precisas e consistentes" :
                         temperature <= 0.7 ? "Equilíbrio entre precisão e criatividade" :
                         temperature <= 1.2 ? "Respostas mais criativas e variadas" :
                         "Respostas muito criativas e imprevisíveis"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="maxTokens">
                        Tamanho Máximo da Resposta: {maxTokens} tokens
                      </Label>
                      <Input
                        id="maxTokens"
                        type="range"
                        min="100"
                        max="4000"
                        step="100"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Curto (100)</span>
                        <span>Médio (1000)</span>
                        <span>Longo (4000)</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {maxTokens <= 500 ? "Respostas curtas e diretas" :
                         maxTokens <= 1500 ? "Respostas de tamanho médio" :
                         "Respostas longas e detalhadas"}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Dicas de Configuração</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>Atendimento:</strong> Temperatura 0.3-0.5, Tokens 200-800</li>
                      <li>• <strong>Vendas:</strong> Temperatura 0.5-0.8, Tokens 300-1000</li>
                      <li>• <strong>Criativo:</strong> Temperatura 0.8-1.2, Tokens 500-2000</li>
                      <li>• <strong>Suporte Técnico:</strong> Temperatura 0.2-0.4, Tokens 400-1500</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <SimpleAdvancedSettings
                settings={advancedSettings}
                onChange={setAdvancedSettings}
              />
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
