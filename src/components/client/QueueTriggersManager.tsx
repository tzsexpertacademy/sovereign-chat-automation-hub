import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Settings,
  ArrowRight,
  MessageSquare,
  Bot,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { type QueueWithAssistant } from "@/services/queuesService";
import { useQueueTriggers, type HandoffTrigger } from "@/hooks/useQueueTriggers";

interface QueueTriggersManagerProps {
  clientId: string;
  queues: QueueWithAssistant[];
  onTriggersUpdated: () => void;
}

const QueueTriggersManager: React.FC<QueueTriggersManagerProps> = ({ 
  clientId, 
  queues, 
  onTriggersUpdated 
}) => {
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [newKeyword, setNewKeyword] = useState('');
  
  const { triggers, setTriggers, saveTriggers, loading } = useQueueTriggers(selectedQueue || undefined);

  const handleSaveTriggers = async () => {
    await saveTriggers(triggers);
    onTriggersUpdated();
  };

  const addTrigger = () => {
    const newTrigger: HandoffTrigger = {
      keywords: [],
      target_queue_id: '',
      enabled: true
    };

    setTriggers([...triggers, newTrigger]);
  };

  const updateTrigger = (index: number, field: keyof HandoffTrigger, value: any) => {
    const updatedTriggers = [...triggers];
    updatedTriggers[index] = { ...updatedTriggers[index], [field]: value };
    setTriggers(updatedTriggers);
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const addKeywordToTrigger = (triggerIndex: number) => {
    if (!newKeyword.trim()) return;

    const updatedTriggers = [...triggers];
    updatedTriggers[triggerIndex].keywords.push(newKeyword.trim());
    setTriggers(updatedTriggers);
    setNewKeyword('');
  };

  const removeKeywordFromTrigger = (triggerIndex: number, keywordIndex: number) => {
    const updatedTriggers = [...triggers];
    updatedTriggers[triggerIndex].keywords = updatedTriggers[triggerIndex].keywords.filter((_, i) => i !== keywordIndex);
    setTriggers(updatedTriggers);
  };

  const getQueueName = (queueId: string) => {
    const queue = queues.find(q => q.id === queueId);
    return queue?.name || 'Fila não encontrada';
  };

  const selectedQueueData = queues.find(q => q.id === selectedQueue);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gerenciamento de Gatilhos Automáticos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure palavras-chave para transferências automáticas entre filas
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="queue-select">Selecionar Fila</Label>
              <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma fila para configurar" />
                </SelectTrigger>
                <SelectContent>
                  {queues.map(queue => (
                    <SelectItem key={queue.id} value={queue.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        {queue.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedQueue && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Gatilhos da Fila: {selectedQueueData?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {triggers.length} gatilho(s) configurado(s)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addTrigger}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Gatilho
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveTriggers}
                      disabled={loading}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {loading ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>

                {triggers.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="font-medium mb-2">Nenhum gatilho configurado</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione gatilhos para automatizar transferências baseadas em palavras-chave
                      </p>
                      <Button variant="outline" onClick={addTrigger}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar primeiro gatilho
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {triggers.map((trigger, triggerIndex) => (
                      <Card key={triggerIndex} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">Gatilho #{triggerIndex + 1}</h4>
                                <Switch
                                  checked={trigger.enabled}
                                  onCheckedChange={(checked) => updateTrigger(triggerIndex, 'enabled', checked)}
                                />
                                <Badge variant={trigger.enabled ? "default" : "secondary"}>
                                  {trigger.enabled ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTrigger(triggerIndex)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>

                            {/* Fila de destino */}
                            <div>
                              <Label>Transferir para Fila</Label>
                              <Select
                                value={trigger.target_queue_id}
                                onValueChange={(value) => updateTrigger(triggerIndex, 'target_queue_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a fila de destino" />
                                </SelectTrigger>
                                <SelectContent>
                                  {queues.filter(q => q.id !== selectedQueue).map(queue => (
                                    <SelectItem key={queue.id} value={queue.id}>
                                      <div className="flex items-center gap-2">
                                        <ArrowRight className="h-3 w-3" />
                                        {queue.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Palavras-chave */}
                            <div>
                              <Label>Palavras-chave</Label>
                              <div className="flex gap-2 mb-2">
                                <Input
                                  placeholder="Digite uma palavra-chave..."
                                  value={newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      addKeywordToTrigger(triggerIndex);
                                    }
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  onClick={() => addKeywordToTrigger(triggerIndex)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                {trigger.keywords.map((keyword, keywordIndex) => (
                                  <Badge 
                                    key={keywordIndex} 
                                    variant="secondary" 
                                    className="cursor-pointer hover:bg-red-100"
                                    onClick={() => removeKeywordFromTrigger(triggerIndex, keywordIndex)}
                                  >
                                    {keyword}
                                    <Trash2 className="h-3 w-3 ml-1" />
                                  </Badge>
                                ))}
                              </div>
                              
                              {trigger.keywords.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma palavra-chave configurada
                                </p>
                              )}
                            </div>

                            {/* Preview da regra */}
                            {trigger.target_queue_id && trigger.keywords.length > 0 && (
                              <div className="bg-muted/50 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-sm">
                                  <Bot className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">Regra:</span>
                                  <span>
                                    Se mensagem contiver "{trigger.keywords.join('" OU "')}"
                                  </span>
                                  <ArrowRight className="h-4 w-4" />
                                  <span className="font-medium">
                                    transferir para "{getQueueName(trigger.target_queue_id)}"
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exemplo de gatilhos pré-configurados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Exemplos de Gatilhos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">✅ Atendimento Humano</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Palavras: "atendimento humano", "falar com humano", "quero pessoa"
              </p>
              <Badge variant="default">Para Fila de Atendimento</Badge>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">💰 Vendas</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Palavras: "comprar", "preço", "vendas", "orçamento"
              </p>
              <Badge variant="secondary">Para Fila de Vendas</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueueTriggersManager;