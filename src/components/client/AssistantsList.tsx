import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Edit, Trash2, Zap, Settings, TestTube } from "lucide-react";
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
  
  const handleTestAssistant = async (assistant: AssistantWithQueues) => {
    try {
      toast.info("🧪 Testando assistente com Evolution API v2.2.1...");
      
      // Buscar primeira instância ativa do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status')
        .eq('client_id', assistant.client_id)
        .eq('status', 'connected')
        .limit(1);
      
      if (!instances || instances.length === 0) {
        toast.error("❌ Nenhuma instância WhatsApp conectada encontrada");
        return;
      }
      
      const instanceId = instances[0].instance_id;
      
      // Simular mensagem de teste para o assistente
      const { data, error } = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          ticketId: 'test-' + Date.now(),
          message: 'Olá, teste da Evolution API v2.2.1',
          clientId: assistant.client_id,
          instanceId: instanceId,
          assistant: {
            id: assistant.id,
            name: assistant.name,
            prompt: assistant.prompt,
            model: assistant.model || 'gpt-4o-mini'
          },
          context: {
            customerName: 'Teste Sistema',
            phoneNumber: '554700000000',
            chatId: '554700000000@s.whatsapp.net'
          }
        }
      });
      
      if (error) {
        console.error('❌ Erro no teste:', error);
        toast.error(`❌ Erro no teste: ${error.message}`);
        return;
      }
      
      if (data?.success) {
        toast.success(`✅ Assistente testado com sucesso! Resposta gerada e enviada via Evolution API v2.2.1`);
      } else {
        toast.warning(`⚠️ Resposta gerada mas falha no envio: ${data?.error || 'Erro desconhecido'}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao testar assistente:', error);
      toast.error("❌ Erro ao testar assistente");
    }
  };
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
        {assistants.map((assistant) => {
          const triggersArray = jsonToStringArray(assistant.triggers);
          
          return (
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
                
                {triggersArray.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <Zap className="h-3 w-3 text-muted-foreground mt-1" />
                    {triggersArray.slice(0, 3).map((trigger, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {trigger}
                      </Badge>
                    ))}
                    {triggersArray.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{triggersArray.length - 3}
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
                  onClick={() => onAdvancedSettings(assistant)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configurações
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestAssistant(assistant)}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <TestTube className="h-3 w-3 mr-1" />
                  Testar
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
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AssistantsList;
