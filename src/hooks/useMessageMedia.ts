
import { useState, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { fileUploadService } from '@/services/fileUploadService';
import { useToast } from './use-toast';

export const useMessageMedia = (clientId: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecording, setAudioRecording] = useState<{
    audioBlob: Blob | null;
    duration: number;
  }>({ audioBlob: null, duration: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await uploadAndSendFile(file);
  };

  const uploadAndSendFile = async (file: File, chatId?: string) => {
    try {
      setIsUploading(true);
      
      // Upload do arquivo
      const uploadedFile = await fileUploadService.uploadFile(file, 'media');
      
      if (!uploadedFile.url) {
        throw new Error('Falha no upload do arquivo');
      }

      // Se temos chatId, enviar mensagem com mídia
      if (chatId) {
        const message = `📎 Arquivo: ${file.name}`;
        await whatsappService.sendMessage(clientId, chatId, message, true, uploadedFile.url);
        
        toast({
          title: "Arquivo enviado",
          description: `${file.name} foi enviado com sucesso`
        });
      }

      return uploadedFile;

    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: "Erro no envio",
        description: error.message || "Falha ao enviar arquivo",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendMediaMessage = async (chatId: string, mediaUrl: string, caption?: string) => {
    try {
      const message = caption || '📎 Mídia enviada';
      await whatsappService.sendMessage(clientId, chatId, message, true, mediaUrl);
      
      toast({
        title: "Mídia enviada",
        description: "Arquivo de mídia enviado com sucesso"
      });
      
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Falha ao enviar arquivo de mídia",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Métodos para diferentes tipos de arquivo
  const handleImageUpload = async (file: File, chatId: string): Promise<boolean> => {
    try {
      await uploadAndSendFile(file, chatId);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleVideoUpload = async (file: File, chatId: string): Promise<boolean> => {
    try {
      await uploadAndSendFile(file, chatId);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDocumentUpload = async (file: File, chatId: string): Promise<boolean> => {
    try {
      await uploadAndSendFile(file, chatId);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Métodos para gravação de áudio
  const startRecording = async (): Promise<MediaRecorder | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      const chunks: Blob[] = [];
      let startTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        setAudioRecording({ audioBlob, duration });
        setIsRecording(false);
        
        // Parar stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
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
  };

  const stopRecording = (mediaRecorder: MediaRecorder) => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  };

  const sendAudioRecording = async (chatId: string): Promise<boolean> => {
    try {
      if (!audioRecording.audioBlob) {
        throw new Error('Nenhuma gravação disponível');
      }

      setIsUploading(true);
      
      // Converter blob para file
      const audioFile = new File([audioRecording.audioBlob], 'audio.wav', {
        type: 'audio/wav'
      });
      
      await uploadAndSendFile(audioFile, chatId);
      
      // Limpar gravação
      setAudioRecording({ audioBlob: null, duration: 0 });
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    isRecording,
    audioRecording,
    fileInputRef,
    handleFileSelect,
    handleFileChange,
    uploadAndSendFile,
    sendMediaMessage,
    handleImageUpload,
    handleVideoUpload,
    handleDocumentUpload,
    startRecording,
    stopRecording,
    sendAudioRecording
  };
};
