
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queuesService, type QueueWithAssistant } from "@/services/queuesService";
import { funnelService, type FunnelTag } from "@/services/funnelService";
import { type AssistantWithQueues } from "@/services/assistantsService";
import { Save, X, Tag } from "lucide-react";

interface QueueFormProps {
  clientId: string;
  queue?: QueueWithAssistant | null;
  assistants: AssistantWithQueues[];
  onSave: () => void;
  onCancel: () => void;
}

const QueueForm = ({ clientId, queue, assistants, onSave, onCancel }: QueueFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    assistant_id: "",
    is_active: true
  });
  const [tags, setTags] = useState<FunnelTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTags();
    
    if (queue) {
      setFormData({
        name: queue.name,
        description: queue.description || "",
        assistant_id: queue.assistant_id || "",
        is_active: queue.is_active
      });
    }
  }, [queue]);

  const loadTags = async () => {
    try {
      const tagsData = await funnelService.getTags(clientId);
      setTags(tagsData);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da fila é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      if (queue) {
        await queuesService.updateQueue(queue.id, {
          name: formData.name,
          description: formData.description,
          assistant_id: formData.assistant_id || null,
          is_active: formData.is_active
        });
      } else {
        await queuesService.createQueue({
          client_id: clientId,
          name: formData.name,
          description: formData.description,
          assistant_id: formData.assistant_id || null,
          is_active: formData.is_active
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar fila:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar fila",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {queue ? "Editar Fila" : "Nova Fila"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome da Fila *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  name: e.target.value 
                }))}
                placeholder="Ex: Atendimento Geral"
                required
              />
            </div>

            <div>
              <Label htmlFor="assistant">Assistente</Label>
              <Select 
                value={formData.assistant_id} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  assistant_id: value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um assistente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem assistente (manual)</SelectItem>
                  {assistants
                    .filter(assistant => assistant.is_active)
                    .map((assistant) => (
                    <SelectItem key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              placeholder="Descreva o propósito desta fila..."
              rows={3}
            />
          </div>

          {/* Tags de organização */}
          {tags.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Tags de Organização
              </Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    style={{
                      backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                      borderColor: tag.color,
                      color: selectedTags.includes(tag.id) ? 'white' : tag.color
                    }}
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedTags.length} tag(s) selecionada(s)
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                is_active: checked 
              }))}
            />
            <Label htmlFor="is_active">Fila ativa</Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QueueForm;
