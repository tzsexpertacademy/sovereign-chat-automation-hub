import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, Loader2, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { supabase } from '@/integrations/supabase/client';

interface ImageViewerProps {
  imageUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  fileSha256?: string;
  directPath?: string;
  mediaMimeType?: string;
  needsDecryption?: boolean;
  caption?: string;
  fileName?: string;
  message?: any; // Objeto da mensagem completo para acessar image_base64
  instanceId?: string;
}

const ImageViewer = ({ 
  imageUrl, 
  messageId,
  mediaKey,
  fileEncSha256,
  fileSha256,
  directPath,
  mediaMimeType,
  needsDecryption = false,
  caption,
  fileName = 'image.jpg',
  message,
  instanceId
}: ImageViewerProps) => {
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Inicializar imagem com estratégia otimizada
  useEffect(() => {
    let mounted = true;
    
    const processImage = async () => {
      if (!mounted) return;
      
      setIsLoading(true);
      setError(null);
      
      console.log('🖼️ ImageViewer: Processando imagem:', {
        hasImageUrl: !!imageUrl,
        hasMessageId: !!messageId,
        hasMediaKey: !!mediaKey,
        needsDecryption,
        mediaMimeType
      });

      try {
        // PRIORIDADE 1: Se já tem image_base64, usar diretamente
        if (message?.image_base64) {
          console.log('✅ ImageViewer: Usando image_base64 diretamente');
          const mimeType = mediaMimeType || message.media_mime_type || 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${message.image_base64}`;
          setDisplayImageUrl(dataUrl);
          return;
        }

        // PRIORIDADE 2: Para mensagens manuais sem base64, mostrar erro específico
        const isManualMessage = messageId?.startsWith('manual_');
        if (isManualMessage) {
          console.log('❌ ImageViewer: Mensagem manual sem image_base64 salvo');
          setError('Imagem manual não disponível - base64 não foi salvo corretamente');
          return;
        }
        
        // PRIORIDADE 3: Para mensagens que precisam de descriptografia
        if (imageUrl && mediaKey) {
          console.log('🔓 ImageViewer: Tentando descriptografar via DirectMediaDownloadService');
          setIsDecrypting(true);
          
          const currentUrl = window.location.pathname;
          const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
          const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
          
          if (ticketId) {
            const { data: ticketData } = await supabase
              .from('conversation_tickets')
              .select('instance_id')
              .eq('id', ticketId)
              .single();
            
            if (ticketData?.instance_id) {
              const result = await directMediaDownloadService.processMedia(
                ticketData.instance_id,
                messageId || `img_${Date.now()}`,
                imageUrl,
                mediaKey,
                directPath,
                mediaMimeType || 'image/jpeg',
                'image'
              );

              if (result.success && result.mediaUrl) {
                console.log('✅ ImageViewer: Descriptografia bem-sucedida');
                setDisplayImageUrl(result.mediaUrl);
                return;
              }
              
              console.log('⚠️ ImageViewer: Descriptografia falhou, usando fallback');
            }
          }
        }

        // FALLBACK FINAL: URL original 
        if (imageUrl) {
          console.log('🔄 ImageViewer: Fallback final - URL original');
          setDisplayImageUrl(imageUrl);
          return;
        }

        // Falha total
        setError('Imagem não disponível');

      } catch (error) {
        console.error('❌ ImageViewer: Erro no processamento:', error);
        setError('Erro ao carregar imagem');
        
        // Último fallback
        if (imageUrl) {
          setDisplayImageUrl(imageUrl);
        }
      } finally {
        setIsLoading(false);
        setIsDecrypting(false);
      }
    };

    processImage();
    
    return () => {
      mounted = false;
    };
  }, [imageUrl, messageId, mediaKey, directPath, mediaMimeType, needsDecryption]);

  const handleImageError = () => {
    console.error('❌ ImageViewer: Erro ao carregar imagem no elemento img');
    setError('Erro ao carregar imagem');
  };

  const downloadImage = async () => {
    try {
      setIsLoading(true);
      
      if (!displayImageUrl) {
        toast.error('Nenhuma imagem disponível para download');
        return;
      }

      // Se é uma URL de dados (base64), converter para blob
      if (displayImageUrl.startsWith('data:')) {
        const response = await fetch(displayImageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // URL direta
        const a = document.createElement('a');
        a.href = displayImageUrl;
        a.download = fileName;
        a.target = '_blank';
        a.click();
      }
      
      toast.success('Download da imagem iniciado');
    } catch (error) {
      console.error('❌ ImageViewer: Erro ao baixar imagem:', error);
      toast.error('Erro ao baixar imagem');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar preview pequeno da imagem
  const renderImagePreview = () => {
    if (isLoading || isDecrypting) {
      return (
        <div className="flex items-center justify-center w-48 h-32 bg-muted rounded-lg border">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {isDecrypting ? 'Descriptografando...' : 'Carregando...'}
            </span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center w-48 h-32 bg-muted rounded-lg border border-destructive/20">
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <span className="text-xs text-destructive text-center px-2" title={error}>
              {error}
            </span>
          </div>
        </div>
      );
    }

    if (displayImageUrl) {
      return (
        <div className="relative group">
          <img
            src={displayImageUrl}
            alt={caption || "Imagem"}
            className="w-48 h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center w-48 h-32 bg-muted rounded-lg border">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Imagem indisponível</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 max-w-xs">
      <Dialog>
        <DialogTrigger asChild>
          <div className="cursor-pointer">
            {renderImagePreview()}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Visualizar Imagem</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {displayImageUrl && !error ? (
              <img
                src={displayImageUrl}
                alt={caption || "Imagem em tamanho completo"}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
                onError={handleImageError}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-64 bg-muted rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {error || 'Imagem não disponível'}
                  </span>
                </div>
              </div>
            )}
            
            {caption && (
              <div className="text-sm text-muted-foreground text-center max-w-md">
                {caption}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Controles */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          Imagem
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={downloadImage}
          disabled={!displayImageUrl || isLoading}
          className="h-6 px-2 text-xs"
          title="Baixar imagem"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Caption se existir */}
      {caption && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border-l-2 border-primary/30">
          {caption}
        </div>
      )}
    </div>
  );
};

export default ImageViewer;