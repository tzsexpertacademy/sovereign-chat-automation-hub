import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, Loader2, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { unifiedMediaService } from '@/services/unifiedMediaService';

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

  // Inicializar imagem
  useEffect(() => {
    let mounted = true;
    
    const initializeImage = async () => {
      if (!mounted) return;
      
      setIsLoading(true);
      setError(null);
      
      console.log('🖼️ ImageViewer: Iniciando com dados:', {
        hasImageUrl: !!imageUrl,
        needsDecryption,
        hasDecryptionKeys: !!(messageId && mediaKey),
        hasFileEncSha256: !!fileEncSha256,
        mediaMimeType,
        imageUrl: imageUrl?.substring(0, 100) + '...'
      });

      try {
        // 1. URL direta (não criptografada)
        if (imageUrl && !needsDecryption) {
          console.log('✅ ImageViewer: Usando URL direta');
          setDisplayImageUrl(imageUrl);
          return;
        }

        // 2. Imagem com dados completos (priorizar download direto)
        if (imageUrl && mediaKey) {
          console.log('🔐 ImageViewer: Processando imagem com dados completos');
          setIsDecrypting(true);
          
          const result = await unifiedMediaService.processImage(
            messageId || '',
            '', // instanceId será obtido dentro do serviço
            {
              url: imageUrl,
              mimetype: mediaMimeType || 'image/jpeg',
              mediaKey: mediaKey,
              directPath: directPath || ''
            }
          );
          
          const processedUrl = result?.success ? result.mediaUrl : null;
          
          if (processedUrl) {
            console.log('✅ ImageViewer: Processamento bem-sucedido');
            setDisplayImageUrl(processedUrl);
          } else {
            console.log('❌ ImageViewer: Falha no processamento, tentando URL direta');
            // Fallback: tentar URL original
            setDisplayImageUrl(imageUrl);
          }
          setIsDecrypting(false);
          return;
        }

        // 3. Erro: falta de dados
        if (!imageUrl) {
          setError('URL da imagem não disponível');
          return;
        }

        if (needsDecryption && (!messageId || !mediaKey)) {
          setError('Imagem criptografada sem chaves');
          return;
        }

      } catch (error) {
        console.error('❌ ImageViewer: Erro na inicialização:', error);
        setError('Erro ao carregar imagem');
      } finally {
        setIsLoading(false);
        setIsDecrypting(false);
      }
    };

    initializeImage();
    
    return () => {
      mounted = false;
    };
  }, [imageUrl, messageId, mediaKey, needsDecryption]);

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