import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Tag, Palette, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { funnelService, type FunnelTag } from '@/services/funnelService';

interface FunnelTagManagerV2Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  availableTags: FunnelTag[];
  onTagsUpdate: () => void;
}

const FunnelTagManagerV2: React.FC<FunnelTagManagerV2Props> = ({ 
  isOpen, 
  onClose, 
  clientId,
  availableTags,
  onTagsUpdate 
}) => {
  const [tags, setTags] = useState<FunnelTag[]>(availableTags);
  const [newTag, setNewTag] = useState({ name: '', color: '#3B82F6', description: '' });
  const [editingTag, setEditingTag] = useState<FunnelTag | null>(null);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const { toast } = useToast();

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  useEffect(() => {
    setTags(availableTags);
  }, [availableTags]);

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
      const createdTag = await funnelService.createTag(clientId, {
        name: newTag.name.trim(),
        color: newTag.color,
        description: newTag.description
      });

      setTags(prev => [...prev, createdTag]);
      setNewTag({ name: '', color: '#3B82F6', description: '' });
      setShowNewTagForm(false);
      onTagsUpdate();

      toast({
        title: "Sucesso",
        description: `Tag "${createdTag.name}" criada com sucesso!`
      });
    } catch (error) {
      console.error('Erro ao criar tag:', error);
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
      const updatedTag = await funnelService.updateTag(editingTag.id, {
        name: editingTag.name,
        color: editingTag.color,
        description: editingTag.description
      });

      setTags(prev => prev.map(tag => 
        tag.id === updatedTag.id ? updatedTag : tag
      ));
      setEditingTag(null);
      onTagsUpdate();

      toast({
        title: "Sucesso",
        description: "Tag atualizada com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar tag",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await funnelService.deleteTag(tagId);
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      onTagsUpdate();

      toast({
        title: "Sucesso",
        description: "Tag removida com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover tag",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Gerenciar Tags do Funil
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Novo tag */}
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
                      <Label htmlFor="tag-name">Nome</Label>
                      <Input
                        id="tag-name"
                        value={newTag.name}
                        onChange={(e) => setNewTag(prev => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))}
                        placeholder="Ex: Qualificado"
                      />
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <div className="flex gap-2 mt-2">
                        {colors.map(color => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
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
                    <Label htmlFor="tag-description">Descrição (Opcional)</Label>
                    <Input
                      id="tag-description"
                      value={newTag.description}
                      onChange={(e) => setNewTag(prev => ({ 
                        ...prev, 
                        description: e.target.value 
                      }))}
                      placeholder="Descrição da tag..."
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de tags existentes */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Tags Disponíveis</h4>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma tag criada. Adicione sua primeira tag acima.
              </p>
            ) : (
              <div className="grid gap-3">
                {tags.map(tag => (
                  <Card key={tag.id}>
                    <CardContent className="p-3">
                      {editingTag?.id === tag.id ? (
                        // Modo de edição
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
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
                              <div className="flex gap-2 mt-1">
                                {colors.map(color => (
                                  <button
                                    key={color}
                                    className={`w-5 h-5 rounded-full border-2 ${
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
                            <Input
                              value={editingTag.description || ''}
                              onChange={(e) => setEditingTag({
                                ...editingTag,
                                description: e.target.value
                              })}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateTag}>
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
                        </div>
                      ) : (
                        // Modo de visualização
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <div>
                              <div className="font-medium">{tag.name}</div>
                              {tag.description && (
                                <div className="text-sm text-muted-foreground">
                                  {tag.description}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTag(tag)}
                            >
                              <Palette className="h-4 w-4" />
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
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FunnelTagManagerV2;