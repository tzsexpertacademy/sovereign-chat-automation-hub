
import { SERVER_URL } from '@/config/environment';
import { AudioConverter } from '@/utils/audioConverter';

export interface FileSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  message?: string;
}

export class FileSender {
  // Enviar imagem
  static async sendImage(
    imageBlob: Blob,
    chatId: string,
    connectedInstance: string,
    fileName: string,
    caption?: string
  ): Promise<FileSendResult> {
    return this.sendFile(imageBlob, chatId, connectedInstance, fileName, 'image', caption);
  }

  // Enviar vídeo
  static async sendVideo(
    videoBlob: Blob,
    chatId: string,
    connectedInstance: string,
    fileName: string,
    caption?: string
  ): Promise<FileSendResult> {
    return this.sendFile(videoBlob, chatId, connectedInstance, fileName, 'video', caption);
  }

  // Enviar documento
  static async sendDocument(
    documentBlob: Blob,
    chatId: string,
    connectedInstance: string,
    fileName: string
  ): Promise<FileSendResult> {
    return this.sendFile(documentBlob, chatId, connectedInstance, fileName, 'document');
  }

  // Método universal para envio de arquivos
  private static async sendFile(
    fileBlob: Blob,
    chatId: string,
    connectedInstance: string,
    fileName: string,
    fileType: 'image' | 'video' | 'document',
    caption?: string
  ): Promise<FileSendResult> {
    try {
      console.log(`📁 ===== ENVIANDO ${fileType.toUpperCase()} VIA JSON+BASE64 =====`);
      
      // Converter para base64
      const base64File = await AudioConverter.blobToBase64(fileBlob);
      
      // Determinar propriedade de dados baseada no tipo
      const dataProperty = fileType === 'image' ? 'imageData' : 
                          fileType === 'video' ? 'videoData' : 'documentData';
      
      // Preparar dados JSON
      const requestData = {
        to: chatId,
        [dataProperty]: base64File,
        fileName: fileName,
        mimeType: fileBlob.type,
        ...(caption && { caption })
      };

      console.log('📊 Dados preparados:', {
        to: chatId,
        fileSize: fileBlob.size,
        fileName: fileName,
        mimeType: fileBlob.type,
        endpoint: `/api/clients/${connectedInstance}/send-${fileType}`
      });

      // Enviar requisição
      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/send-${fileType}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro HTTP ${fileType}:`, response.status, errorText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        };
      }

      const result = await response.json();
      
      console.log(`📥 Resposta ${fileType}:`, result);
      
      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          message: result.message || `${fileType} enviado com sucesso`
        };
      } else {
        return {
          success: false,
          error: result.error || `Erro ao enviar ${fileType}`
        };
      }

    } catch (error: any) {
      console.error(`💥 Erro crítico no envio de ${fileType}:`, error);
      return { 
        success: false, 
        error: `Erro crítico: ${error.message}`
      };
    }
  }
}
