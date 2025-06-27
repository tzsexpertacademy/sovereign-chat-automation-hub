
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WAVEncoder } from "@/utils/wavEncoder";

interface NativeWAVRecorderProps {
  onAudioReady: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
}

const NativeWAVRecorder = ({ onAudioReady, maxDuration = 60, className }: NativeWAVRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedSamplesRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(44100);
  
  const { toast } = useToast();

  useEffect(() => {
    checkMicrophonePermission();
    
    return () => {
      cleanup();
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      setIsCheckingPermission(true);
      console.log('🎤 Verificando permissões de microfone...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia não suportado');
        setHasPermission(false);
        return;
      }
      
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🔍 Status da permissão:', permission.state);
      
      if (permission.state === 'granted') {
        setHasPermission(true);
      } else if (permission.state === 'prompt') {
        setHasPermission(null);
      } else {
        setHasPermission(false);
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      setHasPermission(null);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const cleanup = () => {
    console.log('🧹 Limpando recursos do WAV Recorder...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track parado:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
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
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      console.log('✅ Acesso ao microfone concedido');
      setHasPermission(true);
      
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
      console.log('🎤 ===== INICIANDO GRAVAÇÃO WAV NATIVA =====');
      
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
      
      console.log('📡 Stream obtido:', {
        tracks: stream.getTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      streamRef.current = stream;
      
      // Criar AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });
      
      const audioContext = audioContextRef.current;
      sampleRateRef.current = audioContext.sampleRate;
      
      console.log('🎵 AudioContext criado:', {
        sampleRate: audioContext.sampleRate,
        state: audioContext.state
      });
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Criar nós de áudio
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processorRef.current = processor;
      recordedSamplesRef.current = [];
      
      // Processar áudio
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const samples = new Float32Array(inputData.length);
        samples.set(inputData);
        recordedSamplesRef.current.push(samples);
        
        console.log('📊 Processando chunk:', {
          length: inputData.length,
          totalChunks: recordedSamplesRef.current.length,
          peak: Math.max(...Array.from(inputData).map(Math.abs))
        });
      };
      
      // Conectar nós
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      setCurrentTime(0);
      
      console.log('🔴 Gravação WAV iniciada');
      
      // Timer para duração
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            console.log('⏰ Tempo máximo atingido');
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação WAV:', error);
      
      let errorMessage = 'Não foi possível iniciar a gravação';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão de microfone necessária';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Microfone não encontrado';
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
    console.log('🛑 ===== PARANDO GRAVAÇÃO WAV =====');
    
    if (!isRecording || recordedSamplesRef.current.length === 0) {
      console.log('❌ Nenhuma gravação para parar');
      return;
    }
    
    try {
      // Parar timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Calcular total de samples
      const totalSamples = recordedSamplesRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      console.log('📊 Total de samples gravados:', totalSamples);
      
      if (totalSamples === 0) {
        console.error('❌ Nenhum sample gravado');
        toast({
          title: "Erro",
          description: "Nenhum áudio foi gravado",
          variant: "destructive",
        });
        return;
      }
      
      // Concatenar todos os chunks
      const allSamples = new Float32Array(totalSamples);
      let offset = 0;
      
      for (const chunk of recordedSamplesRef.current) {
        allSamples.set(chunk, offset);
        offset += chunk.length;
      }
      
      console.log('📦 Samples concatenados:', {
        totalLength: allSamples.length,
        duration: allSamples.length / sampleRateRef.current,
        peak: Math.max(...Array.from(allSamples).map(Math.abs))
      });
      
      // Codificar para WAV
      const wavEncoder = new WAVEncoder(sampleRateRef.current, 1, 16);
      const wavBlob = wavEncoder.encodeWAV(allSamples);
      
      console.log('🎵 ===== WAV GERADO COM SUCESSO =====');
      console.log('📊 Blob WAV:', {
        size: wavBlob.size,
        type: wavBlob.type,
        sizeInKB: Math.round(wavBlob.size / 1024),
        duration: currentTime
      });
      
      setRecordedBlob(wavBlob);
      setDuration(currentTime);
      setIsRecording(false);
      
      cleanup();
      
    } catch (error) {
      console.error('❌ Erro ao processar gravação:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar áudio gravado",
        variant: "destructive",
      });
      setIsRecording(false);
      cleanup();
    }
  };

  const playRecording = () => {
    if (recordedBlob && !isPlaying) {
      console.log('▶️ Reproduzindo WAV...');
      
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
    console.log('🗑️ Descartando gravação WAV');
    
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
      console.log('📤 ===== ENVIANDO WAV =====');
      console.log('📊 WAV para envio:', {
        size: recordedBlob.size,
        type: recordedBlob.type,
        duration: duration,
        sizeInKB: Math.round(recordedBlob.size / 1024)
      });
      
      if (recordedBlob.size === 0) {
        console.error('❌ WAV vazio');
        toast({
          title: "Erro",
          description: "Áudio está vazio",
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Enviando WAV válido');
      onAudioReady(recordedBlob, duration);
      discardRecording();
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

  // Estado inicial
  if (!isRecording && !recordedBlob) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={startRecording}
        className={className}
        title="Gravar áudio WAV (máx. 60s)"
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
            WAV {formatTime(currentTime)} / {formatTime(maxDuration)}
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

  // Estado com gravação WAV pronta
  if (recordedBlob) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-700 font-medium">
          🎵 WAV {formatTime(duration)}
        </span>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={playRecording}
            className="text-green-600 hover:bg-green-100"
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
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Enviar áudio WAV"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default NativeWAVRecorder;
