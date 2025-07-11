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
  
  // ✅ CORREÇÃO DEFINITIVA: Envio de áudio sem MessageMedia
  static async sendAudioWithAdvancedStrategy(
    clientId: string,
    to: string,
    audioBlob: Blob,
    duration: number,
    originalFilename?: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== CORREÇÃO DEFINITIVA - ENVIO DE ÁUDIO =====');
    console.log('🔧 Sistema: whatsapp-web.js v1.25.0+ sem "Evaluation failed"');
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

      // FASE 2: Preparar áudio para envio direto (sem MessageMedia)
      const filename = originalFilename || `audio_${Date.now()}.ogg`;
      
      // Converter para base64 diretamente do blob (mais confiável)
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remover prefixo data:audio/xxx;base64,
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('📦 Base64 preparado:', {
        hasData: !!base64Audio,
        dataLength: base64Audio.length,
        firstChars: base64Audio.substring(0, 30),
        isValid: /^[A-Za-z0-9+/]*={0,2}$/.test(base64Audio)
      });

      // FASE 3: Tentar estratégias de envio sem MessageMedia
      const strategies = [
        {
          name: 'Áudio Direto OGG',
          mimeType: 'audio/ogg',
          method: 'audio'
        },
        {
          name: 'Documento Áudio',
          mimeType: 'audio/ogg',
          method: 'document'
        },
        {
          name: 'Mídia Genérica',
          mimeType: 'application/octet-stream',
          method: 'media'
        }
      ];

      const attemptedFormats: string[] = [];
      let lastError = '';

      for (const strategy of strategies) {
        try {
          console.log(`🚀 TENTANDO: ${strategy.name}`);
          attemptedFormats.push(strategy.mimeType);

          // ✅ CORREÇÃO: Usar fetch direto para envio sem MessageMedia
          const formData = new FormData();
          
          // Criar blob específico para cada estratégia
          const audioBlob = new Blob([Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))], { 
            type: strategy.mimeType 
          });
          
          formData.append('file', audioBlob, filename);
          formData.append('to', to);
          formData.append('method', strategy.method);

          // Envio direto via API REST (evita whatsapp-web.js issues)
          const response = await fetch(`/api/clients/${clientId}/send-audio-direct`, {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              console.log(`✅ SUCESSO com estratégia: ${strategy.name}`);
              return {
                success: true,
                format: strategy.mimeType,
                size: audioBlob.size,
                duration,
                attemptedFormats
              };
            } else {
              lastError = result.error || 'Falha no envio';
              console.warn(`⚠️ Falhou ${strategy.name}:`, lastError);
            }
          } else {
            // Fallback para método original se API REST não existir
            console.log(`🔄 Fallback para whatsappService.sendMedia`);
            
            const audioFile = new File([audioBlob], filename, {
              type: strategy.mimeType
            });

            const result = await whatsappService.sendMedia(clientId, to, audioFile);
            
            if (result.success) {
              console.log(`✅ SUCESSO com fallback: ${strategy.name}`);
              return {
                success: true,
                format: strategy.mimeType,
                size: audioBlob.size,
                duration,
                attemptedFormats
              };
            } else {
              lastError = result.error || 'Falha no fallback';
              console.warn(`⚠️ Falhou fallback ${strategy.name}:`, lastError);
            }
          }

        } catch (error) {
          console.error(`❌ Erro na estratégia ${strategy.name}:`, error);
          lastError = error.message;
        }

        // Aguardar entre tentativas
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // FASE 4: Se todas falharam, retornar erro real (não fallback)
      console.error('❌ TODAS as estratégias de áudio falharam');
      return {
        success: false,
        error: `Falha no envio de áudio: ${lastError}`,
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