
import { SERVER_URL } from '@/config/environment';
import { AudioConverter } from '@/utils/audioConverter';

export interface AudioSendResult {
  success: boolean;
  format?: string;
  error?: string;
}

export class AudioSender {
  private static readonly FORMATS = [
    { mimeType: 'audio/ogg', extension: 'ogg', description: 'OGG' },
    { mimeType: 'audio/wav', extension: 'wav', description: 'WAV' },
    { mimeType: 'audio/mpeg', extension: 'mp3', description: 'MP3' }
  ];

  static async sendWithFallback(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== INICIANDO ENVIO DE ÁUDIO COM FALLBACK =====');
    
    // Primeiro, tentar converter para WAV (mais compatível)
    let processedBlob: Blob;
    try {
      processedBlob = await AudioConverter.convertToWAV(audioBlob);
    } catch (error) {
      console.warn('⚠️ Falha na conversão, usando áudio original:', error);
      processedBlob = audioBlob;
    }

    // Tentar cada formato
    for (const format of this.FORMATS) {
      try {
        console.log(`🔄 Tentando envio: ${format.description}`);
        
        const result = await this.sendSingleFormat(
          processedBlob,
          chatId,
          connectedInstance,
          messageId,
          format
        );
        
        if (result.success) {
          console.log(`✅ Sucesso com formato: ${format.description}`);
          return { success: true, format: format.description };
        }
        
        console.warn(`⚠️ Falha com ${format.description}:`, result.error);
      } catch (error) {
        console.error(`❌ Erro crítico com ${format.description}:`, error);
      }
    }

    return { success: false, error: 'Todos os formatos falharam' };
  }

  private static async sendSingleFormat(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string,
    format: { mimeType: string; extension: string; description: string }
  ): Promise<AudioSendResult> {
    try {
      // Converter para base64
      const base64Audio = await AudioConverter.blobToBase64(audioBlob);
      
      // Preparar dados
      const requestData = {
        to: chatId,
        audioData: base64Audio,
        fileName: `audio_${messageId}.${format.extension}`,
        mimeType: format.mimeType
      };

      // Enviar com timeout específico
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/send-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const result = await response.json();
      
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Resposta negativa da API' };
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Timeout' };
      }
      return { success: false, error: error.message };
    }
  }
}
