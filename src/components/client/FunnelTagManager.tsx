
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { funnelService, type FunnelTag } from "@/services/funnelService";
import { Plus, Edit, Trash2, Save, X, Tag } from 'lucide-react';

interface FunnelTagManagerProps {
  clientId: string;
  tags: FunnelTag[];
  onClose: () => void;
  onSave: () => void;
}

const FunnelTagManager: React.FC<FunnelTagManagerProps> = ({
  clientId,
  tags: initialTags,
  onClose,
  onSave
}) => {
  const [tags, setTags] = useState(initialTags);
  const [editingTag, setEditingTag] = useState<FunnelTag | null>(null);
  const [newTag, setNewTag] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const { toast } = useToast();

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#6B7280', '#DC2626', '#7C3AED', '#059669'
  ];

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da tag é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const createdTag = await funnelService.createTag(clientId, newTag);
      
      setTags([...tags, createdTag]);
      setNewTag({ name: '', description: '', color: '#3B82F6' });
      setShowNewTagForm(false);

      toast({
        title: "Sucesso",
        description: "Tag criada com sucesso!",
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar tag",
        variant: "destructive"
      });
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag) return;

    try {
      const { data, error } = await supabase
        .from('funnel_tags')
        .update({
          name: editingTag.name,
          description: editingTag.description,
          color: editingTag.color
        })
        .eq('id', editingTag.id)
        .select()
        .single();

      if (error) throw error;

      setTags(tags.map(tag => 
        tag.id === data.id ? data : tag
      ));
      setEditingTag(null);

      toast({
        title: "Sucesso",
        description: "Tag atualizada com sucesso!",
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar tag",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('funnel_tags')
        .update({ is_active: false })
        .eq('id', tagId);

      if (error) throw error;

      setTags(tags.filter(tag => tag.id !== tagId));

      toast({
        title: "Sucesso",
        description: "Tag removida com sucesso!",
      });
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover tag",
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
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Nova tag */}
          <Card>
            <CardContent className="p-4">
              {!showNewTagForm ? (
                <Button 
                  onClick={() => setShowNewTagForm(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Nova Tag
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-tag-name">Nome</Label>
                      <Input
                        id="new-tag-name"
                        value={newTag.name}
                        onChange={(e) => setNewTag(prev => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))}
                        placeholder="Ex: Hot Lead"
                      />
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {colors.map(color => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded-full border-2 ${
                              newTag.color === color 
                                ? 'border-gray-800 scale-110' 
                                : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTag(prev => ({ 
                              ...prev, 
                              color 
                            }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="new-tag-description">Descrição</Label>
                    <Textarea
                      id="new-tag-description"
                      value={newTag.description}
                      onChange={(e) => setNewTag(prev => ({ 
                        ...prev, 
                        description: e.target.value 
                      }))}
                      placeholder="Descrição da tag..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateTag}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowNewTagForm(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>

                  {/* Preview da tag */}
                  {newTag.name && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <Label className="text-sm font-medium mb-2 block">Preview:</Label>
                      <Badge 
                        style={{ backgroundColor: newTag.color }}
                        className="text-white"
                      >
                        {newTag.name}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de tags existentes */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Tags Existentes</h3>
            
            <div className="grid gap-3">
              {tags.map(tag => (
                <Card key={tag.id}>
                  <CardContent className="p-4">
                    {editingTag?.id === tag.id ? (
                      // Modo de edição
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Nome</Label>
                            <Input
                              value={editingTag.name}
                              onChange={(e) => setEditingTag({
                                ...editingTag,
                                name: e.target.value
                              })}
                            />
                          </div>
                          <div>
                            <Label>Cor</Label>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {colors.map(color => (
                                <button
                                  key={color}
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    editingTag.color === color 
                                      ? 'border-gray-800 scale-110' 
                                      : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditingTag({
                                    ...editingTag,
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
                            value={editingTag.description || ''}
                            onChange={(e) => setEditingTag({
                              ...editingTag,
                              description: e.target.value
                            })}
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={handleUpdateTag}
                          >
                            Salvar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditingTag(null)}
                          >
                            Cancelar
                          </Button>
                        </div>

                        {/* Preview durante edição */}
                        <div className="p-3 bg-muted rounded-md">
                          <Label className="text-sm font-medium mb-2 block">Preview:</Label>
                          <Badge 
                            style={{ backgroundColor: editingTag.color }}
                            className="text-white"
                          >
                            {editingTag.name}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      // Modo de visualização
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge 
                            style={{ backgroundColor: tag.color }}
                            className="text-white"
                          >
                            {tag.name}
                          </Badge>
                          {tag.description && (
                            <span className="text-sm text-muted-foreground">
                              {tag.description}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTag(tag)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {tags.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma tag criada ainda.</p>
                <p className="text-sm">Crie sua primeira tag para organizar seus leads!</p>
              </div>
            )}
          </div>

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

export default FunnelTagManager;
