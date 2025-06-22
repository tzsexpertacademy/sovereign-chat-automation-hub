
import { useState, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { fileUploadService } from '@/services/fileUploadService';
import { useToast } from './use-toast';

export const useMessageMedia = (clientId: string) => {
  const [isUploading, setIsUploading] = useState(false);
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

  return {
    isUploading,
    fileInputRef,
    handleFileSelect,
    handleFileChange,
    uploadAndSendFile,
    sendMediaMessage
  };
};
