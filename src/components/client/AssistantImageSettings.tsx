import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Image, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { assistantsService, AdvancedSettings, ImageLibraryItem } from "@/services/assistantsService";

interface AssistantImageSettingsProps {
  assistantId: string;
  settings: AdvancedSettings;
  onSettingsChange: (settings: AdvancedSettings) => void;
}

const AssistantImageSettings = ({ assistantId, settings, onSettingsChange }: AssistantImageSettingsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [newImageTrigger, setNewImageTrigger] = useState("");
  const [newImageCategory, setNewImageCategory] = useState("geral");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const { toast } = useToast();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!newImageTrigger.trim()) {
      toast({
        title: "Trigger Obrigatório",
        description: "Digite um trigger para a imagem antes de fazer upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      console.log('🚀 [COMPONENT] Iniciando upload de imagem:', {
        assistantId,
        trigger: newImageTrigger.trim(),
        category: newImageCategory,
        fileName: file.name
      });

      const imageItem = await assistantsService.uploadImageToLibrary(
        assistantId,
        file,
        newImageTrigger.trim(),
        newImageCategory
      );

      console.log('✅ [COMPONENT] Upload concluído:', imageItem);

      // Atualizar configurações locais
      const updatedSettings = {
        ...settings,
        image_library: [...(settings.image_library || []), imageItem]
      };
      onSettingsChange(updatedSettings);

      // Limpar formulário
      setNewImageTrigger("");
      setNewImageCategory("geral");
      event.target.value = "";

      toast({
        title: "✅ Imagem Adicionada",
        description: `Imagem "${imageItem.name}" foi adicionada à biblioteca com trigger "${imageItem.trigger}"`,
      });

    } catch (error: any) {
      console.error('❌ [COMPONENT] Erro no upload:', error);
      toast({
        title: "❌ Erro no Upload",
        description: error.message || "Falha ao fazer upload da imagem",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      await assistantsService.removeImageFromLibrary(assistantId, imageId);
      
      // Atualizar configurações locais
      const updatedSettings = {
        ...settings,
        image_library: (settings.image_library || []).filter(img => img.id !== imageId)
      };
      onSettingsChange(updatedSettings);

      toast({
        title: "Imagem Removida",
        description: "A imagem foi removida da biblioteca",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover imagem",
        variant: "destructive",
      });
    }
  };

  const showImagePreview = (imageData: string, format: string) => {
    const dataUrl = `data:image/${format};base64,${imageData}`;
    setPreviewImage(dataUrl);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="w-5 h-5" />
            <span>Biblioteca de Imagens</span>
          </CardTitle>
          <CardDescription>
            Gerencie imagens que podem ser enviadas via comando <code>image: trigger</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Upload Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Adicionar Nova Imagem</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="image-trigger">Trigger da Imagem *</Label>
                <Input
                  id="image-trigger"
                  value={newImageTrigger}
                  onChange={(e) => setNewImageTrigger(e.target.value)}
                  placeholder="Ex: logo, banner, produto1"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use apenas letras, números e hífen. Exemplo: <code>image: logo</code>
                </p>
              </div>

              <div>
                <Label htmlFor="image-category">Categoria</Label>
                <Select value={newImageCategory} onValueChange={setNewImageCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="produtos">Produtos</SelectItem>
                    <SelectItem value="promocoes">Promoções</SelectItem>
                    <SelectItem value="documentos">Documentos</SelectItem>
                    <SelectItem value="logos">Logos e Marca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  {isUploading ? "Enviando..." : "Clique para adicionar imagem"}
                </p>
                <p className="text-sm text-gray-500">
                  JPG, PNG, GIF, WebP até 10MB
                </p>
              </label>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Como usar comandos de imagem:</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>No prompt do assistente, adicione instruções como:</strong></p>
              <p className="font-mono bg-blue-100 p-2 rounded">
                "Quando o cliente pedir para ver o logo da empresa, responda: image: logo"
              </p>
              <p className="font-mono bg-blue-100 p-2 rounded">
                "Para mostrar produtos, use: image: produto1 (ou o trigger correspondente)"
              </p>
              <p><strong>Sintaxe:</strong> <code>image: trigger</code></p>
            </div>
          </div>

          {/* Images Library */}
          {settings.image_library && settings.image_library.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Imagens na Biblioteca ({settings.image_library.length})</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.image_library.map((image) => (
                  <div key={image.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {image.imageBase64 ? (
                        <img 
                          src={`data:image/${image.format};base64,${image.imageBase64}`}
                          alt={image.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                          <Image className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{image.name}</p>
                      <p className="text-sm text-green-600 font-mono">image: {image.trigger}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{image.format.toUpperCase()}</Badge>
                        <Badge variant="outline">{formatFileSize(image.size)}</Badge>
                        <Badge variant="outline">{image.category}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {image.imageBase64 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => showImagePreview(image.imageBase64!, image.format)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleRemoveImage(image.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Image className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhuma imagem na biblioteca</p>
              <p className="text-sm">Adicione imagens para usar com comandos <code>image: trigger</code></p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-4xl p-4">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantImageSettings;