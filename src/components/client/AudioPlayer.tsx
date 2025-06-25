
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download, AlertCircle } from 'lucide-react';

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
  fileName = 'audio.ogg',
  onPlay,
  onPause 
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Processar dados de áudio
  useEffect(() => {
    if (audioData) {
      try {
        console.log('🎵 Processando dados de áudio para player:', {
          hasData: !!audioData,
          length: audioData.length,
          hasComma: audioData.includes(',')
        });

        let processedData = audioData;
        
        // Se já tem prefixo data:, usar direto
        if (audioData.startsWith('data:')) {
          setAudioSrc(audioData);
          console.log('✅ Usando dados com prefixo data: existente');
        } else {
          // Adicionar prefixo data: apropriado
          // Tentar diferentes formatos para compatibilidade
          const formats = [
            'data:audio/ogg;base64,',
            'data:audio/wav;base64,',
            'data:audio/mpeg;base64,',
            'data:audio/webm;base64,'
          ];
          
          // Usar OGG como padrão (formato comum do WhatsApp)
          const audioSrcWithPrefix = `${formats[0]}${processedData}`;
          setAudioSrc(audioSrcWithPrefix);
          console.log('✅ Adicionado prefixo OGG aos dados de áudio');
        }
      } catch (error) {
        console.error('❌ Erro ao processar dados de áudio:', error);
        setError('Erro ao processar dados de áudio');
        setAudioSrc(null);
      }
    } else if (audioUrl) {
      setAudioSrc(audioUrl);
      console.log('✅ Usando URL de áudio:', audioUrl);
    } else {
      setAudioSrc(null);
      console.log('⚠️ Nenhum dado de áudio disponível');
    }
  }, [audioData, audioUrl]);

  // Configurar listeners do elemento de áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
        console.log('🕒 Duração do áudio detectada:', audio.duration);
      }
    };
    
    const handleLoadStart = () => {
      console.log('🔄 Iniciando carregamento do áudio');
      setIsLoading(true);
      setError(null);
    };
    
    const handleCanPlay = () => {
      console.log('✅ Áudio pronto para reprodução');
      setIsLoading(false);
      setError(null);
    };
    
    const handleError = (e: any) => {
      console.error('❌ Erro no player de áudio:', e);
      console.error('❌ Detalhes do erro:', {
        error: e.target?.error,
        networkState: e.target?.networkState,
        readyState: e.target?.readyState,
        src: e.target?.src?.substring(0, 100)
      });
      
      setIsLoading(false);
      setError('Erro ao carregar áudio');
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      console.log('✅ Reprodução de áudio finalizada');
      setIsPlaying(false);
      onPause?.();
    };

    const handleLoadedData = () => {
      console.log('📊 Dados do áudio carregados:', {
        duration: audio.duration,
        readyState: audio.readyState
      });
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadeddata', handleLoadedData);
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
        console.log('⏸️ Pausando áudio');
        audio.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        console.log('▶️ Iniciando reprodução de áudio');
        setIsLoading(true);
        setError(null);
        
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
        
        console.log('✅ Áudio reproduzindo');
      }
    } catch (error) {
      console.error('❌ Erro ao reproduzir áudio:', error);
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
    if (!audioSrc) return;
    
    try {
      const link = document.createElement('a');
      link.href = audioSrc;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('📥 Download do áudio iniciado');
    } catch (error) {
      console.error('❌ Erro ao baixar áudio:', error);
    }
  };

  if (!audioSrc) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
        <AlertCircle className="w-4 h-4 text-gray-400" />
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
        src={audioSrc}
      >
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
          <div className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
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
