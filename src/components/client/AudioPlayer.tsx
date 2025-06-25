
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl?: string;
  audioData?: string; // base64 audio data
  duration?: number;
  fileName?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

const AudioPlayer = ({ 
  audioUrl, 
  audioData, 
  duration, 
  fileName = 'audio.wav',
  onPlay,
  onPause 
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Criar URL do áudio
  const audioSrc = React.useMemo(() => {
    if (audioData) {
      try {
        // Verificar se é base64 válido
        if (audioData.includes(',')) {
          // Já tem o prefixo data:
          return audioData;
        } else {
          // Adicionar prefixo data:
          return `data:audio/wav;base64,${audioData}`;
        }
      } catch (error) {
        console.error('Erro ao processar dados de áudio:', error);
        setError('Erro ao processar dados de áudio');
        return null;
      }
    }
    return audioUrl || null;
  }, [audioData, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    
    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };
    
    const handleError = (e: any) => {
      console.error('Erro no player de áudio:', e);
      setIsLoading(false);
      setError('Erro ao carregar áudio');
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      onPause?.();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPause, audioSrc]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        setIsLoading(true);
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      setError('Erro ao reproduzir áudio');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadAudio = () => {
    if (audioData) {
      try {
        const link = document.createElement('a');
        link.href = audioSrc || '';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Erro ao baixar áudio:', error);
      }
    } else if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = fileName;
      link.target = '_blank';
      link.click();
    }
  };

  if (!audioSrc) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
        <Volume2 className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Áudio não disponível</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
      <audio 
        ref={audioRef} 
        preload="metadata"
        crossOrigin="anonymous"
      >
        <source src={audioSrc} type="audio/wav" />
        <source src={audioSrc} type="audio/mpeg" />
        <source src={audioSrc} type="audio/ogg" />
        Seu navegador não suporta o elemento de áudio.
      </audio>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || !!error}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>

      <Volume2 className="w-4 h-4 text-gray-500 flex-shrink-0" />

      <div className="flex-1 mx-2">
        {error ? (
          <div className="text-xs text-red-500">{error}</div>
        ) : (
          <>
            <input
              type="range"
              min="0"
              max={totalDuration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={!totalDuration || isLoading}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={downloadAudio}
        className="flex-shrink-0"
        disabled={!audioSrc}
      >
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default AudioPlayer;
