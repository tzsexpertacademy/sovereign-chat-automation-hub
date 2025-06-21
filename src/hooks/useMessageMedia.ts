import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from './use-toast';

export interface MediaMessage {
  type: 'image' | 'audio' | 'video' | 'document';
  file: File;
  caption?: string;
  to: string;
}

export interface AudioRecording {
  isRecording: boolean;
  audioBlob: Blob | null;
  duration: number;
}

export const useMessageMedia = (clientId: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [audioRecording, setAudioRecording] = useState<AudioRecording>({
    isRecording: false,
    audioBlob: null,
    duration: 0
  });
  const { toast } = useToast();

  // Enviar mídia
  const sendMedia = useCallback(async (mediaMessage: MediaMessage) => {
    if (!clientId) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive"
      });
      return false;
    }

    try {
      setIsUploading(true);
      
      await whatsappService.sendMedia(
        clientId,
        mediaMessage.to,
        mediaMessage.file,
        mediaMessage.caption
      );

      toast({
        title: "Mídia enviada",
        description: `${mediaMessage.type} enviado com sucesso`,
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Falha ao enviar arquivo",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [clientId, toast]);

  // Processar imagem
  const handleImageUpload = useCallback(async (file: File, to: string, caption?: string) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Arquivo deve ser uma imagem",
        variant: "destructive"
      });
      return false;
    }

    return await sendMedia({
      type: 'image',
      file,
      caption,
      to
    });
  }, [sendMedia, toast]);

  // Processar vídeo
  const handleVideoUpload = useCallback(async (file: File, to: string, caption?: string) => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Erro",
        description: "Arquivo deve ser um vídeo",
        variant: "destructive"
      });
      return false;
    }

    // Verificar tamanho do arquivo (máximo 64MB)
    if (file.size > 64 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "Vídeo muito grande (máximo 64MB)",
        variant: "destructive"
      });
      return false;
    }

    return await sendMedia({
      type: 'video',
      file,
      caption,
      to
    });
  }, [sendMedia, toast]);

  // Processar documento
  const handleDocumentUpload = useCallback(async (file: File, to: string, caption?: string) => {
    // Verificar tamanho do arquivo (máximo 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "Documento muito grande (máximo 100MB)",
        variant: "destructive"
      });
      return false;
    }

    return await sendMedia({
      type: 'document',
      file,
      caption,
      to
    });
  }, [sendMedia, toast]);

  // Gravação de áudio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      const chunks: BlobPart[] = [];
      let startTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const duration = Math.floor((Date.now() - startTime) / 1000);
        
        setAudioRecording({
          isRecording: false,
          audioBlob,
          duration
        });
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setAudioRecording(prev => ({ ...prev, isRecording: true }));
      
      return mediaRecorder;
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  const stopRecording = useCallback((mediaRecorder: MediaRecorder | null) => {
    if (mediaRecorder && audioRecording.isRecording) {
      mediaRecorder.stop();
    }
  }, [audioRecording.isRecording]);

  const sendAudioRecording = useCallback(async (to: string) => {
    if (!audioRecording.audioBlob) {
      toast({
        title: "Erro",
        description: "Nenhuma gravação de áudio encontrada",
        variant: "destructive"
      });
      return false;
    }

    const audioFile = new File([audioRecording.audioBlob], 'audio.wav', { type: 'audio/wav' });
    
    const success = await sendMedia({
      type: 'audio',
      file: audioFile,
      to
    });

    if (success) {
      setAudioRecording({
        isRecording: false,
        audioBlob: null,
        duration: 0
      });
    }

    return success;
  }, [audioRecording.audioBlob, sendMedia, toast]);

  const clearSelectedMedia = useCallback(() => {
    setSelectedMedia(null);
    setAudioRecording({
      isRecording: false,
      audioBlob: null,
      duration: 0
    });
  }, []);

  return {
    isUploading,
    selectedMedia,
    setSelectedMedia,
    audioRecording,
    sendMedia,
    handleImageUpload,
    handleVideoUpload,
    handleDocumentUpload,
    startRecording,
    stopRecording,
    sendAudioRecording,
    clearSelectedMedia
  };
};
