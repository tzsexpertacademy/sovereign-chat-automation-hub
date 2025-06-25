
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

  // Processar dados de áudio com melhor detecção de formato
  useEffect(() => {
    if (audioData) {
      try {
        console.log('🎵 ===== PROCESSANDO ÁUDIO PARA PLAYER =====');
        console.log('📊 Dados de entrada:', {
          hasData: !!audioData,
          length: audioData.length,
          hasComma: audioData.includes(','),
          hasDataPrefix: audioData.startsWith('data:'),
          firstChars: audioData.substring(0, 50)
        });

        let processedData = audioData;
        
        // Se já tem prefixo data:, usar direto
        if (audioData.startsWith('data:')) {
          setAudioSrc(audioData);
          console.log('✅ Usando dados com prefixo data: existente');
        } else {
          // Detectar formato baseado nos primeiros bytes
          let detectedFormat = 'ogg'; // padrão WhatsApp
          let detectedMime = 'audio/ogg';
          
          try {
            const firstBytes = atob(audioData.substring(0, 20));
            const header = firstBytes.substring(0, 4);
            
            if (header.includes('OggS')) {
              detectedFormat = 'ogg';
              detectedMime = 'audio/ogg';
            } else if (header.includes('RIFF')) {
              detectedFormat = 'wav';
              detectedMime = 'audio/wav';
            } else if (header.includes('ID3') || firstBytes.charCodeAt(0) === 0xFF) {
              detectedFormat = 'mp3';
              detectedMime = 'audio/mpeg';
            } else if (header.includes('ftyp')) {
              detectedFormat = 'm4a';
              detectedMime = 'audio/m4a';
            }
            
            console.log('🎵 Formato detectado:', { detectedFormat, detectedMime });
          } catch (e) {
            console.log('⚠️ Erro na detecção, usando OGG padrão');
          }
          
          // Criar data URL com formato detectado
          const audioSrcWithPrefix = `data:${detectedMime};base64,${processedData}`;
          setAudioSrc(audioSrcWithPrefix);
          console.log('✅ Criado data URL com formato:', detectedFormat);
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

  // Configurar listeners do elemento de áudio com logs detalhados
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    console.log('🔧 Configurando listeners para áudio:', {
      hasAudio: !!audio,
      src: audioSrc.substring(0, 50) + '...'
    });

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
        console.log('🕒 Duração detectada:', audio.duration);
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
      console.error('❌ ERRO CRÍTICO no player de áudio:', e);
      console.error('📊 Detalhes do erro:', {
        error: e.target?.error,
        networkState: e.target?.networkState,
        readyState: e.target?.readyState,
        src: e.target?.src?.substring(0, 100),
        errorCode: e.target?.error?.code,
        errorMessage: e.target?.error?.message
      });
      
      setIsLoading(false);
      setError('Erro ao carregar áudio - tente um formato diferente');
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      console.log('✅ Reprodução finalizada');
      setIsPlaying(false);
      onPause?.();
    };

    const handleLoadedData = () => {
      console.log('📊 Dados do áudio carregados:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const duration = audio.duration;
        if (duration > 0) {
          const percent = (bufferedEnd / duration) * 100;
          console.log('📶 Progresso do buffer:', percent.toFixed(1) + '%');
        }
      }
    };

    // Adicionar todos os listeners
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('progress', handleProgress);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('progress', handleProgress);
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
        console.log('▶️ Iniciando reprodução');
        console.log('📊 Estado do áudio antes do play:', {
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
          currentTime: audio.currentTime,
          duration: audio.duration
        });
        
        setIsLoading(true);
        setError(null);
        
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
        
        console.log('✅ Áudio reproduzindo com sucesso');
      }
    } catch (error) {
      console.error('❌ ERRO ao reproduzir áudio:', error);
      console.error('📊 Estado do áudio no erro:', {
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: audio.error
      });
      
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
      console.log('📥 Download iniciado');
    } catch (error) {
      console.error('❌ Erro no download:', error);
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
