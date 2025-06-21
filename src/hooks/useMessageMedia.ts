
import { useState } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface AudioRecordingState {
  audioBlob: Blob | null;
  isRecording: boolean;
  duration: number;
}

export const useMessageMedia = (clientId: string) => {
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [audioRecording, setAudioRecording] = useState<AudioRecordingState>({
    audioBlob: null,
    isRecording: false,
    duration: 0
  });
  const { toast } = useToast();

  const handleImageUpload = async (file: File, chatId: string, caption?: string) => {
    try {
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        await whatsappService.sendMedia(clientId, chatId, {
          data: base64Data,
          mimetype: file.type,
          filename: file.name
        }, { caption });
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Imagem enviada",
        description: "Sua imagem foi enviada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (file: File, chatId: string, caption?: string) => {
    try {
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        await whatsappService.sendMedia(clientId, chatId, {
          data: base64Data,
          mimetype: file.type,
          filename: file.name
        }, { caption });
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Vídeo enviado",
        description: "Seu vídeo foi enviado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar vídeo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentUpload = async (file: File, chatId: string, caption?: string) => {
    try {
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        await whatsappService.sendFile(clientId, chatId, {
          data: base64Data,
          mimetype: file.type,
          filename: file.name
        }, { caption });
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Documento enviado",
        description: "Seu documento foi enviado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async (): Promise<MediaRecorder | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const startTime = Date.now();

      setAudioRecording(prev => ({ ...prev, isRecording: true, duration: 0 }));

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const duration = Math.round((Date.now() - startTime) / 1000);
        setAudioRecording({
          audioBlob,
          isRecording: false,
          duration
        });
      };

      mediaRecorder.start();
      return mediaRecorder;
    } catch (error: any) {
      setAudioRecording(prev => ({ ...prev, isRecording: false }));
      toast({
        title: "Erro ao iniciar gravação",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const stopRecording = (mediaRecorder: MediaRecorder | null) => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setAudioRecording(prev => ({ ...prev, isRecording: false }));
  };

  const sendAudioRecording = async (chatId: string) => {
    if (!audioRecording.audioBlob) return;

    try {
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        await whatsappService.sendMedia(clientId, chatId, {
          data: base64Data,
          mimetype: 'audio/wav',
          filename: 'audio.wav'
        });
      };
      reader.readAsDataURL(audioRecording.audioBlob);
      
      setAudioRecording({
        audioBlob: null,
        isRecording: false,
        duration: 0
      });
      
      toast({
        title: "Áudio enviado",
        description: "Seu áudio foi enviado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar áudio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelectedMedia = () => {
    setSelectedMedia(null);
    setAudioRecording({
      audioBlob: null,
      isRecording: false,
      duration: 0
    });
  };

  return {
    selectedMedia,
    setSelectedMedia,
    isUploading,
    audioRecording,
    handleImageUpload,
    handleVideoUpload,
    handleDocumentUpload,
    startRecording,
    stopRecording,
    sendAudioRecording,
    clearSelectedMedia
  };
};
