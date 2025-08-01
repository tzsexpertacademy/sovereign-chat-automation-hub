import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, Loader2, Image as ImageIcon, ZoomIn, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useUnifiedMedia } from '@/hooks/useUnifiedMedia';

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
  // Debug logs para investigar problema da imagem
  console.log('🖼️ ImageViewer Debug:', {
    messageId,
    imageUrl,
    mediaKey: mediaKey ? 'presente' : 'ausente',
    imageBase64: message?.image_base64 ? 'presente' : 'ausente',
    mediaMimeType,
    needsDecryption
  });

  // Hook unificado para gerenciar mídia
  const { displayUrl, isLoading, error, isFromCache, retry, hasRetried } = useUnifiedMedia({
    messageId: messageId || `image_${Date.now()}`,
    mediaUrl: imageUrl,
    mediaKey,
    fileEncSha256,
    directPath,
    mimetype: mediaMimeType || 'image/jpeg',
    contentType: 'image',
    imageBase64: message?.image_base64
  });

  // Debug do resultado do hook
  console.log('🖼️ ImageViewer Result:', {
    displayUrl: displayUrl ? 'presente' : 'ausente',
    isLoading,
    error,
    isFromCache
  });

  // Usar displayUrl do hook unificado

  const handleImageError = () => {
    console.error('❌ ImageViewer: Erro ao carregar imagem no elemento img');
  };

  const downloadImage = async () => {
    if (!displayUrl) {
      toast.error('Nenhuma imagem disponível para download');
      return;
    }

    try {
      // Se é uma URL de dados (base64), converter para blob
      if (displayUrl.startsWith('data:')) {
        const response = await fetch(displayUrl);
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
        a.href = displayUrl;
        a.download = fileName;
        a.target = '_blank';
        a.click();
      }
      
      toast.success('Download da imagem iniciado');
    } catch (error) {
      console.error('❌ ImageViewer: Erro ao baixar imagem:', error);
      toast.error('Erro ao baixar imagem');
    }
  };

  // Renderizar preview pequeno da imagem
  const renderImagePreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center w-48 h-32 bg-muted rounded-lg border">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Carregando...
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
            {!hasRetried && (
              <Button
                variant="ghost"
                size="sm"
                onClick={retry}
                className="h-6 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (displayUrl) {
      return (
        <div className="relative group">
          <img
            src={displayUrl}
            alt={caption || "Imagem"}
            className="w-48 h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {isFromCache && (
            <div className="absolute top-1 right-1 bg-green-600 text-white text-xs px-1 rounded">
              Cache
            </div>
          )}
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
            {displayUrl && !error ? (
              <img
                src={displayUrl}
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
                  {error && !hasRetried && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retry}
                      className="mt-2"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Tentar novamente
                    </Button>
                  )}
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
          disabled={!displayUrl || isLoading}
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