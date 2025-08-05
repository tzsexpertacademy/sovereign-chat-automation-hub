import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useUnifiedMedia } from '@/hooks/useUnifiedMedia';

interface AudioPlayerProps {
  audioUrl?: string;
  audioData?: string; // base64 audio data
  duration?: number;
  fileName?: string;
  messageId?: string; // Para cache de descriptografia
  mediaKey?: string; // Para descriptografia
  fileEncSha256?: string; // Para descriptografia
  onPlay?: () => void;
  onPause?: () => void;
}

const AudioPlayer = ({ 
  audioUrl, 
  audioData, 
  duration, 
  fileName = 'audio.wav',
  messageId,
  mediaKey,
  fileEncSha256,
  onPlay,
  onPause 
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 🔧 DEBUG: Log inicial dos dados recebidos
  console.log('🎵 AudioPlayer DEBUG - Props recebidas:', {
    hasAudioUrl: !!audioUrl,
    hasAudioData: !!audioData,
    audioDataLength: audioData?.length || 0,
    audioDataPreview: audioData?.substring(0, 50) + '...',
    duration,
    fileName,
    messageId,
    hasMediaKey: !!mediaKey,
    hasFileEncSha256: !!fileEncSha256,
    mediaKeyPreview: mediaKey ? `${mediaKey.substring(0, 20)}...` : 'N/A'
  });

  // Detectar formato de áudio pelos headers (função auxiliar)
  const detectAudioFormat = (base64Data: string): string => {
    try {
      if (!base64Data || base64Data.length < 40) return 'ogg';
      
      const sampleChunk = base64Data.substring(0, 64);
      const decoded = atob(sampleChunk);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      
      // OGG: 4F 67 67 53 (OggS) - Formato do WhatsApp
      if (bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'ogg';
      }
      
      // WAV: 52 49 46 46 (RIFF)
      if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return 'wav';
      }
      
      return 'ogg'; // Fallback para WhatsApp
    } catch (e) {
      return 'ogg';
    }
  };

  // PRIORIZAR audio_base64 se disponível
  const audioDisplayUrl = useMemo(() => {
    if (audioData) {
      const format = detectAudioFormat(audioData);
      const mimeType = format === 'ogg' ? 'audio/ogg; codecs=opus' : 
                      format === 'wav' ? 'audio/wav' : 
                      format === 'mp3' ? 'audio/mpeg' : 'audio/ogg';
      
      const dataUrl = `data:${mimeType};base64,${audioData}`;
      
      // 🔧 DEBUG: Log da conversão base64→data URL
      console.log('🎵 AudioPlayer DEBUG - Conversão base64:', {
        formatDetectado: format,
        mimeType,
        dataUrlLength: dataUrl.length,
        dataUrlPreview: dataUrl.substring(0, 100) + '...'
      });
      
      return dataUrl;
    }
    return null;
  }, [audioData, detectAudioFormat]);

  // Hook unificado apenas como fallback se não tiver base64
  const { displayUrl, isLoading, error, isFromCache, retry, hasRetried } = useUnifiedMedia({
    messageId: messageId || `audio_${Date.now()}`,
    mediaUrl: audioUrl,
    mediaKey,
    fileEncSha256,
    mimetype: 'audio/ogg',
    contentType: 'audio',
    audioBase64: audioData
  });

  // URL final: priorizar base64 direto, depois fallback
  const finalDisplayUrl = audioDisplayUrl || displayUrl;

  // 🔧 DEBUG: Log dos estados do useUnifiedMedia e URL final
  console.log('🎵 AudioPlayer DEBUG - Estados:', {
    audioDisplayUrl: !!audioDisplayUrl,
    displayUrl: !!displayUrl,
    finalDisplayUrl: !!finalDisplayUrl,
    isLoading,
    error,
    isFromCache,
    hasRetried
  });

  // Configurar event listeners do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
      console.log('🎵 AudioPlayer DEBUG - Metadata carregada:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        canPlay: audio.readyState >= 3
      });
    };
    const handleError = (e: Event) => {
      console.error('🎵 AudioPlayer DEBUG - Erro no áudio:', {
        error: (e.target as HTMLAudioElement)?.error,
        src: (e.target as HTMLAudioElement)?.src,
        readyState: (e.target as HTMLAudioElement)?.readyState,
        networkState: (e.target as HTMLAudioElement)?.networkState
      });
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [finalDisplayUrl]);

  const togglePlay = async () => {
    if (!audioRef.current || (!finalDisplayUrl && !error)) return;

    console.log('🎵 AudioPlayer DEBUG - Tentativa de play/pause:', {
      isPlaying,
      hasFinalDisplayUrl: !!finalDisplayUrl,
      audioReadyState: audioRef.current.readyState,
      audioNetworkState: audioRef.current.networkState,
      audioSrc: audioRef.current.src?.substring(0, 50) + '...'
    });

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPause?.();
        console.log('🎵 AudioPlayer DEBUG - Áudio pausado com sucesso');
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlay?.();
        console.log('🎵 AudioPlayer DEBUG - Áudio reproduzindo com sucesso');
      }
    } catch (error) {
      console.error('🎵 AudioPlayer DEBUG - Erro ao reproduzir áudio:', error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    if (!time || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadAudio = async () => {
    if (!finalDisplayUrl) {
      toast.error('Nenhum áudio disponível para download');
      return;
    }

    try {
      let downloadUrl = finalDisplayUrl;
      let downloadFileName = fileName;

      // Se for data URL (base64), converter para blob
      if (downloadUrl.startsWith('data:')) {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
        
        // Detectar formato pelo base64 se disponível
        if (audioData) {
          const format = detectAudioFormat(audioData);
          downloadFileName = fileName.replace(/\.[^.]+$/, `.${format}`);
        }
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFileName;
      a.click();

        // Limpar URL temporária se criamos uma
        if (downloadUrl.startsWith('blob:') && downloadUrl !== finalDisplayUrl) {
          URL.revokeObjectURL(downloadUrl);
        }

      toast.success('Áudio baixado com sucesso');
    } catch (error) {
      toast.error('Erro ao baixar áudio');
    }
  };

  // Exibir sempre o player
  return (
    <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border">
      <audio 
        ref={audioRef}
        src={finalDisplayUrl || undefined}
        preload="metadata"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || (!finalDisplayUrl && !error)}
        className="h-8 w-8 p-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <Volume2 className="h-4 w-4 text-muted-foreground" />
      
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={totalDuration || 100}
          value={currentTime}
          onChange={handleSeek}
          disabled={!finalDisplayUrl || isLoading}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={downloadAudio}
        disabled={!finalDisplayUrl || isLoading}
        className="h-8 w-8 p-0"
        title="Baixar áudio"
      >
        <Download className="h-4 w-4" />
      </Button>

      {/* Botão de retry */}
      {error && !hasRetried && (
        <Button
          variant="ghost"
          size="sm"
          onClick={retry}
          className="h-8 w-8 p-0"
          title="Tentar novamente"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}

      {/* Status indicators */}
      <div className="flex flex-col items-end text-xs min-w-[80px]">
        {isLoading && (
          <div className="text-muted-foreground flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Carregando...
          </div>
        )}
        
        {error && (
          <div className="text-destructive flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            <span className="truncate max-w-[60px]" title={error}>
              {error}
            </span>
          </div>
        )}

        {isFromCache && !error && (
          <div className="text-green-600 text-xs">
            Cache
          </div>
        )}
        
        {finalDisplayUrl && !error && !isLoading && (
          <div className="text-green-600 flex items-center">
            ✓ Pronto
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;