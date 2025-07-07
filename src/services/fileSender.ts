
import { getServerConfig } from '@/config/environment';

export interface FileSendResult {
  success: boolean;
  messageId?: string;
  format?: string;
  error?: string;
  details?: any;
  message?: string;
}

export interface FileData {
  blob: Blob;
  fileName: string;
  mimeType: string;
  caption?: string;
}

export class FileSender {
  /**
   * Envia arquivo de qualquer tipo para o WhatsApp
   */
  static async sendFile(
    fileData: FileData,
    chatId: string,
    connectedInstance: string,
    fileType: 'audio' | 'image' | 'video' | 'document'
  ): Promise<FileSendResult> {
    console.log(`📁 ===== ENVIANDO ${fileType.toUpperCase()} =====`);
    console.log('📊 Dados do arquivo:', {
      fileName: fileData.fileName,
      mimeType: fileData.mimeType,
      size: fileData.blob.size,
      hasCaption: !!fileData.caption
    });

    try {
      // Converter para base64
      const base64Data = await this.blobToBase64(fileData.blob);
      
      // Preparar dados para o servidor
      const requestData = {
        to: chatId,
        [`${fileType}Data`]: base64Data,
        fileName: fileData.fileName,
        mimeType: fileData.mimeType,
        caption: fileData.caption || ''
      };

      // Usar configuração HTTPS correta
      const config = getServerConfig();
      const serverUrl = config.HTTPS_SERVER_URL || config.serverUrl;
      
      console.log(`🔗 Enviando ${fileType} via HTTPS:`, serverUrl);

      // Enviar para o endpoint específico
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s para arquivos maiores

      const response = await fetch(`${serverUrl}/api/clients/${connectedInstance}/send-${fileType}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro HTTP ao enviar ${fileType}:`, response.status, errorText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        };
      }

      const result = await response.json();
      
      console.log(`📥 Resposta do servidor para ${fileType}:`, result);
      
      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          format: result.details?.format || fileType,
          details: result.details,
          message: result.message || `${fileType} enviado com sucesso`
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro desconhecido do servidor',
          details: result.details
        };
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          error: `Timeout no envio de ${fileType}`
        };
      }
      
      console.error(`💥 Erro ao enviar ${fileType}:`, error);
      return { 
        success: false, 
        error: `Erro de rede: ${error.message}`
      };
    }
  }

  /**
   * Converte Blob para base64
   */
  private static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remover prefix "data:...;base64," se existir
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Envia imagem
   */
  static async sendImage(
    imageBlob: Blob,
    fileName: string,
    chatId: string,
    connectedInstance: string,
    caption?: string
  ): Promise<FileSendResult> {
    const fileData = {
      blob: imageBlob,
      fileName,
      mimeType: imageBlob.type || 'image/jpeg',
      caption
    };
    
    return this.sendFile(fileData, chatId, connectedInstance, 'image');
  }

  /**
   * Envia vídeo
   */
  static async sendVideo(
    videoBlob: Blob,
    fileName: string,
    chatId: string,
    connectedInstance: string,
    caption?: string
  ): Promise<FileSendResult> {
    const fileData = {
      blob: videoBlob,
      fileName,
      mimeType: videoBlob.type || 'video/mp4',
      caption
    };
    
    return this.sendFile(fileData, chatId, connectedInstance, 'video');
  }

  /**
   * Envia documento
   */
  static async sendDocument(
    documentBlob: Blob,
    fileName: string,
    chatId: string,
    connectedInstance: string,
    caption?: string
  ): Promise<FileSendResult> {
    const fileData = {
      blob: documentBlob,
      fileName,
      mimeType: documentBlob.type || 'application/octet-stream',
      caption
    };
    
    return this.sendFile(fileData, chatId, connectedInstance, 'document');
  }

  /**
   * Obter estatísticas de arquivos suportados
   */
  static async getFileStats(connectedInstance: string): Promise<any> {
    try {
      const config = getServerConfig();
      const serverUrl = config.HTTPS_SERVER_URL || config.serverUrl;
      
      const response = await fetch(`${serverUrl}/api/clients/${connectedInstance}/file-stats`);
      
      if (response.ok) {
        return await response.json();
      } else {
        console.warn('⚠️ Não foi possível obter estatísticas de arquivos');
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }
}
