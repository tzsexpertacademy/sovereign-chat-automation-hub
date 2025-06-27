import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
}

const AudioRecorder = ({ onAudioReady, maxDuration = 60, className }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const { toast } = useToast();

  // Verificar permissões na inicialização
  useEffect(() => {
    checkMicrophonePermission();
    
    return () => {
      stopRecording();
      cleanup();
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      setIsCheckingPermission(true);
      console.log('🎤 Verificando permissões de microfone...');
      
      // Verificar se o navegador suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia não suportado neste navegador');
        setHasPermission(false);
        return;
      }
      
      // Verificar permissões
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🔍 Status da permissão:', permission.state);
      
      if (permission.state === 'granted') {
        setHasPermission(true);
      } else if (permission.state === 'prompt') {
        setHasPermission(null); // Usuário precisa autorizar
      } else {
        setHasPermission(false);
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      setHasPermission(null); // Tentar mesmo assim
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const cleanup = () => {
    console.log('🧹 Limpando recursos do AudioRecorder...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track parado:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const requestMicrophoneAccess = async () => {
    try {
      console.log('🎤 Solicitando acesso ao microfone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      console.log('✅ Acesso ao microfone concedido');
      setHasPermission(true);
      
      // Parar stream imediatamente - só queríamos testar a permissão
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao solicitar acesso ao microfone:', error);
      
      let errorMessage = 'Erro ao acessar microfone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão de microfone negada. Autorize o acesso nas configurações do navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhum microfone encontrado no dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microfone sendo usado por outro aplicativo.';
      }
      
      setHasPermission(false);
      
      toast({
        title: "Erro no Microfone",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎤 ===== INICIANDO GRAVAÇÃO COM DEBUG =====');
      
      // Verificar/solicitar permissões primeiro
      if (hasPermission !== true) {
        const hasAccess = await requestMicrophoneAccess();
        if (!hasAccess) return;
      }
      
      // Obter stream de áudio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      console.log('📡 Stream de áudio obtido:', {
        tracks: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // TESTAR FORMATOS SUPORTADOS COM PRIORIDADE PARA WAV
      const supportedMimeTypes = [
        'audio/wav',           // PRIORIDADE MÁXIMA - mais compatível
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg'
      ];
      
      let selectedMimeType = 'audio/wav'; // Default seguro
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('✅ Formato selecionado:', mimeType);
          break;
        }
      }
      
      console.log('🎵 ===== CONFIGURAÇÃO DO MEDIARECORDER =====');
      console.log('📋 Formato escolhido:', selectedMimeType);
      console.log('🔍 Formatos testados:', supportedMimeTypes.map(m => `${m}: ${MediaRecorder.isTypeSupported(m)}`));
      
      // Criar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Configurar eventos com debug detalhado
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Dados disponíveis:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: new Date().toISOString()
        });
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('📦 Total de chunks:', chunksRef.current.length);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('🛑 ===== GRAVAÇÃO PARADA, PROCESSANDO =====');
        console.log('📊 Chunks coletados:', chunksRef.current.length);
        console.log('📏 Tamanhos dos chunks:', chunksRef.current.map(c => c.size));
        
        const blob = new Blob(chunksRef.current, { 
          type: selectedMimeType 
        });
        
        console.log('📦 ===== BLOB FINAL CRIADO =====');
        console.log('📊 Blob details:', {
          size: blob.size,
          type: blob.type,
          sizeInKB: Math.round(blob.size / 1024),
          sizeInMB: Math.round(blob.size / 1024 / 1024 * 100) / 100
        });
        
        // VERIFICAR SE O BLOB É VÁLIDO
        if (blob.size === 0) {
          console.error('❌ BLOB VAZIO - algo deu errado na gravação');
          toast({
            title: "Erro na Gravação",
            description: "Áudio gravado está vazio. Tente novamente.",
            variant: "destructive",
          });
          return;
        }
        
        if (blob.size > 50 * 1024 * 1024) { // 50MB
          console.error('❌ BLOB MUITO GRANDE:', blob.size);
          toast({
            title: "Arquivo Muito Grande",
            description: "Áudio muito longo. Máximo permitido: 50MB",
            variant: "destructive",
          });
          return;
        }
        
        console.log('✅ BLOB VÁLIDO - definindo no estado');
        setRecordedBlob(blob);
        cleanup();
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ Erro no MediaRecorder:', event);
        toast({
          title: "Erro na Gravação",
          description: "Falha durante a gravação do áudio",
          variant: "destructive",
        });
      };
      
      // Iniciar gravação
      mediaRecorder.start(100); // Capturar dados a cada 100ms
      setIsRecording(true);
      setCurrentTime(0);
      
      console.log('🔴 Gravação iniciada com sucesso');
      
      // Timer para atualizar duração
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            console.log('⏰ Tempo máximo atingido, parando gravação');
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      
      let errorMessage = 'Não foi possível iniciar a gravação';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão de microfone necessária. Autorize o acesso e tente novamente.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Microfone não encontrado. Conecte um microfone e tente novamente.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microfone em uso por outro aplicativo. Feche outros aplicativos e tente novamente.';
      }
      
      toast({
        title: "Erro na Gravação",
        description: errorMessage,
        variant: "destructive",
      });
      
      setIsRecording(false);
      cleanup();
    }
  };

  const stopRecording = () => {
    console.log('🛑 Parando gravação...');
    
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setDuration(currentTime);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('✅ Gravação parada, duração:', currentTime, 'segundos');
    }
  };

  const playRecording = () => {
    if (recordedBlob && !isPlaying) {
      console.log('▶️ Reproduzindo gravação...');
      
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => {
        console.log('▶️ Reprodução iniciada');
        setIsPlaying(true);
      };
      
      audio.onended = () => {
        console.log('⏹️ Reprodução finalizada');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (error) => {
        console.error('❌ Erro na reprodução:', error);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(error => {
        console.error('❌ Erro ao iniciar reprodução:', error);
        setIsPlaying(false);
      });
      
    } else if (audioRef.current && isPlaying) {
      console.log('⏸️ Pausando reprodução');
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const discardRecording = () => {
    console.log('🗑️ Descartando gravação');
    
    setRecordedBlob(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const sendRecording = () => {
    if (recordedBlob) {
      console.log('📤 ===== ENVIANDO GRAVAÇÃO =====');
      console.log('📊 Blob a ser enviado:', {
        size: recordedBlob.size,
        type: recordedBlob.type,
        duration: duration,
        sizeInKB: Math.round(recordedBlob.size / 1024),
        sizeInMB: Math.round(recordedBlob.size / 1024 / 1024 * 100) / 100
      });
      
      // VERIFICAÇÃO FINAL ANTES DO ENVIO
      if (recordedBlob.size === 0) {
        console.error('❌ TENTATIVA DE ENVIO COM BLOB VAZIO');
        toast({
          title: "Erro",
          description: "Áudio está vazio. Grave novamente.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ BLOB VÁLIDO - enviando para onAudioReady');
      onAudioReady(recordedBlob, duration);
      discardRecording();
    } else {
      console.error('❌ TENTATIVA DE ENVIO SEM BLOB');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Estado: Verificando permissões
  if (isCheckingPermission) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        className={className}
        title="Verificando permissões..."
      >
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </Button>
    );
  }

  // Estado: Sem permissão
  if (hasPermission === false) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={requestMicrophoneAccess}
        className={`${className} text-red-600 border-red-300 hover:bg-red-50`}
        title="Clique para autorizar acesso ao microfone"
      >
        <AlertCircle className="h-4 w-4" />
      </Button>
    );
  }

  // Estado inicial - botão de gravação
  if (!isRecording && !recordedBlob) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={startRecording}
        className={className}
        title="Gravar áudio (máx. 60s)"
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  // Estado gravando
  if (isRecording) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded-lg animate-pulse">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-700">
            {formatTime(currentTime)} / {formatTime(maxDuration)}
          </span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={stopRecording}
          className="text-red-600 border-red-300 hover:bg-red-100"
        >
          <Square className="h-3 w-3 mr-1" />
          Parar
        </Button>
      </div>
    );
  }

  // Estado com gravação pronta
  if (recordedBlob) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm text-blue-700 font-medium">
          🎤 {formatTime(duration)}
        </span>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={playRecording}
            className="text-blue-600 hover:bg-blue-100"
            title={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={discardRecording}
            className="text-red-600 hover:bg-red-50"
            title="Descartar"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={sendRecording}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Enviar áudio"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default AudioRecorder;
