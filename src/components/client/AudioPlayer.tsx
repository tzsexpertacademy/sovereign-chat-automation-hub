import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Download, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { useMediaRecovery } from '@/hooks/useMediaRecovery';

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
  const { recoverMedia, isRecovering, error: recoveryError, clearRecoveryState } = useMediaRecovery();

  // Detectar formato de áudio pelos headers
  const detectAudioFormat = (base64Data: string): string => {
    try {
      if (!base64Data || base64Data.length < 40) {
        return 'ogg';
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
        return 'wav';
      }
      
      // MP3: ID3 ou frame sync
      if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        return 'mp3';
      }
      if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
        return 'mp3';
      }
      
      // M4A: ftyp
      if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        return 'm4a';
      }
      
      return 'ogg'; // Fallback para WhatsApp
    } catch (e) {
      console.warn('⚠️ Player: erro na detecção de formato:', e);
      return 'ogg';
    }
  };

  // Criar sources otimizados para reprodução
  const createAudioSources = (base64Data: string): string[] => {
    try {
      const format = detectAudioFormat(base64Data);
      
      // Mapear formatos para MIME types otimizados
      const mimeTypes = {
        'ogg': ['audio/ogg; codecs=opus', 'audio/ogg', 'audio/webm; codecs=opus'],
        'wav': ['audio/wav', 'audio/wave'],
        'mp3': ['audio/mpeg', 'audio/mp3'],
        'm4a': ['audio/mp4', 'audio/m4a'],
        'webm': ['audio/webm; codecs=opus', 'audio/webm']
      };
      
      const typeList = mimeTypes[format as keyof typeof mimeTypes] || ['audio/ogg; codecs=opus'];
      
      return typeList.map(mimeType => `data:${mimeType};base64,${base64Data}`);
    } catch (error) {
      console.error('❌ Player: Erro ao criar sources:', error);
      return [`data:audio/ogg; codecs=opus;base64,${base64Data}`];
    }
  };

  // Descriptografar áudio WhatsApp usando directMediaDownloadService
  const decryptWhatsAppAudio = async (encryptedUrl: string): Promise<string | null> => {
    try {
      console.log('🔐 Player: Iniciando descriptografia via directMediaDownloadService');
      
      if (!messageId || !mediaKey) {
        console.error('❌ Player: Chaves de descriptografia não disponíveis');
        return null;
      }

      // Obter instanceId do ticket atual
      const currentUrl = window.location.pathname;
      const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
      let instanceId = 'default';
      
      if (ticketIdMatch) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: ticketData } = await supabase
          .from('conversation_tickets')
          .select('instance_id')
          .eq('id', ticketIdMatch[1])
          .single();
        
        if (ticketData?.instance_id) {
          instanceId = ticketData.instance_id;
        }
      }

      const result = await directMediaDownloadService.processMedia(
        instanceId,
        messageId,
        encryptedUrl,
        mediaKey,
        undefined, // directPath
        'audio/ogg',
        'audio'
      );

      console.log('📡 Player: Resultado da descriptografia:', {
        success: result?.success,
        hasMediaUrl: !!result?.mediaUrl,
        cached: result?.cached
      });

      if (result?.success && result?.mediaUrl) {
        console.log('✅ Player: Áudio descriptografado com sucesso - usando blob URL diretamente');
        // Usar blob URL diretamente no elemento audio
        return result.mediaUrl;
      }

      console.error('❌ Player: Falha na descriptografia');
      return null;
    } catch (error) {
      console.error('❌ Player: Erro na descriptografia:', error);
      return null;
    }
  };

  // Inicializar áudio
  useEffect(() => {
    let mounted = true;
    
    const initializeAudio = async () => {
      if (!mounted) return;
      
      setIsLoading(true);
      setError(null);
      
      console.log('🎵 Player: INICIANDO PROCESSAMENTO', {
        hasAudioData: !!audioData,
        hasAudioUrl: !!audioUrl,
        audioDataLength: audioData?.length,
        isEncrypted: audioUrl?.includes('.enc'),
        hasDecryptionKeys: !!(messageId && mediaKey),
        audioUrl: audioUrl?.substring(0, 100) + '...',
        timestamp: new Date().toISOString()
      });

      try {
        // 🔥 1. PRIORIDADE MÁXIMA: Dados base64 já descriptografados (funciona instantaneamente)
        if (audioData && !audioUrl?.includes('.enc')) {
          console.log('✅ Player: Usando dados base64 descriptografados');
          const sources = createAudioSources(audioData);
          setAudioSrc(sources[0]);
          return;
        }

        // 2. Áudio criptografado (.enc) com chaves de processamento
        if (audioUrl?.includes('.enc') && messageId && mediaKey) {
          console.log('🔐 Player: DETECTADO ÁUDIO CRIPTOGRAFADO - iniciando descriptografia');
          setIsDecrypting(true);
          
          try {
            const result = await decryptWhatsAppAudio(audioUrl);
            
            if (result) {
              console.log('✅ Player: DESCRIPTOGRAFIA BEM-SUCEDIDA');
              // Se é blob URL, usar diretamente; se é base64, criar sources
              if (result.startsWith('blob:')) {
                setAudioSrc(result);
              } else {
                const sources = createAudioSources(result);
                setAudioSrc(sources[0]);
              }
              setDecryptionAttempted(true);
              setIsDecrypting(false);
              clearRecoveryState(); // Limpar estados de recovery se sucesso
              return;
            } else {
              console.log('❌ Player: FALHA NA DESCRIPTOGRAFIA INICIAL');
              setError('Falha no processamento do áudio - tente o botão de recuperação');
              setDecryptionAttempted(true);
            }
          } catch (decryptError) {
            console.error('❌ Player: ERRO NA DESCRIPTOGRAFIA:', decryptError);
            setError('Erro na descriptografia - tente o botão de recuperação');
            setDecryptionAttempted(true);
          }
          setIsDecrypting(false);
        }

        // 3. FALLBACK INTELIGENTE: URLs diretas (áudios enviados do frontend)
        if (audioUrl && !audioUrl.includes('.enc')) {
          console.log('🔄 Player: Usando URL direta (áudio do frontend)');
          setAudioSrc(audioUrl);
          return;
        }

        // 4. Áudio base64 sem descriptografia (raro mas possível)
        if (audioData) {
          console.log('🔄 Player: Usando dados base64 diretos');
          const sources = createAudioSources(audioData);
          setAudioSrc(sources[0]);
          return;
        }

        // 5. Erros específicos para diagnóstico
        if (!audioData && !audioUrl) {
          setError('Nenhum dado de áudio disponível');
          return;
        }

        if (audioUrl?.includes('.enc') && (!messageId || !mediaKey)) {
          setError('Áudio criptografado sem chaves de descriptografia');
          return;
        }

        setError('Formato de áudio não suportado');
        
      } catch (error) {
        console.error('❌ Player: Erro na inicialização:', error);
        setError('Erro ao carregar áudio');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAudio();
    
    return () => {
      mounted = false;
    };
  }, [audioData, audioUrl, messageId, mediaKey]);

  // Configurar event listeners do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleError = (e: Event) => {
      console.error('❌ Player: Erro no elemento audio:', e);
      const target = e.target as HTMLAudioElement;
      console.error('❌ Player: Audio error details:', {
        error: target.error,
        networkState: target.networkState,
        readyState: target.readyState,
        src: target.src
      });
      setError('Erro ao reproduzir áudio');
    };
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => console.log('🔄 Player: Iniciando carregamento do áudio');
    const handleCanPlay = () => console.log('✅ Player: Áudio pronto para reprodução');

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [audioSrc]);

  const togglePlay = async () => {
    if (!audioRef.current || (!audioSrc && !error)) return;

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
      console.error('❌ Player: Erro ao tocar áudio:', error);
      setError('Erro ao reproduzir áudio');
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
    try {
      setIsLoading(true);
      
      // Se temos dados descriptografados, usar eles
      if (audioData) {
        const format = detectAudioFormat(audioData);
        const mimeType = format === 'ogg' ? 'audio/ogg' : 
                        format === 'wav' ? 'audio/wav' : 
                        format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
        
        const blob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace(/\.[^.]+$/, `.${format}`);
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Áudio baixado com sucesso');
        return;
      }

      // Se é áudio criptografado, tentar descriptografar
      if (audioUrl?.includes('.enc') && messageId && mediaKey) {
        console.log('💾 Player: Descriptografando para download...');
        const decryptedData = await decryptWhatsAppAudio(audioUrl);
        
        if (decryptedData) {
          // Se é blob URL, usar diretamente
          if (decryptedData.startsWith('blob:')) {
            const response = await fetch(decryptedData);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace(/\.[^.]+$/, '.ogg');
            a.click();
            URL.revokeObjectURL(url);
          } else {
            // Se é base64, converter para blob
            const blob = new Blob([Uint8Array.from(atob(decryptedData), c => c.charCodeAt(0))], { 
              type: 'audio/ogg' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace(/\.[^.]+$/, '.ogg');
            a.click();
            URL.revokeObjectURL(url);
          }
          toast.success('Áudio baixado com sucesso');
          return;
        } else {
          toast.error('Não foi possível descriptografar o áudio para download');
          return;
        }
      }

      // Fallback para download direto da URL
      if (audioSrc || audioUrl) {
        const downloadUrl = audioSrc || audioUrl!;
        
        // Se for blob URL, fazer nova requisição
        if (downloadUrl.startsWith('blob:')) {
          const response = await fetch(downloadUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName;
          a.click();
        }
        toast.success('Download iniciado');
      } else {
        toast.error('Nenhum áudio disponível para download');
      }
    } catch (error) {
      console.error('❌ Player: Erro ao baixar áudio:', error);
      toast.error('Erro ao baixar áudio');
    } finally {
      setIsLoading(false);
    }
  };

  // Exibir sempre o player
  return (
    <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border">
      <audio 
        ref={audioRef}
        src={audioSrc || undefined}
        preload="metadata"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={isLoading || isDecrypting || (!audioSrc && !error)}
        className="h-8 w-8 p-0"
      >
        {isLoading || isDecrypting ? (
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
          disabled={!audioSrc || isLoading}
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
        disabled={isLoading}
        className="h-8 w-8 p-0"
        title="Baixar áudio"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>

      {/* Botão de recuperação para áudios com problemas */}
      {(error || (decryptionAttempted && !audioSrc)) && audioUrl?.includes('.enc') && messageId && mediaKey && (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!audioUrl || !messageId || !mediaKey) return;
            
            try {
              console.log('🔄 Player: INICIANDO RECUPERAÇÃO MANUAL');
              clearRecoveryState();
              
              const currentUrl = window.location.pathname;
              const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
              let instanceId = 'default';
              
              if (ticketIdMatch) {
                const { supabase } = await import('@/integrations/supabase/client');
                const { data: ticketData } = await supabase
                  .from('conversation_tickets')
                  .select('instance_id')
                  .eq('id', ticketIdMatch[1])
                  .single();
                
                if (ticketData?.instance_id) {
                  instanceId = ticketData.instance_id;
                }
              }

              const result = await recoverMedia(
                instanceId,
                messageId,
                audioUrl,
                mediaKey,
                undefined,
                'audio/ogg',
                'audio'
              );

              if (result.success && result.mediaUrl) {
                console.log('✅ Player: RECUPERAÇÃO BEM-SUCEDIDA');
                setAudioSrc(result.mediaUrl);
                setError(null);
                setDecryptionAttempted(true);
                toast.success('Áudio recuperado com sucesso!');
              }
            } catch (error) {
              console.error('❌ Player: FALHA NA RECUPERAÇÃO:', error);
              toast.error('Falha na recuperação do áudio');
            }
          }}
          disabled={isRecovering}
          className="h-8 w-8 p-0"
          title="Tentar recuperar áudio"
        >
          {isRecovering ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
        </Button>
      )}

      {/* Status indicators */}
      <div className="flex flex-col items-end text-xs min-w-[80px]">
        {isDecrypting && (
          <div className="text-muted-foreground flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Descriptografando...
          </div>
        )}
        
        {isRecovering && (
          <div className="text-blue-600 flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Recuperando...
          </div>
        )}
        
        {error && !isRecovering && (
          <div className="text-destructive flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            <span className="truncate max-w-[60px]" title={error}>
              {error}
            </span>
          </div>
        )}
        
        {audioSrc && !error && !isDecrypting && !isRecovering && (
          <div className="text-green-600 flex items-center">
            ✓ Pronto
          </div>
        )}

        {decryptionAttempted && !audioSrc && !isRecovering && (
          <div className="text-orange-600 flex items-center text-xs">
            ⚠️ Falha
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;