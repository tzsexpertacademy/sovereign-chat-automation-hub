import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, Loader2, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { mediaDisplayService } from '@/services/mediaDisplayService';
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
  fileName = 'image.jpg'
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
        // ESTRATÉGIA 1: URL direta para mensagens manuais
        if (imageUrl && !needsDecryption && !messageId) {
          console.log('✅ ImageViewer: URL direta (mensagem manual)');
          setDisplayImageUrl(imageUrl);
          return;
        }

        // ESTRATÉGIA 2: DirectMediaDownloadService para mensagens com metadados
        if (messageId && mediaKey && imageUrl && directPath) {
          console.log('🚀 ImageViewer: Usando DirectMediaDownloadService');
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
                messageId,
                imageUrl,
                mediaKey,
                directPath,
                mediaMimeType || 'image/jpeg',
                'image'
              );

              if (result.success && result.mediaUrl) {
                console.log('✅ ImageViewer: Sucesso via DirectMedia');
                setDisplayImageUrl(result.mediaUrl);
                return;
              }
              
              console.log('⚠️ ImageViewer: DirectMedia falhou:', result.error);
            }
          }
        }

        // ESTRATÉGIA 3: MediaDisplayService (fallback)
        if (messageId) {
          console.log('🔄 ImageViewer: Fallback MediaDisplayService');
          
          const currentUrl = window.location.pathname;
          const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
          const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
          
          if (ticketId) {
            const { data: ticketData } = await supabase
              .from('conversation_tickets')
              .select('instance_id, chat_id')
              .eq('id', ticketId)
              .single();
            
            if (ticketData?.instance_id && ticketData?.chat_id) {
              const result = await mediaDisplayService.displayMedia({
                instanceId: ticketData.instance_id,
                messageId: messageId,
                chatId: ticketData.chat_id,
                mediaUrl: imageUrl || '',
                mediaKey: mediaKey || '',
                directPath: directPath || '',
                mimetype: mediaMimeType || 'image/jpeg',
                contentType: 'image'
              });

              if (result.success && result.mediaUrl) {
                console.log(`✅ ImageViewer: Fallback sucesso via ${result.strategy}`);
                setDisplayImageUrl(result.mediaUrl);
                return;
              }
              
              console.log('⚠️ ImageViewer: Fallback falhou:', result.error);
            }
          }
        }

        // ESTRATÉGIA 4: URL original como último recurso
        if (imageUrl) {
          console.log('🔄 ImageViewer: Último recurso - URL original');
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