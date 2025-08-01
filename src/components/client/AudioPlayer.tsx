import React, { useState, useRef, useEffect } from 'react';
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

  // Hook unificado para gerenciar mídia
  const { displayUrl, isLoading, error, isFromCache, retry, hasRetried } = useUnifiedMedia({
    messageId: messageId || `audio_${Date.now()}`,
    mediaUrl: audioUrl,
    mediaKey,
    fileEncSha256,
    mimetype: 'audio/ogg',
    contentType: 'audio',
    audioBase64: audioData
  });

  // Detectar formato de áudio pelos headers (mantido para compatibilidade)
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

  // Simplificado: usar displayUrl do hook unificado

  // Configurar event listeners do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleError = () => {
      // Silencioso - erro já tratado pelo hook unificado
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
  }, [displayUrl]);

  const togglePlay = async () => {
    if (!audioRef.current || (!displayUrl && !error)) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlay?.();
      }
    } catch (error) {
      // Silencioso - UI já mostra estado de erro
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
    if (!displayUrl) {
      toast.error('Nenhum áudio disponível para download');
      return;
    }

    try {
      let downloadUrl = displayUrl;
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
      if (downloadUrl.startsWith('blob:') && downloadUrl !== displayUrl) {
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
        src={displayUrl || undefined}
        preload="metadata"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || (!displayUrl && !error)}
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
          disabled={!displayUrl || isLoading}
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
        disabled={!displayUrl || isLoading}
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
        
        {displayUrl && !error && !isLoading && (
          <div className="text-green-600 flex items-center">
            ✓ Pronto
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;