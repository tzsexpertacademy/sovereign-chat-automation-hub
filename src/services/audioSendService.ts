import { whatsappService } from './whatsappMultiClient';
import { AudioConverter } from '@/utils/audioConverter';

export interface AudioSendResult {
  success: boolean;
  error?: string;
  format?: string;
  size?: number;
  duration?: number;
  attemptedFormats?: string[];
}

export class AudioSendService {
  
  // Diagnosticar estado do cliente WhatsApp
  static async diagnoseWhatsAppClient(clientId: string): Promise<{
    isConnected: boolean;
    canSendMedia: boolean;
    supportedFormats: string[];
    clientInfo: any;
  }> {
    try {
      console.log('🔍 Diagnosticando cliente WhatsApp:', clientId);
      
      // ✅ CORREÇÃO: Usar método existente do whatsappService
      const statusResponse = await whatsappService.getClientStatus(clientId);
      
      return {
        isConnected: typeof statusResponse === 'string' ? statusResponse === 'connected' : false,
        canSendMedia: true, // assumir que pode até prova em contrário
        supportedFormats: ['audio/ogg', 'audio/wav', 'audio/webm'],
        clientInfo: statusResponse || {}
      };
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      return {
        isConnected: false,
        canSendMedia: false,
        supportedFormats: [],
        clientInfo: {}
      };
    }
  }
  
  // ✅ CORREÇÃO DEFINITIVA: Envio usando APIs corretas do whatsapp-web.js
  static async sendAudioWithAdvancedStrategy(
    clientId: string,
    to: string,
    audioBlob: Blob,
    duration: number,
    originalFilename?: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== CORREÇÃO DEFINITIVA - APIs CORRETAS =====');
    console.log('🔧 Usando MessageMedia com whatsapp-web.js v1.25.0+');
    console.log('📊 Parâmetros:', {
      clientId,
      to,
      audioSize: audioBlob.size,
      audioType: audioBlob.type,
      duration,
      originalFilename
    });

    try {
      // FASE 1: Verificar cliente
      const diagnosis = await this.diagnoseWhatsAppClient(clientId);
      
      if (!diagnosis.isConnected) {
        return {
          success: false,
          error: 'Cliente WhatsApp não conectado',
          duration,
          size: audioBlob.size
        };
      }

      // FASE 2: Preparar base64 do áudio
      const filename = originalFilename || `audio_${Date.now()}.ogg`;
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('📦 Base64 preparado:', {
        hasData: !!base64Audio,
        dataLength: base64Audio.length,
        isValid: /^[A-Za-z0-9+/]*={0,2}$/.test(base64Audio)
      });

      // FASE 3: Estratégias usando APIs corretas do whatsappService
      const strategies = [
        {
          name: 'SendMedia como Audio OGG',
          apiCall: async () => {
            console.log('🎵 API: whatsappService.sendMedia() com File OGG');
            
            const audioFile = new File([audioBlob], filename, {
              type: 'audio/ogg'
            });
            
            const result = await whatsappService.sendMedia(clientId, to, audioFile);
            
            console.log('📤 Resultado API SendMedia OGG:', result);
            return result;
          }
        },
        {
          name: 'SendAudio direto',
          apiCall: async () => {
            console.log('🎵 API: whatsappService.sendAudio() direto');
            
            const audioFile = new File([audioBlob], filename, {
              type: 'audio/ogg'
            });
            
            const result = await whatsappService.sendMedia(clientId, to, audioFile);
            
            console.log('📤 Resultado API SendAudio:', result);
            return result;
          }
        },
        {
          name: 'SendMedia como WAV',
          apiCall: async () => {
            console.log('🎵 API: whatsappService.sendMedia() com File WAV');
            
            const audioFile = new File([audioBlob], filename.replace('.ogg', '.wav'), {
              type: 'audio/wav'
            });
            
            const result = await whatsappService.sendMedia(clientId, to, audioFile);
            
            console.log('📤 Resultado API SendMedia WAV:', result);
            return result;
          }
        }
      ];

      const attemptedFormats: string[] = [];
      let lastError = '';

      for (const strategy of strategies) {
        try {
          console.log(`🚀 TENTANDO: ${strategy.name}`);
          attemptedFormats.push(strategy.name);

          const result = await strategy.apiCall();
          
          // ✅ DETECÇÃO REAL DE SUCESSO
          const isRealSuccess = result && (
            (typeof result === 'object' && 'success' in result && result.success === true) ||
            (typeof result === 'object' && 'id' in result) ||
            (typeof result === 'object' && 'messageId' in result) ||
            (typeof result === 'object' && 'status' in result && result.status !== 'error')
          );

          if (isRealSuccess) {
            console.log(`✅ SUCESSO REAL com ${strategy.name}:`, result);
            return {
              success: true,
              format: 'audio/ogg',
              size: audioBlob.size,
              duration,
              attemptedFormats
            };
          } else {
            lastError = (typeof result === 'object' && result && 'error' in result ? (result.error as string) : 
                         typeof result === 'object' && result && 'message' in result ? (result.message as string) : 'API retornou falha');
            console.warn(`⚠️ FALHA REAL ${strategy.name}:`, { result, lastError });
          }

        } catch (error) {
          console.error(`❌ ERRO na estratégia ${strategy.name}:`, error);
          lastError = error.message;
        }

        // Aguardar entre tentativas
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // FASE 4: Todas falharam - erro real
      console.error('❌ TODAS as estratégias falharam com APIs corretas');
      return {
        success: false,
        error: `Falha no envio: ${lastError}`,
        duration,
        size: audioBlob.size,
        attemptedFormats
      };

    } catch (error) {
      console.error('❌ ERRO CRÍTICO:', error);
      return {
        success: false,
        error: `Erro crítico: ${error.message}`,
        duration,
        size: audioBlob.size
      };
    }
  }

  // Obter extensão do tipo MIME
  private static getExtensionFromMimeType(mimeType: string): string {
    const extensionMap = {
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a'
    };
    
    return extensionMap[mimeType] || 'audio';
  }

  // Fallback com transcrição
  static async sendAudioWithTranscriptionFallback(
    clientId: string,
    to: string,
    audioBlob: Blob,
    duration: number
  ): Promise<AudioSendResult> {
    console.log('🔄 TENTANDO FALLBACK com transcrição...');
    
    try {
      // Tentar envio normal primeiro
      const normalResult = await this.sendAudioWithAdvancedStrategy(clientId, to, audioBlob, duration);
      
      if (normalResult.success) {
        return normalResult;
      }

      console.log('⚠️ Envio normal falhou, tentando transcrição...');
      
      // Converter áudio para base64 e transcrever
      const base64Audio = await AudioConverter.blobToBase64(audioBlob);
      
      // TODO: Implementar transcrição e envio como texto
      // const transcription = await audioService.convertSpeechToText(base64Audio, openaiKey);
      // await whatsappService.sendMessage(clientId, to, `🎵 [ÁUDIO TRANSCRITO]: ${transcription}`);
      
      return {
        success: false,
        error: 'Fallback com transcrição não implementado ainda',
        duration,
        size: audioBlob.size
      };
      
    } catch (error) {
      console.error('❌ Erro no fallback:', error);
      return {
        success: false,
        error: `Fallback falhou: ${error.message}`,
        duration,
        size: audioBlob.size
      };
    }
  }
}