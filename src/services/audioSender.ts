
import { SERVER_URL } from '@/config/environment';
import { AudioConverter } from '@/utils/audioConverter';

export interface AudioSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class AudioSender {
  static async sendWithIntelligentRetry(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== ENVIO DE ÁUDIO VIA JSON+BASE64 =====');
    console.log('🔧 Sistema atualizado: endpoints JSON compatíveis');
    console.log('🎯 Endpoint: /api/clients/:id/send-audio');
    
    // Converter para formato otimizado (OGG por padrão)
    let processedBlob: Blob;
    try {
      processedBlob = await AudioConverter.convertToOGG(audioBlob);
    } catch (error) {
      console.warn('⚠️ Falha na conversão, usando áudio original:', error);
      processedBlob = audioBlob;
    }

    try {
      console.log('📤 Enviando via novo endpoint JSON...');
      
      const result = await this.sendToServerWithJson(
        processedBlob,
        chatId,
        connectedInstance,
        messageId
      );
      
      if (result.success) {
        console.log(`✅ Sucesso no envio de áudio:`, result);
        return result;
      } else {
        console.error('❌ Falha no envio:', result);
        return result;
      }
      
    } catch (error: any) {
      console.error('💥 Erro crítico no envio:', error);
      return { 
        success: false, 
        error: `Erro crítico: ${error.message}`,
        attempts: 0
      };
    }
  }

  private static async sendToServerWithJson(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    try {
      // Converter para base64
      const base64Audio = await AudioConverter.blobToBase64(audioBlob);
      
      // Preparar dados JSON para o servidor
      const requestData = {
        to: chatId,
        audioData: base64Audio,
        fileName: `audio_${messageId}.ogg`,
        mimeType: 'audio/ogg'
      };

      console.log('📊 Dados JSON preparados:', {
        to: chatId,
        audioSize: audioBlob.size,
        base64Length: base64Audio.length,
        fileName: requestData.fileName,
        endpoint: `/api/clients/${connectedInstance}/send-audio`
      });

      // Enviar com timeout otimizado
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/send-audio`, {
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
        console.error('❌ Resposta HTTP não OK:', response.status, errorText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        };
      }

      const result = await response.json();
      
      console.log('📥 Resposta do servidor:', result);
      
      if (result.success) {
        return {
          success: true,
          format: result.details?.format || 'JSON+base64',
          attempts: 1,
          isFallback: false,
          message: result.message || 'Áudio enviado com sucesso via JSON'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro desconhecido do servidor',
          attempts: 1
        };
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Timeout no envio de áudio',
          attempts: 1
        };
      }
      
      console.error('💥 Erro na requisição JSON:', error);
      return { 
        success: false, 
        error: `Erro de rede: ${error.message}`,
        attempts: 0
      };
    }
  }

  // Método para obter estatísticas do servidor
  static async getAudioStats(connectedInstance: string): Promise<any> {
    try {
      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/audio-stats`);
      
      if (response.ok) {
        return await response.json();
      } else {
        console.warn('⚠️ Não foi possível obter estatísticas de áudio');
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }
}
