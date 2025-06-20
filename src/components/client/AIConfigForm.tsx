
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiConfigService, type AIConfig } from "@/services/aiConfigService";

interface AIConfigFormProps {
  clientId: string;
  config?: AIConfig | null;
  onSave: () => void;
  onCancel: () => void;
}

const AI_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Recomendado)" },
  { value: "gpt-4o", label: "GPT-4o (Mais Poderoso)" },
  { value: "gpt-4", label: "GPT-4 (Legado)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Econômico)" }
];

const AIConfigForm = ({ clientId, config, onSave, onCancel }: AIConfigFormProps) => {
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      setApiKey(config.openai_api_key || "");
      setDefaultModel(config.default_model || "gpt-4o-mini");
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      alert("Por favor, insira sua chave API da OpenAI");
      return;
    }

    try {
      setLoading(true);
      await aiConfigService.createOrUpdateConfig({
        client_id: clientId,
        openai_api_key: apiKey.trim(),
        default_model: defaultModel
      });
      onSave();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      alert("Erro ao salvar configuração");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Configuração de IA</CardTitle>
        <CardDescription>
          Configure sua chave API da OpenAI e o modelo padrão para seus assistentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Chave API OpenAI *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
            />
            <p className="text-xs text-muted-foreground">
              Sua chave será criptografada e armazenada com segurança
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo Padrão *</Label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Configuração"}
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

export default AIConfigForm;
