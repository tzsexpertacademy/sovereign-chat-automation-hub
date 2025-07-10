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
        isConnected: statusResponse?.status === 'connected',
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
  
  // Enviar áudio com estratégias múltiplas e diagnóstico avançado
  static async sendAudioWithAdvancedStrategy(
    clientId: string,
    to: string,
    audioBlob: Blob,
    duration: number,
    originalFilename?: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== ENVIANDO ÁUDIO COM ESTRATÉGIA AVANÇADA =====');
    console.log('📊 Parâmetros de entrada:', {
      clientId,
      to,
      audioSize: audioBlob.size,
      audioType: audioBlob.type,
      duration,
      originalFilename
    });

    try {
      // FASE 1: Diagnóstico do cliente
      console.log('🔍 FASE 1: Diagnosticando cliente WhatsApp...');
      const diagnosis = await this.diagnoseWhatsAppClient(clientId);
      
      console.log('📋 Resultado do diagnóstico:', diagnosis);
      
      if (!diagnosis.isConnected) {
        return {
          success: false,
          error: 'Cliente WhatsApp não conectado',
          duration,
          size: audioBlob.size
        };
      }

      // FASE 2: Estratégias de envio múltiplas
      const strategies = [
        {
          name: 'Original',
          audioBlob: audioBlob,
          filename: originalFilename || `audio_${Date.now()}.${this.getExtensionFromMimeType(audioBlob.type)}`
        },
        {
          name: 'Otimizado OGG',
          audioBlob: await AudioConverter.convertToOGG(audioBlob),
          filename: `audio_optimized_${Date.now()}.ogg`
        },
        {
          name: 'WAV Compatível',
          audioBlob: await AudioConverter.convertToWAV(audioBlob),
          filename: `audio_wav_${Date.now()}.wav`
        }
      ];

      const attemptedFormats: string[] = [];
      let lastError = '';

      // FASE 3: Tentar cada estratégia
      for (const strategy of strategies) {
        try {
          console.log(`🚀 TENTANDO: ${strategy.name}`);
          console.log('📊 Dados da estratégia:', {
            name: strategy.name,
            size: strategy.audioBlob.size,
            type: strategy.audioBlob.type,
            filename: strategy.filename
          });

          attemptedFormats.push(strategy.audioBlob.type);

          // Converter para File
          const audioFile = new File([strategy.audioBlob], strategy.filename, {
            type: strategy.audioBlob.type
          });

          // Tentar enviar
          const result = await whatsappService.sendMedia(clientId, to, audioFile);
          
          if (result.success) {
            console.log(`✅ SUCESSO com estratégia: ${strategy.name}`);
            return {
              success: true,
              format: strategy.audioBlob.type,
              size: strategy.audioBlob.size,
              duration,
              attemptedFormats
            };
          } else {
            console.warn(`⚠️ Falhou estratégia ${strategy.name}:`, result.error);
            lastError = result.error || 'Erro desconhecido';
          }

        } catch (error) {
          console.error(`❌ Erro na estratégia ${strategy.name}:`, error);
          lastError = error.message;
        }

        // Aguardar entre tentativas
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // FASE 4: Todas as estratégias falharam
      console.error('❌ TODAS as estratégias falharam');
      return {
        success: false,
        error: `Falha em todas as estratégias. Último erro: ${lastError}`,
        duration,
        size: audioBlob.size,
        attemptedFormats
      };

    } catch (error) {
      console.error('❌ ERRO CRÍTICO no envio de áudio:', error);
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