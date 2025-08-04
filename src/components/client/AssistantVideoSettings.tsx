import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Video, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { assistantsService, AdvancedSettings, VideoLibraryItem } from "@/services/assistantsService";
import { supabase } from "@/integrations/supabase/client";

interface AssistantVideoSettingsProps {
  assistantId: string;
  settings: AdvancedSettings;
  onSettingsChange: (settings: AdvancedSettings) => void;
}

const AssistantVideoSettings = ({ assistantId, settings, onSettingsChange }: AssistantVideoSettingsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [newVideoTrigger, setNewVideoTrigger] = useState("");
  const [newVideoCategory, setNewVideoCategory] = useState("geral");
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [videoLibrary, setVideoLibrary] = useState<VideoLibraryItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Carregar vídeos da nova tabela
  useEffect(() => {
    const loadVideoLibrary = async () => {
      try {
        const { data, error } = await supabase
          .from('assistant_video_library')
          .select('*')
          .eq('assistant_id', assistantId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Converter para formato esperado
        const videos = data?.map(video => ({
          id: video.id,
          name: video.original_name,
          trigger: video.trigger_phrase,
          url: '', // Não carregamos URL aqui
          videoBase64: '', // Não carregamos base64 mais
          format: (video.mime_type.includes('mp4') ? 'mp4' :
                 video.mime_type.includes('avi') ? 'avi' :
                 video.mime_type.includes('mov') ? 'mov' :
                 video.mime_type.includes('webm') ? 'webm' : 'mp4') as 'mp4' | 'avi' | 'mov' | 'webm',
          size: video.file_size,
          category: video.category,
          uploaded_at: video.created_at,
          storagePath: video.storage_path
        })) || [];

        setVideoLibrary(videos);
      } catch (error) {
        console.error('❌ Failed to load video library:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar biblioteca",
          description: "Falha ao carregar vídeos da biblioteca"
        });
      }
    };

    loadVideoLibrary();
  }, [assistantId]);

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!newVideoTrigger.trim()) {
      toast({
        title: "Trigger Obrigatório",
        description: "Digite um trigger para o vídeo antes de fazer upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      console.log('🚀 [COMPONENT] Iniciando upload de vídeo:', {
        assistantId,
        trigger: newVideoTrigger.trim(),
        category: newVideoCategory,
        fileName: file.name
      });

      const videoItem = await assistantsService.uploadVideoToLibrary(
        assistantId,
        file,
        newVideoTrigger.trim(),
        newVideoCategory
      );

      console.log('✅ [COMPONENT] Upload concluído:', videoItem);

      // Atualizar biblioteca local
      setVideoLibrary(prev => [videoItem, ...prev]);

      // Limpar formulário
      setNewVideoTrigger("");
      setNewVideoCategory("geral");
      event.target.value = "";

      toast({
        title: "✅ Vídeo Adicionado",
        description: `Vídeo "${videoItem.name}" foi adicionado à biblioteca com trigger "${videoItem.trigger}"`,
      });

    } catch (error: any) {
      console.error('❌ [COMPONENT] Erro no upload:', error);
      toast({
        title: "❌ Erro no Upload",
        description: error.message || "Falha ao fazer upload do vídeo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      await assistantsService.removeVideoFromLibrary(assistantId, videoId);
      
      // Atualizar biblioteca local
      setVideoLibrary(prev => prev.filter(vid => vid.id !== videoId));

      toast({
        title: "Vídeo Removido",
        description: "O vídeo foi removido da biblioteca",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover vídeo",
        variant: "destructive",
      });
    }
  };

  const showVideoPreview = async (video: VideoLibraryItem) => {
    try {
      if (video.storagePath) {
        // Novo sistema: obter URL do storage
        const { data } = await supabase.storage
          .from('assistant-videos')
          .createSignedUrl(video.storagePath, 3600); // 1 hora
        
        if (data?.signedUrl) {
          setPreviewVideoUrl(data.signedUrl);
          setIsPreviewOpen(true);
        }
      } else if (video.videoBase64) {
        // Sistema legado: usar base64
        const dataUrl = `data:video/${video.format};base64,${video.videoBase64}`;
        setPreviewVideoUrl(dataUrl);
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('❌ Failed to load video preview:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar preview do vídeo"
      });
    }
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
            <Video className="w-5 h-5" />
            <span>Biblioteca de Vídeos</span>
          </CardTitle>
          <CardDescription>
            Gerencie vídeos que podem ser enviados via comando <code>video: trigger</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Upload Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Adicionar Novo Vídeo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="video-trigger">Trigger do Vídeo *</Label>
                <Input
                  id="video-trigger"
                  value={newVideoTrigger}
                  onChange={(e) => setNewVideoTrigger(e.target.value)}
                  placeholder="Ex: apresentacao, tutorial, demo"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use apenas letras, números e hífen. Exemplo: <code>video: tutorial</code>
                </p>
              </div>

              <div>
                <Label htmlFor="video-category">Categoria</Label>
                <Select value={newVideoCategory} onValueChange={setNewVideoCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="tutoriais">Tutoriais</SelectItem>
                    <SelectItem value="promocoes">Promoções</SelectItem>
                    <SelectItem value="apresentacoes">Apresentações</SelectItem>
                    <SelectItem value="demos">Demonstrações</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="video/mp4,video/avi,video/mov,video/webm"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
                disabled={isUploading}
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  {isUploading ? "Enviando..." : "Clique para adicionar vídeo"}
                </p>
                <p className="text-sm text-gray-500">
                  MP4, AVI, MOV, WebM até 100MB
                </p>
              </label>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Como usar comandos de vídeo:</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>No prompt do assistente, adicione instruções como:</strong></p>
              <p className="font-mono bg-blue-100 p-2 rounded">
                "Quando o cliente pedir para ver o tutorial, responda: video: tutorial"
              </p>
              <p className="font-mono bg-blue-100 p-2 rounded">
                "Para mostrar demonstrações, use: video: demo (ou o trigger correspondente)"
              </p>
              <p><strong>Sintaxe:</strong> <code>video: trigger</code></p>
            </div>
          </div>

          {/* Videos Library */}
          {videoLibrary && videoLibrary.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Vídeos na Biblioteca ({videoLibrary.length})</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videoLibrary.map((video) => (
                  <div key={video.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {video.videoBase64 ? (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center relative">
                          <Video className="w-6 h-6 text-gray-600" />
                          <div className="absolute inset-0 bg-black bg-opacity-30 rounded flex items-center justify-center">
                            <div className="w-4 h-4 border-l-4 border-l-white border-y-2 border-y-transparent border-r-0"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{video.name}</p>
                      <p className="text-sm text-green-600 font-mono">video: {video.trigger}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{video.format.toUpperCase()}</Badge>
                        <Badge variant="outline">{formatFileSize(video.size)}</Badge>
                        <Badge variant="outline">{video.category}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => showVideoPreview(video)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleRemoveVideo(video.id)}
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
              <Video className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhum vídeo na biblioteca</p>
              <p className="text-sm">Adicione vídeos para usar com comandos <code>video: trigger</code></p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {isPreviewOpen && previewVideoUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setIsPreviewOpen(false);
            setPreviewVideoUrl(null);
          }}
        >
          <div className="max-w-4xl max-h-4xl p-4">
            <video 
              src={previewVideoUrl} 
              controls
              className="max-w-full max-h-full"
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantVideoSettings;