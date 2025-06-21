
import { useState } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

export const useMessageMedia = (clientId: string) => {
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [audioRecording, setAudioRecording] = useState<Blob | null>(null);
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

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        setAudioRecording(audioBlob);
      };

      mediaRecorder.start();
      return mediaRecorder;
    } catch (error: any) {
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
  };

  const sendAudioRecording = async (chatId: string) => {
    if (!audioRecording) return;

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
      reader.readAsDataURL(audioRecording);
      
      setAudioRecording(null);
      
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
