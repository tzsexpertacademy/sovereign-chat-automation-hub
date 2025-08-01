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
  const [displayVideoUrl, setDisplayVideoUrl] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const initializeVideo = async () => {
      // PRIORIDADE 1: Se há video_base64 na prop message, usar ele SEMPRE
      if (message?.video_base64) {
        console.log('✅ VideoViewer: Usando video_base64 da prop message');
        const mimeType = message.media_mime_type || 'video/mp4';
        const dataUrl = `data:${mimeType};base64,${message.video_base64}`;
        setDisplayVideoUrl(dataUrl);
        setIsDecrypting(false);
        return;
      }

      if (!videoUrl) {
        setError('URL do vídeo não disponível');
        return;
      }

      // PRIORIDADE 2: Para mensagens manuais sem base64, mostrar erro específico
      const isManualMessage = messageId?.startsWith('manual_');
      if (isManualMessage) {
        console.log('❌ VideoViewer: Mensagem manual sem video_base64 salvo');
        setError('Vídeo manual não disponível - base64 não foi salvo corretamente');
        return;
      }

      // PRIORIDADE 3: Mensagens recebidas com mediaKey -> servidor descriptografa
      if (mediaKey) {
        console.log('📡 VideoViewer: Obtendo vídeo descriptografado do servidor');
        setError('');

        try {
          const { directMediaDownloadService } = await import('@/services/directMediaDownloadService');
          
          const currentUrl = window.location.pathname;
          const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
          const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
          
          let instanceId = 'default';
          if (ticketId) {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data: ticketData } = await supabase
              .from('conversation_tickets')
              .select('instance_id')
              .eq('id', ticketId)
              .single();
            
            if (ticketData?.instance_id) {
              instanceId = ticketData.instance_id;
            }
          }

          const result = await directMediaDownloadService.processMedia(
            instanceId,
            messageId || `video_${Date.now()}`,
            videoUrl,
            mediaKey,
            undefined, // directPath
            'video/mp4',
            'video'
          );
          
          if (result.success && result.mediaUrl) {
            console.log('✅ VideoViewer: Vídeo pronto para exibição');
            setDisplayVideoUrl(result.mediaUrl);
            return;
          } else {
            console.log('❌ VideoViewer: Falha ao obter vídeo do servidor');
          }
        } catch (err) {
          console.error('❌ VideoViewer: Erro ao obter vídeo:', err);
        }
      }
      
      // FALLBACK FINAL: URL original
      console.log('🔄 VideoViewer: Usando URL original como fallback');
      setDisplayVideoUrl(videoUrl);
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