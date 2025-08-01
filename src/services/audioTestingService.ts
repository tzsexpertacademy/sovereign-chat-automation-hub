/**
 * Serviço de teste para verificar se o sistema completo de áudio está funcionando
 */

import { supabase } from '@/integrations/supabase/client';
import { whatsappAudioService } from './whatsappAudioService';

export const audioTestingService = {
  /**
   * Testa toda a pipeline de áudio do WhatsApp
   */
  async testCompleteAudioPipeline(messageId: string): Promise<{
    success: boolean;
    steps: Array<{
      step: string;
      success: boolean;
      duration: number;
      error?: string;
      data?: any;
    }>;
    summary: string;
  }> {
    const startTime = Date.now();
    const steps: any[] = [];
    
    console.log('🧪 [AUDIO-TEST] Iniciando teste completo da pipeline de áudio');
    console.log('📋 MessageId:', messageId);
    
    try {
      // ETAPA 1: Buscar mensagem na base de dados
      const step1Start = Date.now();
      const { data: message, error: messageError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('message_id', messageId)
        .single();
      
      steps.push({
        step: '1. Buscar mensagem no banco',
        success: !messageError && !!message,
        duration: Date.now() - step1Start,
        error: messageError?.message,
        data: message ? {
          hasMediaUrl: !!message.media_url,
          hasMediaKey: !!message.media_key,
          hasFileEncSha256: !!message.file_enc_sha256,
          messageType: message.message_type,
          mediaDuration: message.media_duration
        } : null
      });
      
      if (messageError || !message) {
        throw new Error(`Mensagem não encontrada: ${messageError?.message}`);
      }
      
      // ETAPA 2: Verificar se é áudio com dados de criptografia
      const step2Start = Date.now();
      const isEncryptedAudio = message.message_type === 'audio' && 
                               message.media_url?.includes('.enc') &&
                               message.media_key &&
                               message.file_enc_sha256;
      
      steps.push({
        step: '2. Verificar dados de criptografia',
        success: isEncryptedAudio,
        duration: Date.now() - step2Start,
        data: {
          isAudio: message.message_type === 'audio',
          isEncrypted: message.media_url?.includes('.enc'),
          hasKeys: !!(message.media_key && message.file_enc_sha256),
          url: message.media_url?.substring(0, 100) + '...'
        }
      });
      
      if (!isEncryptedAudio) {
        steps.push({
          step: '3. Descriptografia (pulada - não necessária)',
          success: true,
          duration: 0,
          data: { reason: 'Áudio não criptografado ou dados insuficientes' }
        });
      } else {
        // ETAPA 3: Testar descriptografia
        const step3Start = Date.now();
        try {
          const audioData = {
            mediaUrl: message.media_url,
            mediaKey: message.media_key,
            messageId: message.message_id,
            fileEncSha256: message.file_enc_sha256
          };
          
          const decryptResult = await whatsappAudioService.decryptAudio(audioData);
          
          steps.push({
            step: '3. Descriptografar áudio',
            success: !!decryptResult?.decryptedData,
            duration: Date.now() - step3Start,
            error: !decryptResult?.decryptedData ? 'Descriptografia falhou' : undefined,
            data: {
              format: decryptResult?.format,
              cached: decryptResult?.cached,
              hasDecryptedData: !!decryptResult?.decryptedData,
              dataLength: decryptResult?.decryptedData?.length
            }
          });
          
          if (!decryptResult?.decryptedData) {
            throw new Error('Descriptografia falhou');
          }
        } catch (decryptError) {
          steps.push({
            step: '3. Descriptografar áudio',
            success: false,
            duration: Date.now() - step3Start,
            error: decryptError.message
          });
          throw decryptError;
        }
      }
      
      // ETAPA 4: Testar transcrição (se disponível)
      const step4Start = Date.now();
      const { data: ticketMessage, error: ticketError } = await supabase
        .from('ticket_messages')
        .select('media_transcription, processing_status')
        .eq('message_id', messageId)
        .single();
      
      steps.push({
        step: '4. Verificar transcrição',
        success: !ticketError,
        duration: Date.now() - step4Start,
        error: ticketError?.message,
        data: {
          hasTranscription: !!ticketMessage?.media_transcription,
          transcriptionLength: ticketMessage?.media_transcription?.length,
          processingStatus: ticketMessage?.processing_status,
          transcriptionPreview: ticketMessage?.media_transcription?.substring(0, 100)
        }
      });
      
      // ETAPA 5: Testar criação de data URL para reprodução
      const step5Start = Date.now();
      try {
        let testDataUrl = '';
        
        if (isEncryptedAudio) {
          const audioData = {
            mediaUrl: message.media_url,
            mediaKey: message.media_key,
            messageId: message.message_id,
            fileEncSha256: message.file_enc_sha256
          };
          
          const decryptResult = await whatsappAudioService.decryptAudio(audioData);
          
          if (decryptResult?.decryptedData) {
            testDataUrl = `data:audio/${decryptResult.format || 'ogg'};base64,${decryptResult.decryptedData}`;
          }
        } else if (message.media_url) {
          testDataUrl = message.media_url;
        }
        
        steps.push({
          step: '5. Criar data URL para reprodução',
          success: !!testDataUrl,
          duration: Date.now() - step5Start,
          data: {
            hasDataUrl: !!testDataUrl,
            urlLength: testDataUrl.length,
            urlType: testDataUrl.startsWith('data:') ? 'base64' : 'external',
            mimeType: testDataUrl.split(';')[0]?.split(':')[1]
          }
        });
        
      } catch (urlError) {
        steps.push({
          step: '5. Criar data URL para reprodução',
          success: false,
          duration: Date.now() - step5Start,
          error: urlError.message
        });
      }
      
      // RESUMO
      const totalDuration = Date.now() - startTime;
      const successfulSteps = steps.filter(s => s.success).length;
      const totalSteps = steps.length;
      
      const summary = `✅ Pipeline completa: ${successfulSteps}/${totalSteps} etapas bem-sucedidas em ${totalDuration}ms`;
      
      console.log('🎉 [AUDIO-TEST] Teste concluído:', summary);
      console.log('📊 [AUDIO-TEST] Detalhes:', steps);
      
      return {
        success: successfulSteps === totalSteps,
        steps,
        summary
      };
      
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const summary = `❌ Pipeline falhou: ${error.message} (${totalDuration}ms)`;
      
      console.error('💥 [AUDIO-TEST] Erro crítico:', error);
      
      return {
        success: false,
        steps,
        summary
      };
    }
  },

  /**
   * Testa apenas a descriptografia de um áudio específico
   */
  async testDecryptionOnly(messageId: string): Promise<{
    success: boolean;
    decryptedAudio?: string;
    format?: string;
    cached?: boolean;
    error?: string;
    duration: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Buscar dados da mensagem
      const { data: message, error } = await supabase
        .from('whatsapp_messages')
        .select('media_url, media_key, file_enc_sha256, message_id')
        .eq('message_id', messageId)
        .single();
      
      if (error || !message) {
        throw new Error(`Mensagem não encontrada: ${error?.message}`);
      }
      
      if (!message.media_url?.includes('.enc') || !message.media_key || !message.file_enc_sha256) {
        throw new Error('Mensagem não é um áudio criptografado válido');
      }
      
      // Testar descriptografia
      const audioData = {
        mediaUrl: message.media_url,
        mediaKey: message.media_key,
        messageId: message.message_id,
        fileEncSha256: message.file_enc_sha256
      };
      
      const result = await whatsappAudioService.decryptAudio(audioData);
      
      return {
        success: !!result?.decryptedData,
        decryptedAudio: result?.decryptedData,
        format: result?.format,
        cached: result?.cached,
        error: !result?.decryptedData ? 'Descriptografia falhou' : undefined,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
};