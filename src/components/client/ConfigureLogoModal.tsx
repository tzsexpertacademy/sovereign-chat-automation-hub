import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Image, X } from 'lucide-react';
import { useClientPersonalization } from '@/hooks/useClientPersonalization';
import type { ClientData } from '@/services/clientsService';

interface ConfigureLogoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientData;
  onUpdate: (client: ClientData) => void;
}

export function ConfigureLogoModal({ open, onOpenChange, client, onUpdate }: ConfigureLogoModalProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(client.company_logo_url || '');
  const { loading, uploadAsset, updateProfile } = useClientPersonalization();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let logoUrl = logoPreview || null;
      
      if (logoFile) {
        logoUrl = await uploadAsset(logoFile, client.id, 'logo');
      }

      const updatedClient = await updateProfile(client.id, {
        company_logo_url: logoUrl
      });

      onUpdate(updatedClient);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar logo:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Logo da Empresa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label>Logo da Empresa</Label>
            
            {logoPreview ? (
              <div className="relative border-2 border-dashed border-border rounded-lg p-4">
                <img 
                  src={logoPreview} 
                  alt="Logo preview" 
                  className="max-h-32 mx-auto object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Nenhum logo carregado
                </p>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 border border-input rounded-md px-4 py-2 cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>{logoPreview ? 'Alterar Logo' : 'Carregar Logo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>

            <p className="text-xs text-muted-foreground">
              Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}