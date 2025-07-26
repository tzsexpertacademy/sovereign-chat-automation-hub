
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

  // Detectar formato de áudio pelos headers corretos
  const detectAudioFormat = (base64Data: string): string => {
    try {
      const decoded = atob(base64Data.substring(0, 32));
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      
      // OGG: 4F 67 67 53 (OggS)
      if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        console.log('🎵 Player detectou: OGG');
        return 'ogg';
      }
      
      // WAV: 52 49 46 46 (RIFF)
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        console.log('🎵 Player detectou: WAV');
        return 'wav';
      }
      
      // MP3: ID3 ou frame sync
      if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
          (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
        console.log('🎵 Player detectou: MP3');
        return 'mp3';
      }
      
      // M4A: ftyp
      if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        console.log('🎵 Player detectou: M4A');
        return 'm4a';
      }
      
      console.log('🔄 Player: formato não detectado, usando auto');
      return 'auto';
    } catch (e) {
      console.warn('⚠️ Erro na detecção:', e);
      return 'auto';
    }
  };

  // Criar sources otimizados para reprodução no navegador
  const createAudioSources = (base64Data: string): string[] => {
    const format = detectAudioFormat(base64Data);
    const sources: string[] = [];
    
    if (format === 'auto') {
      // Ordem otimizada para compatibilidade com navegadores
      sources.push(`data:audio/mpeg;base64,${base64Data}`);     // MP3 - melhor suporte
      sources.push(`data:audio/wav;base64,${base64Data}`);      // WAV - universal
      sources.push(`data:audio/ogg;base64,${base64Data}`);      // OGG - WhatsApp
      sources.push(`data:audio/mp4;base64,${base64Data}`);      // M4A/AAC
      sources.push(`data:audio/webm;base64,${base64Data}`);     // WebM
    } else {
      const mimeTypes = {
        ogg: 'audio/ogg',
        wav: 'audio/wav', 
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4'
      };
      
      const primaryMime = mimeTypes[format] || 'audio/ogg';
      sources.push(`data:${primaryMime};base64,${base64Data}`);
      
      // Adicionar fallbacks
      if (format !== 'mp3') sources.push(`data:audio/mpeg;base64,${base64Data}`);
      if (format !== 'wav') sources.push(`data:audio/wav;base64,${base64Data}`);
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
