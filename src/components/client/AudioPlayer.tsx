
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
      // Validar entrada
      if (!base64Data || base64Data.length < 40) {
        console.log('🔄 Player: dados insuficientes para detecção');
        return 'auto';
      }
      
      const sampleChunk = base64Data.substring(0, 64);
      const decoded = atob(sampleChunk);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      
      console.log('🔍 Player analisando header:', Array.from(bytes.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // OGG: 4F 67 67 53 (OggS) - Formato do WhatsApp
      if (bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        console.log('🎵 Player detectou: OGG (WhatsApp)');
        return 'ogg';
      }
      
      // WAV: 52 49 46 46 (RIFF)
      if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        console.log('🎵 Player detectou: WAV');
        return 'wav';
      }
      
      // MP3: ID3 (49 44 33) ou frame sync (FF Fx)
      if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        console.log('🎵 Player detectou: MP3 (ID3)');
        return 'mp3';
      }
      if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
        console.log('🎵 Player detectou: MP3 (frame sync)');
        return 'mp3';
      }
      
      // M4A: ftyp (posição 4-7: 66 74 79 70)
      if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        console.log('🎵 Player detectou: M4A');
        return 'm4a';
      }
      
      // WebM: EBML (1A 45 DF A3)
      if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
        console.log('🎵 Player detectou: WebM');
        return 'webm';
      }
      
      console.log('🔄 Player: formato não detectado pelos headers, usando auto');
      return 'auto';
    } catch (e) {
      console.warn('⚠️ Player: erro na detecção de formato:', e);
      return 'auto';
    }
  };

  // Criar sources otimizados para reprodução no navegador
  const createAudioSources = (base64Data: string): string[] => {
    const format = detectAudioFormat(base64Data);
    const sources: string[] = [];
    
    // Validar dados base64
    const cleanData = base64Data.replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/=]*$/.test(cleanData)) {
      console.error('❌ Base64 inválido para criação de sources');
      return [];
    }
    
    if (format === 'ogg') {
      // WhatsApp usa OGG Opus - tentar este primeiro
      sources.push(`data:audio/ogg; codecs=opus;base64,${cleanData}`);
      sources.push(`data:audio/ogg;base64,${cleanData}`);
      sources.push(`data:audio/webm; codecs=opus;base64,${cleanData}`);
      sources.push(`data:audio/mpeg;base64,${cleanData}`);     // Fallback MP3
      sources.push(`data:audio/wav;base64,${cleanData}`);      // Fallback WAV
    } else if (format === 'wav') {
      sources.push(`data:audio/wav;base64,${cleanData}`);
      sources.push(`data:audio/mpeg;base64,${cleanData}`);
      sources.push(`data:audio/ogg;base64,${cleanData}`);
    } else if (format === 'mp3') {
      sources.push(`data:audio/mpeg;base64,${cleanData}`);
      sources.push(`data:audio/wav;base64,${cleanData}`);
      sources.push(`data:audio/ogg;base64,${cleanData}`);
    } else if (format === 'm4a') {
      sources.push(`data:audio/mp4;base64,${cleanData}`);
      sources.push(`data:audio/mpeg;base64,${cleanData}`);
      sources.push(`data:audio/wav;base64,${cleanData}`);
    } else if (format === 'webm') {
      sources.push(`data:audio/webm; codecs=opus;base64,${cleanData}`);
      sources.push(`data:audio/ogg; codecs=opus;base64,${cleanData}`);
      sources.push(`data:audio/mpeg;base64,${cleanData}`);
    } else {
      // Auto - ordem otimizada para WhatsApp
      sources.push(`data:audio/ogg; codecs=opus;base64,${cleanData}`);  // WhatsApp preferido
      sources.push(`data:audio/mpeg;base64,${cleanData}`);               // MP3 - melhor suporte
      sources.push(`data:audio/wav;base64,${cleanData}`);                // WAV - universal
      sources.push(`data:audio/mp4;base64,${cleanData}`);                // M4A/AAC
      sources.push(`data:audio/webm; codecs=opus;base64,${cleanData}`);  // WebM
    }
    
    console.log(`🎵 Sources gerados para formato ${format}:`, sources.length);
    return sources.filter(src => src.length > 50); // Filtrar sources muito pequenos
  };

  // Processar dados de áudio com priorização para WhatsApp
  useEffect(() => {
    console.log('🎵 ===== CONFIGURANDO AUDIO PLAYER WHATSAPP =====');
    console.log('📊 Entrada:', {
      hasUrl: !!audioUrl,
      urlDomain: audioUrl ? new URL(audioUrl).hostname : 'N/A',
      hasData: !!audioData,
      dataLength: audioData?.length || 0
    });

    // ESTRATÉGIA OTIMIZADA PARA WHATSAPP
    if (audioUrl && audioUrl.includes('mmg.whatsapp.net')) {
      console.log('🎯 WHATSAPP: URL detectada, configurando headers especiais');
      setAudioSrc(audioUrl);
      setError(null);
    } else if (audioUrl) {
      console.log('✅ URL EXTERNA: Usando diretamente');
      setAudioSrc(audioUrl);
      setError(null);
    } else if (audioData) {
      try {
        console.log('🔄 BASE64: Processando dados de áudio...');
        
        let cleanData = audioData;
        if (audioData.includes('data:') && audioData.includes(',')) {
          cleanData = audioData.split(',')[1];
        }

        const sources = createAudioSources(cleanData);
        console.log('🎵 Sources criados:', sources.length);
        
        if (sources.length > 0) {
          setAudioSrc(sources[0]);
          console.log('✅ BASE64: Primeira source configurada');
        } else {
          console.error('❌ Nenhuma source válida');
          setError('Formato não suportado');
          setAudioSrc(null);
        }
        
      } catch (error) {
        console.error('❌ Erro processamento base64:', error);
        setError('Erro ao processar áudio');
        setAudioSrc(null);
      }
    } else {
      console.log('⚠️ Sem dados de áudio');
      setAudioSrc(null);
      setError('Áudio não disponível');
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
      console.error('❌ PLAYER ERRO:', e.type);
      console.error('📋 Debug:', {
        networkState: audio.networkState,
        readyState: audio.readyState,
        srcType: audioSrc?.includes('mmg.whatsapp.net') ? 'WhatsApp' : 'Base64',
        srcLength: audio.src?.length || 0
      });
      
      setIsLoading(false);
      setIsPlaying(false);
      
      // FALLBACK WHATSAPP OTIMIZADO
      if (audioUrl && audioData && audioSrc === audioUrl) {
        console.log('🔄 WhatsApp URL falhou → Base64 fallback');
        const cleanData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
        const sources = createAudioSources(cleanData);
        if (sources.length > 0) {
          setAudioSrc(sources[0]);
          setError(null);
          return;
        }
      }
      
      // MÚLTIPLOS FALLBACKS BASE64
      if (audioData) {
        const cleanData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
        const sources = createAudioSources(cleanData);
        const currentIndex = sources.indexOf(audioSrc || '');
        
        if (currentIndex >= 0 && currentIndex < sources.length - 1) {
          const nextFormat = sources[currentIndex + 1];
          console.log(`🔄 Formato ${currentIndex + 2}/${sources.length}:`, nextFormat.split(';')[0]);
          setAudioSrc(nextFormat);
          setError(null);
          return;
        }
      }
      
      // PLAYER SEMPRE VISÍVEL
      console.log('⚠️ Player mantido com funcionalidade limitada');
      setError('Reprodução indisponível');
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
        src={audioSrc || undefined}
        crossOrigin="anonymous"
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
