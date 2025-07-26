
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WhatsAppAudioDecryption } from '@/services/whatsappAudioDecryption';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionAttempted, setDecryptionAttempted] = useState(false);
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

  // Função para descriptografar áudio do WhatsApp usando o serviço
  const decryptWhatsAppAudio = async (encryptedUrl: string): Promise<string | null> => {
    if (!messageId || !mediaKey) {
      console.log('⚠️ [DECRYPT] Metadados insuficientes para descriptografia:', {
        hasMessageId: !!messageId,
        hasMediaKey: !!mediaKey,
        hasFileEncSha256: !!fileEncSha256
      });
      return null;
    }

    setIsDecrypting(true);
    console.log('🔐 [DECRYPT] Iniciando descriptografia do áudio WhatsApp...');
    
    try {
      const result = await WhatsAppAudioDecryption.decryptAudio(
        encryptedUrl,
        mediaKey,
        messageId,
        fileEncSha256
      );
      
      if (result.success && result.decryptedAudio) {
        console.log('✅ [DECRYPT] Áudio descriptografado com sucesso!', {
          format: result.format,
          cached: result.cached
        });
        return result.decryptedAudio;
      } else {
        throw new Error(result.error || 'Descriptografia falhou');
      }
      
    } catch (error) {
      console.error('❌ [DECRYPT] Falha na descriptografia:', error);
      toast.error('Erro ao descriptografar áudio do WhatsApp');
      return null;
    } finally {
      setIsDecrypting(false);
    }
  };

  // Processar dados de áudio com descriptografia automática
  useEffect(() => {
    console.log('🎵 ===== CONFIGURANDO AUDIO PLAYER WHATSAPP =====');
    console.log('📊 Entrada:', {
      hasUrl: !!audioUrl,
      urlDomain: audioUrl ? new URL(audioUrl).hostname : 'N/A',
      hasData: !!audioData,
      dataLength: audioData?.length || 0,
      hasDecryptionMetadata: !!(messageId && mediaKey && fileEncSha256),
      decryptionAttempted
    });

    const initializeAudio = async () => {
      // Reset estado
      setError(null);
      setAudioSrc(null);

      // ESTRATÉGIA PARA WHATSAPP .ENC (CRIPTOGRAFADO)
      if (audioUrl && audioUrl.includes('.enc') && !decryptionAttempted && messageId && mediaKey && fileEncSha256) {
        console.log('🔐 WHATSAPP CRIPTOGRAFADO: Tentando descriptografar...');
        setDecryptionAttempted(true);
        
        const decryptedAudio = await decryptWhatsAppAudio(audioUrl);
        if (decryptedAudio) {
          const sources = createAudioSources(decryptedAudio);
          if (sources.length > 0) {
            setAudioSrc(sources[0]);
            console.log('✅ ÁUDIO DESCRIPTOGRAFADO: Configurado para reprodução');
            return;
          }
        }
        
        // Se descriptografia falhou, tentar reproduzir URL direta como fallback
        console.log('🔄 FALLBACK: Tentando URL direta após falha na descriptografia');
        setAudioSrc(audioUrl);
        return;
      }
      
      // WHATSAPP NÃO CRIPTOGRAFADO OU URL EXTERNA
      if (audioUrl && audioUrl.includes('mmg.whatsapp.net')) {
        console.log('🎯 WHATSAPP: URL detectada (não .enc), usando diretamente');
        setAudioSrc(audioUrl);
      } else if (audioUrl) {
        console.log('✅ URL EXTERNA: Usando diretamente');
        setAudioSrc(audioUrl);
      }
      
      // BASE64 (POSSIVELMENTE JÁ DESCRIPTOGRAFADO)
      else if (audioData) {
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
          }
          
        } catch (error) {
          console.error('❌ Erro processamento base64:', error);
          setError('Erro ao processar áudio');
        }
      }
      
      // SEM DADOS
      else {
        console.log('⚠️ Sem dados de áudio');
        setError('Áudio não disponível');
      }
    };

    initializeAudio();
  }, [audioData, audioUrl, messageId, mediaKey, fileEncSha256, decryptionAttempted]);

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
      
      // FALLBACK WHATSAPP CRIPTOGRAFADO - tentar descriptografar se falhou
      if (audioUrl && audioUrl.includes('.enc') && !decryptionAttempted && messageId && mediaKey && fileEncSha256) {
        console.log('🔐 FALLBACK CRIPTOGRAFIA: URL falhou, tentando descriptografar...');
        setDecryptionAttempted(true);
        decryptWhatsAppAudio(audioUrl).then(decryptedAudio => {
          if (decryptedAudio) {
            const sources = createAudioSources(decryptedAudio);
            if (sources.length > 0) {
              setAudioSrc(sources[0]);
              setError(null);
              return;
            }
          }
          console.log('❌ Fallback de descriptografia também falhou');
        }).catch(err => {
          console.error('❌ Erro no fallback de descriptografia:', err);
        });
        return;
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

  const downloadAudio = async () => {
    if (!audioSrc) return;
    
    try {
      console.log('📥 [DOWNLOAD] Iniciando download de áudio...');
      
      let downloadSrc = audioSrc;
      let downloadFileName = fileName;
      
      // Se é um áudio WhatsApp criptografado, primeiro descriptografar
      if (audioUrl && audioUrl.includes('.enc') && messageId && mediaKey && fileEncSha256) {
        console.log('🔐 [DOWNLOAD] Áudio criptografado detectado - descriptografando...');
        const decryptedAudio = await decryptWhatsAppAudio(audioUrl);
        
        if (decryptedAudio) {
          // Criar data URL com áudio descriptografado
          downloadSrc = `data:audio/ogg;base64,${decryptedAudio}`;
          downloadFileName = fileName.replace('.enc', '.ogg');
          console.log('✅ [DOWNLOAD] Áudio descriptografado para download');
        } else {
          console.warn('⚠️ [DOWNLOAD] Falha na descriptografia - usando áudio original');
        }
      }
      
      // Se é base64, determinar extensão correta
      if (downloadSrc.startsWith('data:')) {
        const format = detectAudioFormat(downloadSrc.split(',')[1] || downloadSrc);
        const extensions = {
          'ogg': '.ogg',
          'wav': '.wav', 
          'mp3': '.mp3',
          'm4a': '.m4a',
          'webm': '.webm'
        };
        downloadFileName = fileName.replace(/\.[^.]+$/, extensions[format] || '.ogg');
        console.log(`📁 [DOWNLOAD] Extensão definida: ${downloadFileName} (formato: ${format})`);
      }
      
      const link = document.createElement('a');
      link.href = downloadSrc;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [DOWNLOAD] Download concluído:', downloadFileName);
      toast.success(`Áudio baixado: ${downloadFileName}`);
    } catch (error) {
      console.error('❌ [DOWNLOAD] Erro no download:', error);
      toast.error('Erro ao baixar áudio');
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
        disabled={isLoading || !!error || isDecrypting}
        className="flex-shrink-0 hover:bg-gray-200 transition-colors"
      >
        {isDecrypting ? (
          <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
        ) : isLoading ? (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 text-blue-600" />
        ) : (
          <Play className="w-4 h-4 text-green-600" />
        )}
      </Button>

      <Volume2 className="w-4 h-4 text-blue-500 flex-shrink-0" />

      <div className="flex-1 mx-2">
        {isDecrypting ? (
          <div className="text-xs text-orange-600 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Descriptografando áudio...
          </div>
        ) : error ? (
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
