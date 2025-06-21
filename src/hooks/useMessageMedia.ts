
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from "@/hooks/use-toast";

interface AudioRecording {
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

  const handleImageUpload = useCallback(async (file: File, chatId: string, caption?: string) => {
    if (!clientId) return;
    
    try {
      setIsUploading(true);
      await whatsappService.sendMedia(clientId, chatId, file, caption);
      
      toast({
        title: "Imagem enviada",
        description: "A imagem foi enviada com sucesso",
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
  }, [clientId, toast]);

  const handleVideoUpload = useCallback(async (file: File, chatId: string, caption?: string) => {
    if (!clientId) return;
    
    try {
      setIsUploading(true);
      await whatsappService.sendMedia(clientId, chatId, file, caption);
      
      toast({
        title: "Vídeo enviado",
        description: "O vídeo foi enviado com sucesso",
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
  }, [clientId, toast]);

  const handleDocumentUpload = useCallback(async (file: File, chatId: string, caption?: string) => {
    if (!clientId) return;
    
    try {
      setIsUploading(true);
      await whatsappService.sendMedia(clientId, chatId, file, caption);
      
      toast({
        title: "Documento enviado",
        description: "O documento foi enviado com sucesso",
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
  }, [clientId, toast]);

  const startRecording = useCallback(async (): Promise<MediaRecorder | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        setAudioRecording(prev => ({ ...prev, audioBlob, isRecording: false }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setAudioRecording(prev => ({ ...prev, isRecording: true }));
      
      return mediaRecorder;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erro ao gravar áudio",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const stopRecording = useCallback((mediaRecorder: MediaRecorder | null) => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, []);

  const sendAudioRecording = useCallback(async (chatId: string) => {
    if (!audioRecording.audioBlob || !clientId) return;
    
    try {
      setIsUploading(true);
      await whatsappService.sendAudio(clientId, chatId, audioRecording.audioBlob);
      
      setAudioRecording({ isRecording: false, audioBlob: null, duration: 0 });
      
      toast({
        title: "Áudio enviado",
        description: "O áudio foi enviado com sucesso",
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
  }, [audioRecording.audioBlob, clientId, toast]);

  const clearSelectedMedia = useCallback(() => {
    setSelectedMedia(null);
    setAudioRecording({ isRecording: false, audioBlob: null, duration: 0 });
  }, []);

  return {
    isUploading,
    selectedMedia,
    setSelectedMedia,
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
