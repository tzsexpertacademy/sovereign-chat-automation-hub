import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Edit, Trash2, Zap, Settings, Activity, MessageSquare, Clock } from "lucide-react";
import { type AssistantWithQueues } from "@/services/assistantsService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AssistantsListProps {
  assistants: AssistantWithQueues[];
  onEdit: (assistant: AssistantWithQueues) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, isActive: boolean) => void;
  onAdvancedSettings: (assistant: AssistantWithQueues) => void;
}

// Função helper para converter Json para string[]
const jsonToStringArray = (json: any): string[] => {
  if (Array.isArray(json)) {
    return json.filter(item => typeof item === 'string') as string[];
  }
  return [];
};

const AssistantsList = ({ assistants, onEdit, onDelete, onToggleStatus, onAdvancedSettings }: AssistantsListProps) => {
  
  if (assistants.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Nenhum assistente encontrado</CardTitle>
          <CardDescription>
            Crie seu primeiro assistente IA para começar a automatizar o atendimento
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Os assistentes ajudam a responder mensagens automaticamente e processar multimídia
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {assistants.map((assistant) => {
        const triggersArray = jsonToStringArray(assistant.triggers);
        
        // Verificar se tem configurações avançadas
        let hasMultimedia = false;
        let hasAudioProcessing = false;
        try {
          const settings = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings) 
            : assistant.advanced_settings;
          hasMultimedia = settings?.multimedia_enabled || false;
          hasAudioProcessing = settings?.audio_processing_enabled || false;
        } catch {
          hasMultimedia = false;
          hasAudioProcessing = false;
        }
        
        return (
          <Card key={assistant.id} className={`transition-all duration-200 hover:shadow-md ${
            assistant.is_active 
              ? 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent' 
              : 'border-muted bg-muted/20'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      assistant.is_active ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Bot className={`h-4 w-4 ${
                        assistant.is_active ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{assistant.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {assistant.model}
                      </p>
                    </div>
                  </div>
                  
                  {/* Status e Features */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant={assistant.is_active ? "default" : "secondary"} className="text-xs">
                      {assistant.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    {hasAudioProcessing && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        TTS
                      </Badge>
                    )}
                    {hasMultimedia && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Activity className="h-3 w-3 mr-1" />
                        Multimídia
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Switch
                  checked={assistant.is_active}
                  onCheckedChange={(checked) => onToggleStatus(assistant.id, checked)}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Prompt Preview */}
              <div className="space-y-2">
                <p className="text-sm line-clamp-3 text-muted-foreground">
                  {assistant.prompt}
                </p>
              </div>
              
              {/* Triggers */}
              {triggersArray.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    <span>Gatilhos:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {triggersArray.slice(0, 2).map((trigger, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {trigger}
                      </Badge>
                    ))}
                    {triggersArray.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{triggersArray.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {/* Performance Simulada */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-center">
                  <div className="text-lg font-semibold text-primary">
                    {assistant.is_active ? Math.floor(Math.random() * 50) + 10 : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Respostas hoje</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-emerald-600">
                    {assistant.is_active ? `${(Math.random() * 2 + 2).toFixed(1)}s` : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">Tempo médio</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(assistant)}
                  className="flex-1"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAdvancedSettings(assistant)}
                  className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Config
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este assistente?')) {
                      onDelete(assistant.id);
                    }
                  }}
                  className="text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AssistantsList;
