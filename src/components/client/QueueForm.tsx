
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queuesService, type Queue } from "@/services/queuesService";
import { type AssistantWithQueues } from "@/services/assistantsService";

interface QueueFormProps {
  clientId: string;
  queue?: Queue | null;
  assistants: AssistantWithQueues[];
  onSave: () => void;
  onCancel: () => void;
}

const QueueForm = ({ clientId, queue, assistants, onSave, onCancel }: QueueFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queue) {
      setName(queue.name || "");
      setDescription(queue.description || "");
      setAssistantId(queue.assistant_id || "");
    }
  }, [queue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert("Por favor, insira o nome da fila");
      return;
    }

    try {
      setLoading(true);
      
      const queueData = {
        client_id: clientId,
        name: name.trim(),
        description: description.trim() || null,
        assistant_id: assistantId || null,
        is_active: true
      };

      if (queue) {
        await queuesService.updateQueue(queue.id, queueData);
      } else {
        await queuesService.createQueue(queueData);
      }
      
      onSave();
    } catch (error) {
      console.error('Erro ao salvar fila:', error);
      alert("Erro ao salvar fila");
    } finally {
      setLoading(false);
    }
  };

  const activeAssistants = assistants.filter(a => a.is_active);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {queue ? "Editar Fila" : "Nova Fila"}
        </CardTitle>
        <CardDescription>
          Configure uma fila para organizar o atendimento e conectar com assistentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Fila *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Atendimento Inicial, Suporte Técnico, Vendas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito desta fila..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistant">Assistente Responsável</Label>
            <Select value={assistantId} onValueChange={setAssistantId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um assistente (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum assistente</SelectItem>
                {activeAssistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name} ({assistant.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assistente que será responsável por responder nesta fila
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : queue ? "Atualizar" : "Criar"} Fila
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

export default QueueForm;
