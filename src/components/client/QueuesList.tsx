
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Edit, Trash2, Bot, Users } from "lucide-react";
import { type QueueWithAssistant } from "@/services/queuesService";
import { type AssistantWithQueues } from "@/services/assistantsService";

interface QueuesListProps {
  queues: QueueWithAssistant[];
  assistants: AssistantWithQueues[];
  onEdit: (queue: QueueWithAssistant) => void;
  onDelete: (id: string) => void;
}

const QueuesList = ({ queues, assistants, onEdit, onDelete }: QueuesListProps) => {
  const getAssistantName = (assistantId: string | null) => {
    if (!assistantId) return "Sem assistente";
    const assistant = assistants.find(a => a.id === assistantId);
    return assistant ? assistant.name : "Assistente não encontrado";
  };

  if (queues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Filas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Nenhuma fila criada ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Filas ({queues.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {queues.map((queue) => (
          <div key={queue.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{queue.name}</h4>
                  <Badge variant={queue.is_active ? "default" : "secondary"}>
                    {queue.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                {queue.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {queue.description}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span>{getAssistantName(queue.assistant_id)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>
                  {queue.instance_queue_connections?.length || 0} conexão(ões)
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(queue)}
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta fila?')) {
                    onDelete(queue.id);
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

export default QueuesList;
