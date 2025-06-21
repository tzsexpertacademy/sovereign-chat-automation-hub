
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { funnelService, type FunnelStage } from "@/services/funnelService";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Plus, GripVertical, Edit, Trash2, Save, X } from 'lucide-react';

interface FunnelStageEditorProps {
  clientId: string;
  stages: FunnelStage[];
  onClose: () => void;
  onSave: () => void;
}

const FunnelStageEditor: React.FC<FunnelStageEditorProps> = ({
  clientId,
  stages: initialStages,
  onClose,
  onSave
}) => {
  const [stages, setStages] = useState(initialStages);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);
  const [newStage, setNewStage] = useState({
    name: '',
    description: '',
    color: '#10B981'
  });
  const [showNewStageForm, setShowNewStageForm] = useState(false);
  const { toast } = useToast();

  const colors = [
    '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', 
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
  ];

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Atualizar posições
    const updatedStages = items.map((stage, index) => ({
      ...stage,
      position: index
    }));

    setStages(updatedStages);

    try {
      await funnelService.reorderStages(clientId, updatedStages.map(s => s.id));
      toast({
        title: "Sucesso",
        description: "Ordem dos estágios atualizada!",
      });
    } catch (error) {
      console.error('Error reordering stages:', error);
      toast({
        title: "Erro",
        description: "Erro ao reordenar estágios",
        variant: "destructive"
      });
    }
  };

  const handleCreateStage = async () => {
    if (!newStage.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do estágio é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const createdStage = await funnelService.createStage(clientId, {
        ...newStage,
        position: stages.length
      });

      setStages([...stages, createdStage]);
      setNewStage({ name: '', description: '', color: '#10B981' });
      setShowNewStageForm(false);

      toast({
        title: "Sucesso",
        description: "Estágio criado com sucesso!",
      });
    } catch (error) {
      console.error('Error creating stage:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar estágio",
        variant: "destructive"
      });
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage) return;

    try {
      const updatedStage = await funnelService.updateStage(editingStage.id, editingStage);
      
      setStages(stages.map(stage => 
        stage.id === updatedStage.id ? updatedStage : stage
      ));
      setEditingStage(null);

      toast({
        title: "Sucesso",
        description: "Estágio atualizado com sucesso!",
      });
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar estágio",
        variant: "destructive"
      });
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    try {
      await funnelService.deleteStage(stageId);
      setStages(stages.filter(stage => stage.id !== stageId));

      toast({
        title: "Sucesso",
        description: "Estágio removido com sucesso!",
      });
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover estágio",
        variant: "destructive"
      });
    }
  };

  const handleSave = () => {
    onSave();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Estágios do Funil</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Novo estágio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adicionar Novo Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              {!showNewStageForm ? (
                <Button 
                  onClick={() => setShowNewStageForm(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Estágio
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-stage-name">Nome</Label>
                      <Input
                        id="new-stage-name"
                        value={newStage.name}
                        onChange={(e) => setNewStage(prev => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))}
                        placeholder="Ex: Qualificação"
                      />
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <div className="flex gap-2 mt-1">
                        {colors.map(color => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded-full border-2 ${
                              newStage.color === color 
                                ? 'border-gray-800 scale-110' 
                                : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewStage(prev => ({ 
                              ...prev, 
                              color 
                            }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="new-stage-description">Descrição</Label>
                    <Textarea
                      id="new-stage-description"
                      value={newStage.description}
                      onChange={(e) => setNewStage(prev => ({ 
                        ...prev, 
                        description: e.target.value 
                      }))}
                      placeholder="Descrição do estágio..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateStage}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowNewStageForm(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de estágios existentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estágios Atuais</CardTitle>
              <p className="text-sm text-muted-foreground">
                Arraste para reordenar os estágios
              </p>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {stages.map((stage, index) => (
                        <Draggable 
                          key={stage.id} 
                          draggableId={stage.id} 
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`mb-3 ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <Card>
                                <CardContent className="p-4">
                                  {editingStage?.id === stage.id ? (
                                    // Modo de edição
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label>Nome</Label>
                                          <Input
                                            value={editingStage.name}
                                            onChange={(e) => setEditingStage({
                                              ...editingStage,
                                              name: e.target.value
                                            })}
                                          />
                                        </div>
                                        <div>
                                          <Label>Cor</Label>
                                          <div className="flex gap-2 mt-1">
                                            {colors.map(color => (
                                              <button
                                                key={color}
                                                className={`w-6 h-6 rounded-full border-2 ${
                                                  editingStage.color === color 
                                                    ? 'border-gray-800 scale-110' 
                                                    : 'border-gray-300'
                                                }`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setEditingStage({
                                                  ...editingStage,
                                                  color
                                                })}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <Label>Descrição</Label>
                                        <Textarea
                                          value={editingStage.description || ''}
                                          onChange={(e) => setEditingStage({
                                            ...editingStage,
                                            description: e.target.value
                                          })}
                                        />
                                      </div>

                                      <div className="flex gap-2">
                                        <Button 
                                          size="sm" 
                                          onClick={handleUpdateStage}
                                        >
                                          Salvar
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => setEditingStage(null)}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    // Modo de visualização
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div 
                                          {...provided.dragHandleProps}
                                          className="cursor-grab"
                                        >
                                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div 
                                          className="w-4 h-4 rounded-full"
                                          style={{ backgroundColor: stage.color }}
                                        />
                                        <div>
                                          <h4 className="font-medium">{stage.name}</h4>
                                          {stage.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {stage.description}
                                            </p>
                                          )}
                                        </div>
                                        <Badge variant="secondary">
                                          Posição {stage.position + 1}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingStage(stage)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteStage(stage.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Concluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FunnelStageEditor;
