import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimpleAudioRecorderProps {
  onAudioReady: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
}

const SimpleAudioRecorder = ({ onAudioReady, maxDuration = 60, className }: SimpleAudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  
  const { toast } = useToast();

  useEffect(() => {
    checkMicrophonePermission();
    return () => cleanup();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.log('❌ getUserMedia não suportado');
        setHasPermission(false);
        return;
      }
      
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🎤 Permissão do microfone:', permission.state);
      setHasPermission(permission.state === 'granted');
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      setHasPermission(null);
    }
  };

  const cleanup = () => {
    console.log('🧹 Limpando recursos...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track parado:', track.kind);
      });
      streamRef.current = null;
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
      
      console.log('✅ Acesso concedido');
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('❌ Erro ao solicitar microfone:', error);
      setHasPermission(false);
      
      toast({
        title: "Erro no Microfone",
        description: "Permissão de microfone necessária",
        variant: "destructive",
      });
      
      return false;
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎤 ===== INICIANDO GRAVAÇÃO REVISADA =====');
      
      if (hasPermission !== true) {
        const hasAccess = await requestMicrophoneAccess();
        if (!hasAccess) return;
      }
      
      // Obter stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      console.log('📡 Stream obtido:', {
        tracks: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Teste de formatos - priorizar OGG/WebM para WhatsApp
      const supportedTypes = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus', 
        'audio/webm',
        'audio/wav'
      ];
      
      let selectedType = 'audio/webm'; // fallback mais seguro
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          console.log('✅ Formato selecionado:', type);
          break;
        }
      }
      
      console.log('🎵 Criando MediaRecorder com:', selectedType);
      
      // Criar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Event handlers
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Dados disponíveis:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: Date.now() - startTimeRef.current
        });
        
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('🛑 ===== GRAVAÇÃO PARADA =====');
        
        const recordedDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        console.log('⏱️ Duração calculada:', recordedDuration, 'segundos');
        console.log('📦 Chunks coletados:', chunksRef.current.length);
        console.log('📏 Tamanhos:', chunksRef.current.map(c => c.size));
        
        if (chunksRef.current.length === 0) {
          console.error('❌ Nenhum chunk foi coletado!');
          toast({
            title: "Erro na Gravação",
            description: "Nenhum dado de áudio foi capturado",
            variant: "destructive",
          });
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: selectedType });
        
        console.log('📦 Blob final:', {
          size: blob.size,
          type: blob.type,
          sizeInKB: Math.round(blob.size / 1024),
          duration: recordedDuration
        });
        
        if (blob.size === 0) {
          console.error('❌ Blob vazio criado!');
          toast({
            title: "Erro na Gravação",
            description: "Áudio gravado está vazio",
            variant: "destructive",
          });
          return;
        }
        
        console.log('✅ Gravação bem-sucedida!');
        setRecordedBlob(blob);
        setDuration(recordedDuration);
        
        cleanup();
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ Erro no MediaRecorder:', event);
        toast({
          title: "Erro na Gravação",
          description: "Falha durante a gravação",
          variant: "destructive",
        });
      };
      
      // Iniciar gravação
      startTimeRef.current = Date.now();
      mediaRecorder.start(250); // Chunks a cada 250ms
      setIsRecording(true);
      setCurrentTime(0);
      
      console.log('🔴 Gravação iniciada em:', new Date().toISOString());
      
      // Timer visual
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setCurrentTime(elapsed);
        
        if (elapsed >= maxDuration) {
          console.log('⏰ Tempo máximo atingido');
          stopRecording();
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      toast({
        title: "Erro na Gravação",
        description: "Não foi possível acessar o microfone",
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
        console.log('🛑 MediaRecorder.stop() chamado');
      }
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (recordedBlob && !isPlaying) {
      console.log('▶️ Reproduzindo áudio...');
      
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // Debug da reprodução
      audio.onloadstart = () => console.log('🔄 Carregando áudio...');
      audio.oncanplay = () => console.log('✅ Áudio pronto para reproduzir');
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
        toast({
          title: "Erro na Reprodução",
          description: "Não foi possível reproduzir o áudio",
          variant: "destructive",
        });
      };
      
      audio.play().catch(error => {
        console.error('❌ Erro ao iniciar reprodução:', error);
        setIsPlaying(false);
        toast({
          title: "Erro na Reprodução", 
          description: "Falha ao reproduzir áudio",
          variant: "destructive",
        });
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
    if (recordedBlob && recordedBlob.size > 0) {
      console.log('📤 ===== ENVIANDO ÁUDIO =====');
      console.log('📊 Detalhes do envio:', {
        size: recordedBlob.size,
        type: recordedBlob.type,
        duration: duration,
        sizeInKB: Math.round(recordedBlob.size / 1024)
      });
      
      onAudioReady(recordedBlob, duration);
      discardRecording();
    } else {
      console.error('❌ Tentativa de envio com blob inválido');
      toast({
        title: "Erro",
        description: "Áudio inválido ou vazio",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Estados de UI
  if (hasPermission === false) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={requestMicrophoneAccess}
        className={`${className} text-red-600 border-red-300 hover:bg-red-50`}
        title="Clique para autorizar microfone"
      >
        <AlertCircle className="h-4 w-4" />
      </Button>
    );
  }

  if (!isRecording && !recordedBlob) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={startRecording}
        className={className}
        title="Gravar áudio"
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded-lg">
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

  if (recordedBlob) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-700 font-medium">
          🎤 {formatTime(duration)}
        </span>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={playRecording}
            className="text-green-600 hover:bg-green-100"
            title={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
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
            className="bg-green-600 hover:bg-green-700 text-white"
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

export default SimpleAudioRecorder;
