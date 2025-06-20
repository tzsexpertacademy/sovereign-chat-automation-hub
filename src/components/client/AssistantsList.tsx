
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Edit, Trash2, Zap } from "lucide-react";
import { type AssistantWithQueues } from "@/services/assistantsService";

interface AssistantsListProps {
  assistants: AssistantWithQueues[];
  onEdit: (assistant: AssistantWithQueues) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, isActive: boolean) => void;
}

const AssistantsList = ({ assistants, onEdit, onDelete, onToggleStatus }: AssistantsListProps) => {
  if (assistants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Assistentes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Nenhum assistente criado ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Assistentes ({assistants.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assistants.map((assistant) => (
          <div key={assistant.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{assistant.name}</h4>
                  <Badge variant={assistant.is_active ? "default" : "secondary"}>
                    {assistant.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Modelo: {assistant.model}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={assistant.is_active}
                  onCheckedChange={(checked) => onToggleStatus(assistant.id, checked)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm line-clamp-2">{assistant.prompt}</p>
              
              {assistant.triggers && Array.isArray(assistant.triggers) && assistant.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <Zap className="h-3 w-3 text-muted-foreground mt-1" />
                  {assistant.triggers.slice(0, 3).map((trigger, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                  {assistant.triggers.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{assistant.triggers.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(assistant)}
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este assistente?')) {
                    onDelete(assistant.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AssistantsList;
