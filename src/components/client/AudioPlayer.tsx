
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
  fileName = 'audio.wav',
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

  // Detectar formato de áudio pelos primeiros bytes
  const detectAudioFormat = (base64Data: string): string => {
    try {
      // Decodificar primeiro pedaço para verificar header
      const firstBytes = atob(base64Data.substring(0, 20));
      
      if (firstBytes.includes('OggS')) return 'ogg';
      if (firstBytes.includes('RIFF')) return 'wav';
      if (firstBytes.includes('ID3') || firstBytes.charCodeAt(0) === 0xFF) return 'mp3';
      if (firstBytes.includes('ftyp')) return 'm4a';
      
      // Fallback: tentar todos os formatos
      return 'auto';
    } catch (e) {
      return 'auto';
    }
  };

  // Criar múltiplas URLs de áudio para compatibilidade
  const createAudioSources = (base64Data: string): string[] => {
    const format = detectAudioFormat(base64Data);
    const sources: string[] = [];
    
    if (format === 'auto') {
      // Tentar múltiplos formatos
      sources.push(`data:audio/ogg;base64,${base64Data}`);
      sources.push(`data:audio/wav;base64,${base64Data}`);
      sources.push(`data:audio/mpeg;base64,${base64Data}`);
      sources.push(`data:audio/webm;base64,${base64Data}`);
    } else {
      const mimeTypes = {
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4'
      };
      sources.push(`data:${mimeTypes[format] || 'audio/ogg'};base64,${base64Data}`);
    }
    
    return sources;
  };

  // Processar dados de áudio
  useEffect(() => {
    if (audioData) {
      try {
        console.log('🎵 ===== CONFIGURANDO AUDIO PLAYER =====');
        console.log('📊 Dados de entrada:', {
          hasData: !!audioData,
          length: audioData.length,
          firstChars: audioData.substring(0, 50)
        });

        let cleanData = audioData;
        if (audioData.includes('data:') && audioData.includes(',')) {
          cleanData = audioData.split(',')[1];
        }

        const sources = createAudioSources(cleanData);
        console.log('🎵 Sources criados:', sources.length);
        
        // Usar primeira source como padrão
        setAudioSrc(sources[0]);
        
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

  // Configurar listeners do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    console.log('🔧 Configurando listeners para áudio');

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
        console.log('🕒 Duração detectada:', audio.duration);
      }
    };
    
    const handleLoadStart = () => {
      console.log('🔄 Carregando áudio...');
      setIsLoading(true);
      setError(null);
    };
    
    const handleCanPlay = () => {
      console.log('✅ Áudio pronto para reprodução');
      setIsLoading(false);
      setError(null);
    };
    
    const handleError = (e: any) => {
      console.error('❌ ERRO no player de áudio:', e);
      setIsLoading(false);
      setError('Formato de áudio não suportado');
      setIsPlaying(false);
      
      // Tentar próximo formato se disponível
      if (audioData) {
        const cleanData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
        const sources = createAudioSources(cleanData);
        const currentIndex = sources.indexOf(audioSrc || '');
        
        if (currentIndex < sources.length - 1) {
          console.log('🔄 Tentando próximo formato...');
          setAudioSrc(sources[currentIndex + 1]);
          setError(null);
        }
      }
    };
    
    const handleEnded = () => {
      console.log('✅ Reprodução finalizada');
      setIsPlaying(false);
      onPause?.();
    };

    // Adicionar listeners
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
  }, [audioSrc, audioData, onPause]);

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
        setIsLoading(true);
        setError(null);
        
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
        
        console.log('✅ Áudio reproduzindo');
      }
    } catch (error) {
      console.error('❌ ERRO ao reproduzir áudio:', error);
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
    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 shadow-sm">
      <audio 
        ref={audioRef} 
        preload="metadata"
        src={audioSrc}
        style={{ display: 'none' }}
      >
        Seu navegador não suporta o elemento de áudio.
      </audio>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || !!error}
        className="flex-shrink-0 hover:bg-gray-200 transition-colors"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 text-blue-600" />
        ) : (
          <Play className="w-4 h-4 text-green-600" />
        )}
      </Button>

      <Volume2 className="w-4 h-4 text-blue-500 flex-shrink-0" />

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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
                         [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full 
                         [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
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
        className="flex-shrink-0 hover:bg-gray-200 transition-colors"
        disabled={!audioSrc}
        title="Baixar áudio"
      >
        <Download className="w-4 h-4 text-gray-600" />
      </Button>
    </div>
  );
};

export default AudioPlayer;
