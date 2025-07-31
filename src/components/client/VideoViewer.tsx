import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { unifiedMediaService } from '@/services/unifiedMediaService';

interface VideoViewerProps {
  videoUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  needsDecryption?: boolean;
  caption?: string;
  fileName?: string;
}

const VideoViewer: React.FC<VideoViewerProps> = ({
  videoUrl,
  messageId,
  mediaKey,
  fileEncSha256,
  needsDecryption = false,
  caption,
  fileName = 'video.mp4'
}) => {
  const [displayVideoUrl, setDisplayVideoUrl] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const initializeVideo = async () => {
      if (!videoUrl) {
        setError('URL do vídeo não disponível');
        return;
      }

      // Se não precisa de descriptografia, usar URL direta
      if (!needsDecryption) {
        console.log('🎥 VideoViewer: Usando URL direta');
        setDisplayVideoUrl(videoUrl);
        return;
      }

      // Verificar se tem dados necessários para descriptografia
      if (!messageId || !mediaKey || !fileEncSha256) {
        console.log('❌ VideoViewer: Dados insuficientes para descriptografia, tentando URL direta');
        setDisplayVideoUrl(videoUrl);
        return;
      }

      // Tentar processamento via UnifiedMediaService (que tentará download direto primeiro)
      console.log('🔐 VideoViewer: Iniciando processamento via UnifiedMediaService', { messageId, hasMediaKey: !!mediaKey });
      setIsDecrypting(true);
      setError('');

      try {
        const result = await unifiedMediaService.processVideo(
          messageId,
          '', // instanceId será obtido dentro do serviço
          {
            url: videoUrl,
            mimetype: 'video/mp4',
            mediaKey: mediaKey,
            directPath: ''
          }
        );

        console.log('📡 VideoViewer: Resultado do processamento:', {
          success: result?.success,
          hasMediaUrl: !!result?.mediaUrl,
          format: result?.format,
          cached: result?.cached
        });
        
        if (result?.success && result?.mediaUrl) {
          console.log('✅ VideoViewer: Processamento bem-sucedido');
          setDisplayVideoUrl(result.mediaUrl);
        } else {
          console.log('❌ VideoViewer: Falha no processamento, tentando URL direta');
          // Fallback: tentar URL original
          setDisplayVideoUrl(videoUrl);
        }
      } catch (err) {
        console.error('❌ VideoViewer: Erro no processamento:', err);
        // Fallback: tentar URL original
        setDisplayVideoUrl(videoUrl);
      } finally {
        setIsDecrypting(false);
      }
    };

    initializeVideo();
  }, [videoUrl, messageId, mediaKey, fileEncSha256, needsDecryption]);

  const handleDownload = () => {
    if (displayVideoUrl) {
      const link = document.createElement('a');
      link.href = displayVideoUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    setError('Erro ao carregar vídeo');
  };

  if (isDecrypting) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Descriptografando vídeo...</span>
        </div>
      </div>
    );
  }

  if (error && !displayVideoUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-center">
          <p className="font-medium">Erro ao carregar vídeo</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {displayVideoUrl ? (
          <video
            ref={setVideoRef}
            src={displayVideoUrl}
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
      </div>

      {/* Controles personalizados (opcional - o HTML5 já tem controles) */}
      <div className="flex items-center justify-between mt-2 px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            disabled={!displayVideoUrl}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            disabled={!displayVideoUrl}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={!displayVideoUrl}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Caption */}
      {caption && caption !== '🎥 Vídeo' && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
          {caption}
        </div>
      )}

      {/* Informações de debug (somente em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          <div>Descriptografia: {needsDecryption ? 'Necessária' : 'Não necessária'}</div>
          {messageId && <div>ID: {messageId}</div>}
        </div>
      )}
    </div>
  );
};

export default VideoViewer;