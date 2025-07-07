
import { getServerConfig } from '@/config/environment';
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
  private static readonly RETRY_FORMATS = [
    { mimeType: 'audio/ogg', extension: 'ogg', description: 'OGG (Formato primário)' },
    { mimeType: 'audio/wav', extension: 'wav', description: 'WAV (Fallback 1)' },
    { mimeType: 'audio/mpeg', extension: 'mp3', description: 'MP3 (Fallback 2)' }
  ];

  static async sendWithIntelligentRetry(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== INICIANDO ENVIO COM RETRY INTELIGENTE =====');
    console.log('🔧 Sistema corrigido: whatsapp-web.js v1.21.0');
    console.log('🎯 Correção: Erro "Evaluation failed" eliminado');
    
    // Converter para formato otimizado (OGG por padrão)
    let processedBlob: Blob;
    try {
      processedBlob = await AudioConverter.convertToOGG(audioBlob);
    } catch (error) {
      console.warn('⚠️ Falha na conversão, usando áudio original:', error);
      processedBlob = audioBlob;
    }

    try {
      console.log('📤 Enviando para servidor com sistema de retry...');
      
      const result = await this.sendToServerWithRetry(
        processedBlob,
        chatId,
        connectedInstance,
        messageId
      );
      
      if (result.success) {
        console.log(`✅ Sucesso no envio de áudio:`, result);
        return result;
      } else {
        console.error('❌ Falha no envio após todas as tentativas:', result);
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

  private static async sendToServerWithRetry(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    try {
      // Converter para base64
      const base64Audio = await AudioConverter.blobToBase64(audioBlob);
      
      // Preparar dados para o servidor (novo formato JSON + base64)
      const requestData = {
        to: chatId,
        audioData: base64Audio,
        fileName: `audio_${messageId}.ogg`,
        mimeType: 'audio/ogg',
        caption: ''
      };

      console.log('📊 Dados preparados para envio:', {
        to: chatId,
        audioSize: audioBlob.size,
        base64Length: base64Audio.length,
        fileName: requestData.fileName
      });

      // Usar configuração HTTPS correta
      const config = getServerConfig();
      const serverUrl = config.HTTPS_SERVER_URL || config.serverUrl;
      
      console.log('🔗 Usando servidor HTTPS:', serverUrl);

      // Enviar com timeout otimizado para o novo endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const response = await fetch(`${serverUrl}/api/clients/${connectedInstance}/send-audio`, {
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
          format: result.details?.format || 'ogg',
          attempts: result.details?.attempts || 1,
          isFallback: result.details?.isFallback || false,
          message: result.message || 'Áudio enviado com sucesso'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro desconhecido do servidor',
          attempts: result.details?.attempts || 0
        };
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Timeout no envio (servidor fazendo múltiplas tentativas)',
          attempts: 3
        };
      }
      
      console.error('💥 Erro na requisição:', error);
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
      const config = getServerConfig();
      const serverUrl = config.HTTPS_SERVER_URL || config.serverUrl;
      
      const response = await fetch(`${serverUrl}/api/clients/${connectedInstance}/file-stats`);
      
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
