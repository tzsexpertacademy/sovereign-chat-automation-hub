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
  
  const { toast } = useToast();

  useEffect(() => {
    checkMicrophonePermission();
    return () => cleanup();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasPermission(false);
        return;
      }
      
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setHasPermission(permission.state === 'granted');
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setHasPermission(null);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Erro ao solicitar microfone:', error);
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
      if (hasPermission !== true) {
        const hasAccess = await requestMicrophoneAccess();
        if (!hasAccess) return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Preferir OGG (mais compatível com WhatsApp), depois WAV
      const supportedTypes = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/wav',
        'audio/webm'
      ];
      
      let selectedType = 'audio/wav'; // fallback seguro
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          console.log('✅ Formato de gravação selecionado:', type);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        audioBitsPerSecond: 128000 // qualidade otimizada
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedType });
        const finalDuration = currentTime > 0 ? currentTime : 1; // mínimo 1 segundo
        
        console.log('📦 Áudio gravado com duração corrigida:', {
          size: blob.size,
          type: blob.type,
          sizeInKB: Math.round(blob.size / 1024),
          duration: finalDuration,
          originalDuration: currentTime
        });
        
        if (blob.size > 0) {
          setRecordedBlob(blob);
          setDuration(finalDuration); // ✅ CORREÇÃO: Garantir duração correta
        } else {
          toast({
            title: "Erro na Gravação",
            description: "Áudio gravado está vazio",
            variant: "destructive",
          });
        }
        
        cleanup();
      };
      
      mediaRecorder.start(250); // chunks menores para melhor qualidade
      setIsRecording(true);
      setCurrentTime(0);
      
      // Timer
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
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
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      // ✅ CORREÇÃO: Usar currentTime como duração final
      const finalDuration = currentTime > 0 ? currentTime : 1; // mínimo 1 segundo
      setDuration(finalDuration);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (recordedBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(error => {
        console.error('Erro na reprodução:', error);
        setIsPlaying(false);
      });
      
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const discardRecording = () => {
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
      console.log('📤 Enviando áudio:', {
        size: recordedBlob.size,
        type: recordedBlob.type,
        duration: duration
      });
      
      onAudioReady(recordedBlob, duration);
      discardRecording();
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
