
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from './use-toast';
import { manualMessageSaver } from '@/services/manualMessageSaver';

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

export const useMessageMedia = (clientId: string, ticketId?: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [audioRecording, setAudioRecording] = useState<AudioRecording>({
    isRecording: false,
    audioBlob: null,
    duration: 0
  });
  const { toast } = useToast();

  // Enviar mídia via senders especializados (CORRIGIDO)
  const sendMedia = useCallback(async (mediaMessage: MediaMessage) => {
    if (!clientId) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive"
      });
      return { success: false, error: 'Cliente não encontrado' };
    }

    try {
      setIsUploading(true);
      
      console.log(`📤 [MEDIA-HOOK] Enviando ${mediaMessage.type} para ${mediaMessage.to}:`, {
        filename: mediaMessage.file.name,
        size: mediaMessage.file.size,
        type: mediaMessage.file.type,
        clientId
      });
      
      const messageId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let result: any;

      // Usar senders especializados baseados no AudioSender que funciona
      if (mediaMessage.type === 'audio') {
        const { AudioSender } = await import('@/services/audioSender');
        const blob = new Blob([mediaMessage.file], { type: mediaMessage.file.type });
        
        result = await AudioSender.sendWithIntelligentRetry(
          blob,
          mediaMessage.to,
          clientId,
          messageId
        );
        
        console.log('✅ [MEDIA-HOOK] Áudio enviado via AudioSender:', result);
      } else if (mediaMessage.type === 'image') {
        const { ImageSender } = await import('@/services/imageSender');
        const blob = new Blob([mediaMessage.file], { type: mediaMessage.file.type });
        
        result = await ImageSender.sendWithIntelligentRetry(
          blob,
          mediaMessage.to,
          clientId,
          messageId,
          mediaMessage.caption
        );
        
        console.log('✅ [MEDIA-HOOK] Imagem enviada via ImageSender:', result);
      } else if (mediaMessage.type === 'video') {
        const { VideoSender } = await import('@/services/videoSender');
        const blob = new Blob([mediaMessage.file], { type: mediaMessage.file.type });
        
        result = await VideoSender.sendWithIntelligentRetry(
          blob,
          mediaMessage.to,
          clientId,
          messageId,
          mediaMessage.caption
        );
        
        console.log('✅ [MEDIA-HOOK] Vídeo enviado via VideoSender:', result);
      } else if (mediaMessage.type === 'document') {
        const { DocumentSender } = await import('@/services/documentSender');
        const blob = new Blob([mediaMessage.file], { type: mediaMessage.file.type });
        
        result = await DocumentSender.sendWithIntelligentRetry(
          blob,
          mediaMessage.to,
          clientId,
          messageId,
          mediaMessage.file.name,
          mediaMessage.caption
        );
        
        console.log('✅ [MEDIA-HOOK] Documento enviado via DocumentSender:', result);
      } else {
        // Fallback para tipos desconhecidos
        result = await whatsappService.sendMedia(clientId, mediaMessage.to, mediaMessage.file, mediaMessage.caption);
        console.log('✅ [MEDIA-HOOK] Mídia enviada via fallback:', result);
      }

      // Verificar sucesso baseado no padrão dos senders
      const isSuccess = result && (result.success === true || result === true);
      
      if (isSuccess) {
        // Salvar mensagem no banco
        if (ticketId) {
          console.log('💾 [MEDIA-HOOK] Salvando mensagem no ticket:', ticketId);
          
          await manualMessageSaver.saveMediaMessage({
            ticketId,
            messageId,
            content: mediaMessage.caption || `📎 ${mediaMessage.type}`,
            messageType: mediaMessage.type,
            mediaFile: mediaMessage.file,
            uploadResponse: result,
            fileName: mediaMessage.file.name,
            mimeType: mediaMessage.file.type,
            caption: mediaMessage.caption,
            clientId
          });
        }

        toast({
          title: "Mídia enviada",
          description: `${mediaMessage.type} enviado com sucesso`,
        });
        
        return { success: true, ...result };
      } else {
        const errorMessage = result?.error || 'Falha ao enviar mídia';
        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error('❌ [MEDIA-HOOK] Erro ao enviar mídia:', error);
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Falha ao enviar arquivo",
        variant: "destructive"
      });
      return { success: false, error: error.message || 'Falha ao enviar mídia' };
    } finally {
      setIsUploading(false);
    }
  }, [clientId, ticketId, toast]);

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

    const result = await sendMedia({
      type: 'image',
      file,
      caption,
      to
    });
    
    return result.success || false;
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

    const result = await sendMedia({
      type: 'video',
      file,
      caption,
      to
    });
    
    return result.success || false;
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

    const result = await sendMedia({
      type: 'document',
      file,
      caption,
      to
    });
    
    return result.success || false;
  }, [sendMedia, toast]);

  // Processar áudio de arquivo com estratégia avançada
  const handleAudioUpload = useCallback(async (file: File, to: string, caption?: string) => {
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Erro",
        description: "Arquivo deve ser um áudio",
        variant: "destructive"
      });
      return false;
    }

    // Verificar tamanho do arquivo (máximo 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "Áudio muito grande (máximo 25MB)",
        variant: "destructive"
      });
      return false;
    }

    try {
      setIsUploading(true);
      
      // Usar estratégia avançada de envio
      console.log('📤 Enviando áudio via estratégia avançada:', {
        filename: file.name,
        size: file.size,
        type: file.type
      });
      
      const result = await sendMedia({
        type: 'audio',
        file,
        caption,
        to
      });

      return result.success || false;
    } catch (error) {
      console.error('❌ Erro no upload de áudio:', error);
      return false;
    } finally {
      setIsUploading(false);
    }
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

    try {
      setIsUploading(true);
      
      // Manter formato original e duração correta
      const originalType = audioRecording.audioBlob.type || 'audio/webm';
      const extension = originalType.includes('webm') ? 'webm' : 'wav';
      const filename = `recording_${Date.now()}.${extension}`;
      
      console.log('📤 Enviando gravação de áudio:', {
        filename,
        size: audioRecording.audioBlob.size,
        type: originalType,
        duration: audioRecording.duration
      });

      const audioFile = new File([audioRecording.audioBlob], filename, { 
        type: originalType 
      });
      
      const result = await sendMedia({
        type: 'audio',
        file: audioFile,
        to
      });

      if (result.success) {
        setAudioRecording({
          isRecording: false,
          audioBlob: null,
          duration: 0
        });
        
        toast({
          title: "Áudio enviado",
          description: `Gravação de ${audioRecording.duration}s enviada com sucesso`,
        });
      }

      return result.success || false;
    } catch (error) {
      console.error('❌ Erro ao enviar gravação:', error);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [audioRecording, sendMedia, toast]);

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
    handleAudioUpload,
    startRecording,
    stopRecording,
    sendAudioRecording,
    clearSelectedMedia
  };
};
