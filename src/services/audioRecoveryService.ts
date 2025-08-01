/**
 * 🎵 SERVIÇO DE RECUPERAÇÃO DE ÁUDIOS
 * Processa mensagens de áudio que ficaram com audio_base64 null
 * e tenta recuperá-las via download direto
 */

import { supabase } from '@/integrations/supabase/client';
import { directMediaDownloadService } from './directMediaDownloadService';
import { AudioConverter } from '@/utils/audioConverter';

interface AudioRecoveryResult {
  processed: number;
  recovered: number;
  failed: string[];
}

export class AudioRecoveryService {
  /**
   * Recupera áudios manuais que ficaram sem base64
   */
  static async recoverMissingAudioData(clientId: string, limit: number = 10): Promise<AudioRecoveryResult> {
    console.log('🔄 Iniciando recuperação de áudios sem base64...');
    
    const result: AudioRecoveryResult = {
      processed: 0,
      recovered: 0,
      failed: []
    };

    try {
      // Buscar mensagens de áudio com audio_base64 null
      const { data: audioMessages, error } = await supabase
        .from('ticket_messages')
        .select(`
          id,
          message_id,
          ticket_id,
          media_url,
          media_key,
          file_enc_sha256,
          processing_status
        `)
        .eq('message_type', 'audio')
        .is('audio_base64', null)
        .in('processing_status', ['completed', 'processing'])
        .limit(limit);

      if (error) {
        console.error('❌ Erro ao buscar áudios para recuperação:', error);
        return result;
      }

      console.log(`🔍 Encontrados ${audioMessages?.length || 0} áudios para recuperação`);

      if (!audioMessages || audioMessages.length === 0) {
        return result;
      }

      // Processar cada áudio
      for (const message of audioMessages) {
        result.processed++;
        
        try {
          console.log(`🎵 Processando áudio: ${message.message_id}`);
          
          // Tentar recuperar via download direto
          const audioBase64 = await this.downloadAndConvertAudio(message);
          
          if (audioBase64) {
            // Salvar no banco
            const { error: updateError } = await supabase
              .from('ticket_messages')
              .update({
                audio_base64: audioBase64,
                processing_status: 'completed'
              })
              .eq('id', message.id);

            if (updateError) {
              console.error(`❌ Erro ao salvar áudio recuperado: ${message.message_id}`, updateError);
              result.failed.push(message.message_id);
            } else {
              console.log(`✅ Áudio recuperado: ${message.message_id}`);
              result.recovered++;
            }
          } else {
            console.warn(`⚠️ Não foi possível recuperar: ${message.message_id}`);
            result.failed.push(message.message_id);
          }
          
        } catch (error) {
          console.error(`❌ Erro ao processar ${message.message_id}:`, error);
          result.failed.push(message.message_id);
        }
      }

      console.log('📊 Recuperação concluída:', result);
      return result;

    } catch (error) {
      console.error('❌ Erro na recuperação de áudios:', error);
      return result;
    }
  }

  /**
   * Tenta baixar e converter um áudio para base64
   */
  private static async downloadAndConvertAudio(message: any): Promise<string | null> {
    try {
      // Se não há URL para download, não pode recuperar
      if (!message.media_url) {
        console.warn(`⚠️ Sem media_url para: ${message.message_id}`);
        return null;
      }

      console.log(`🔄 Baixando áudio: ${message.media_url}`);

      // Tentar download direto
      const downloadResult = await directMediaDownloadService.downloadMedia(
        message.media_url,
        message.media_key,
        message.file_enc_sha256
      );

      if (downloadResult.success && downloadResult.mediaUrl) {
        console.log(`✅ Áudio baixado via URL: ${downloadResult.mediaUrl}`);
        
        // Baixar o blob da URL retornada
        const response = await fetch(downloadResult.mediaUrl);
        if (response.ok) {
          const audioBlob = await response.blob();
          console.log(`✅ Blob obtido: ${audioBlob.size} bytes`);
          
          // Converter para base64
          const base64Audio = await AudioConverter.blobToBase64(audioBlob);
          console.log(`✅ Convertido para base64: ${base64Audio.length} chars`);
          
          return base64Audio;
        } else {
          console.warn(`⚠️ Falha ao baixar blob: ${response.status}`);
        }
      }

      console.warn(`⚠️ Falha no download: ${message.message_id}`);
      return null;

    } catch (error) {
      console.error(`❌ Erro no download/conversão:`, error);
      return null;
    }
  }

  /**
   * Verifica status geral dos áudios do cliente
   */
  static async getAudioStatus(clientId: string): Promise<{
    total: number;
    withBase64: number;
    withoutBase64: number;
    needRecovery: number;
  }> {
    try {
      // Buscar estatísticas via JOIN com tickets
      const { data, error } = await supabase
        .from('ticket_messages')
        .select(`
          id,
          audio_base64,
          processing_status,
          conversation_tickets!inner(client_id)
        `)
        .eq('message_type', 'audio')
        .eq('conversation_tickets.client_id', clientId);

      if (error) {
        console.error('❌ Erro ao buscar status dos áudios:', error);
        return { total: 0, withBase64: 0, withoutBase64: 0, needRecovery: 0 };
      }

      const total = data?.length || 0;
      const withBase64 = data?.filter(m => m.audio_base64).length || 0;
      const withoutBase64 = total - withBase64;
      const needRecovery = data?.filter(m => 
        !m.audio_base64 && m.processing_status === 'completed'
      ).length || 0;

      return {
        total,
        withBase64,
        withoutBase64,
        needRecovery
      };

    } catch (error) {
      console.error('❌ Erro ao calcular status dos áudios:', error);
      return { total: 0, withBase64: 0, withoutBase64: 0, needRecovery: 0 };
    }
  }
}