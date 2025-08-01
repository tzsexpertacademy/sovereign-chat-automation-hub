import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useUnifiedMedia } from '@/hooks/useUnifiedMedia';

interface VideoViewerProps {
  videoUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  needsDecryption?: boolean;
  caption?: string;
  fileName?: string;
  message?: any; // Objeto da mensagem completo para acessar video_base64
  instanceId?: string;
}

const VideoViewer: React.FC<VideoViewerProps> = ({
  videoUrl,
  messageId,
  mediaKey,
  fileEncSha256,
  needsDecryption = false,
  caption,
  fileName = 'video.mp4',
  message,
  instanceId
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  // Hook unificado para gerenciar mídia
  const { displayUrl, isLoading, error, isFromCache, retry, hasRetried } = useUnifiedMedia({
    messageId: messageId || `video_${Date.now()}`,
    mediaUrl: videoUrl,
    mediaKey,
    fileEncSha256,
    mimetype: 'video/mp4',
    contentType: 'video',
    videoBase64: message?.video_base64
  });

  // Remover lógica antiga - usar apenas o hook unificado

  const handleDownload = async () => {
    if (!displayUrl) return;
    
    try {
      // Se for blob URL, fazer nova requisição para garantir download
      if (displayUrl.startsWith('blob:')) {
        const response = await fetch(displayUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'video.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpar URL temporária
        window.URL.revokeObjectURL(url);
      } else {
        // Para URLs regulares
        const link = document.createElement('a');
        link.href = displayUrl;
        link.download = fileName || 'video.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      console.log('✅ VideoViewer: Download iniciado com sucesso');
    } catch (error) {
      console.error('❌ VideoViewer: Erro no download:', error);
    }
  };

  const handlePlayPause = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef) {
      videoRef.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoError = () => {
    console.log('❌ VideoViewer: Erro ao carregar vídeo');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Carregando vídeo...</span>
        </div>
      </div>
    );
  }

  if (error && !displayUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-center">
          <p className="font-medium">Erro ao carregar vídeo</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        {!hasRetried && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={retry}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {displayUrl ? (
          <video
            ref={setVideoRef}
            src={displayUrl}
            controls
            className="w-full h-auto max-h-64"
            onError={handleVideoError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          >
            Seu navegador não suporta vídeos HTML5.
          </video>
        ) : (
          <div className="flex items-center justify-center p-8 bg-gray-800 text-white">
            <Play className="w-8 h-8" />
          </div>
        )}
        {isFromCache && displayUrl && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
            Cache
          </div>
        )}
      </div>

      {/* Controles personalizados */}
      <div className="flex items-center justify-between mt-2 px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            disabled={!displayUrl}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            disabled={!displayUrl}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {error && !hasRetried && (
            <Button
              variant="ghost"
              size="sm"
              onClick={retry}
              title="Tentar novamente"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!displayUrl}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Caption */}
      {caption && caption !== '🎥 Vídeo' && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
          {caption}
        </div>
      )}

    </div>
  );
};

export default VideoViewer;