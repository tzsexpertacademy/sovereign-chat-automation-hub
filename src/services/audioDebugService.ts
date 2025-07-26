/**
 * Serviço de debug para sistema de áudio WhatsApp
 * Fornece ferramentas de diagnóstico e teste
 */

import { supabase } from '@/integrations/supabase/client';
import { WhatsAppAudioDecryption } from './whatsappAudioDecryption';

interface AudioDebugResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

interface AudioPipelineTest {
  messageId: string;
  results: AudioDebugResult[];
  totalDuration: number;
  success: boolean;
}

export class AudioDebugService {
  /**
   * Testa toda a pipeline de áudio para uma mensagem específica
   */
  static async testAudioPipeline(messageId: string): Promise<AudioPipelineTest> {
    const results: AudioDebugResult[] = [];
    const startTime = Date.now();
    
    console.log('🔍 [DEBUG] Iniciando teste da pipeline de áudio:', messageId);

    // ETAPA 1: Buscar dados da mensagem
    const step1Start = Date.now();
    try {
      const { data: message, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('message_id', messageId)
        .single();

      if (error) throw error;

      results.push({
        step: 'fetch_message',
        success: true,
        data: {
          hasMediaUrl: !!message.media_url,
          hasMediaKey: !!message.media_key,
          hasFileEncSha256: !!message.file_enc_sha256,
          messageType: message.message_type,
          mediaMimeType: message.media_mime_type
        },
        duration: Date.now() - step1Start
      });

      // ETAPA 2: Verificar se é áudio criptografado
      if (message.message_type === 'audio' && message.media_url?.includes('.enc')) {
        const step2Start = Date.now();
        
        try {
          console.log('🔐 [DEBUG] Testando descriptografia...');
          
          const decryptResult = await WhatsAppAudioDecryption.decryptAudio(
            message.media_url,
            message.media_key,
            messageId,
            message.file_enc_sha256
          );

          results.push({
            step: 'decrypt_audio',
            success: decryptResult.success,
            data: {
              format: decryptResult.format,
              cached: decryptResult.cached,
              audioLength: decryptResult.decryptedAudio?.length
            },
            error: decryptResult.error,
            duration: Date.now() - step2Start
          });

          // ETAPA 3: Verificar transcrição
          if (decryptResult.success) {
            const step3Start = Date.now();
            
            try {
              const { data: transcript } = await supabase
                .from('ticket_messages')
                .select('media_transcription')
                .eq('message_id', messageId)
                .single();

              results.push({
                step: 'check_transcription',
                success: true,
                data: {
                  hasTranscription: !!transcript?.media_transcription,
                  transcription: transcript?.media_transcription
                },
                duration: Date.now() - step3Start
              });

            } catch (error) {
              results.push({
                step: 'check_transcription',
                success: false,
                error: error.message,
                duration: Date.now() - step3Start
              });
            }

            // ETAPA 4: Testar criação de data URL
            const step4Start = Date.now();
            
            try {
              const dataUrl = WhatsAppAudioDecryption.createAudioDataUrl(
                decryptResult.decryptedAudio!,
                decryptResult.format
              );

              results.push({
                step: 'create_data_url',
                success: true,
                data: {
                  dataUrlLength: dataUrl.length,
                  mimeType: dataUrl.split(';')[0].replace('data:', '')
                },
                duration: Date.now() - step4Start
              });

            } catch (error) {
              results.push({
                step: 'create_data_url',
                success: false,
                error: error.message,
                duration: Date.now() - step4Start
              });
            }
          }

        } catch (error) {
          results.push({
            step: 'decrypt_audio',
            success: false,
            error: error.message,
            duration: Date.now() - step2Start
          });
        }
      } else {
        results.push({
          step: 'decrypt_audio',
          success: false,
          error: 'Não é um áudio criptografado do WhatsApp',
          duration: 0
        });
      }

    } catch (error) {
      results.push({
        step: 'fetch_message',
        success: false,
        error: error.message,
        duration: Date.now() - step1Start
      });
    }

    const totalDuration = Date.now() - startTime;
    const success = results.every(r => r.success);

    console.log('📊 [DEBUG] Teste concluído:', {
      success,
      totalDuration,
      steps: results.length
    });

    return {
      messageId,
      results,
      totalDuration,
      success
    };
  }

  /**
   * Testa apenas a descriptografia de um áudio
   */
  static async testDecryptionOnly(messageId: string): Promise<AudioDebugResult> {
    const startTime = Date.now();
    
    try {
      // Buscar dados necessários
      const { data: message, error } = await supabase
        .from('whatsapp_messages')
        .select('media_url, media_key, file_enc_sha256')
        .eq('message_id', messageId)
        .single();

      if (error) throw error;

      if (!message.media_url || !message.media_key) {
        throw new Error('Dados de criptografia incompletos');
      }

      // Testar descriptografia
      const result = await WhatsAppAudioDecryption.decryptAudio(
        message.media_url,
        message.media_key,
        messageId,
        message.file_enc_sha256
      );

      return {
        step: 'decrypt_test',
        success: result.success,
        data: {
          format: result.format,
          cached: result.cached,
          audioLength: result.decryptedAudio?.length,
          hasAudio: !!result.decryptedAudio
        },
        error: result.error,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        step: 'decrypt_test',
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Limpa o cache de áudio descriptografado
   */
  static async clearAudioCache(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('decrypted_audio_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      return !error;
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao limpar cache:', error);
      return false;
    }
  }

  /**
   * Verifica estatísticas do cache de áudio
   */
  static async getCacheStats(): Promise<{
    totalCached: number;
    expiredCount: number;
    validCount: number;
  }> {
    try {
      const { data: total } = await supabase
        .from('decrypted_audio_cache')
        .select('id', { count: 'exact' });

      const { data: expired } = await supabase
        .from('decrypted_audio_cache')
        .select('id', { count: 'exact' })
        .lt('expires_at', new Date().toISOString());

      return {
        totalCached: total?.length || 0,
        expiredCount: expired?.length || 0,
        validCount: (total?.length || 0) - (expired?.length || 0)
      };
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao obter stats do cache:', error);
      return { totalCached: 0, expiredCount: 0, validCount: 0 };
    }
  }
}

// Instância singleton
export const audioDebugService = new AudioDebugService();