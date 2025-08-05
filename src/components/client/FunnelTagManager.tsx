import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FunnelTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];
  onTagsUpdate: (tags: string[]) => void;
}

const FunnelTagManager = ({ isOpen, onClose, availableTags, onTagsUpdate }: FunnelTagManagerProps) => {
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>(availableTags);
  const { toast } = useToast();

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      onTagsUpdate(updatedTags);
      setNewTag('');
      toast({
        title: "Tag criada",
        description: `Tag "${newTag.trim()}" foi criada com sucesso!`
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    onTagsUpdate(updatedTags);
    toast({
      title: "Tag removida",
      description: `Tag "${tagToRemove}" foi removida.`
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Gerenciar Tags do Funil
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button onClick={handleAddTag} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Tags Disponíveis</h4>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tag disponível. Crie sua primeira tag acima.
                </p>
              )}
            </div>
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

export default FunnelTagManager;