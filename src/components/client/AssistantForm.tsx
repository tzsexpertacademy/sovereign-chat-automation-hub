import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
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

const AssistantForm = ({ clientId, assistant, onSave, onCancel }: AssistantFormProps) => {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assistant) {
      setName(assistant.name || "");
      setPrompt(assistant.prompt || "");
      setModel(assistant.model || "gpt-4o-mini");
      setTriggers(jsonToStringArray(assistant.triggers));
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
      
      const assistantData = {
        client_id: clientId,
        name: name.trim(),
        prompt: prompt.trim(),
        model,
        triggers: triggers,
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
    <Card className="w-full max-w-4xl mx-auto">
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

          <div className="flex gap-3 pt-4">
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
