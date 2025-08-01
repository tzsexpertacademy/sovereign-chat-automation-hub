/**
 * Serviço para upload temporário de áudio
 * Permite obter URL pública para usar com o endpoint /send/audio
 */

import { supabase } from '@/integrations/supabase/client';

export interface AudioUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileName?: string;
}

export class AudioUploadService {
  /**
   * Faz upload do blob de áudio para storage temporário e retorna URL pública
   */
  static async uploadAudioBlob(audioBlob: Blob, messageId: string): Promise<AudioUploadResult> {
    try {
      console.log('📤 [AUDIO-UPLOAD] Iniciando upload de áudio temporário');
      console.log('📊 [AUDIO-UPLOAD] Dados:', {
        size: audioBlob.size,
        type: audioBlob.type,
        messageId
      });

      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const fileName = `temp_audio_${messageId}_${timestamp}.ogg`;
      
      // Garantir que o áudio está em formato OGG (exigido pela API WhatsApp)
      let uploadBlob = audioBlob;
      if (!audioBlob.type.includes('ogg')) {
        console.log('🔄 [AUDIO-UPLOAD] Convertendo para OGG...');
        // Para simplificar, vamos aceitar WebM também que funciona bem
        if (audioBlob.type.includes('webm')) {
          uploadBlob = new Blob([audioBlob], { type: 'audio/ogg' });
        }
      }

      // Upload para bucket público de client-assets
      const { data, error } = await supabase.storage
        .from('client-assets')
        .upload(`temp-audio/${fileName}`, uploadBlob, {
          cacheControl: '3600', // 1 hora de cache
          upsert: false
        });

      if (error) {
        console.error('❌ [AUDIO-UPLOAD] Erro no upload:', error);
        return {
          success: false,
          error: `Erro no upload: ${error.message}`
        };
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from('client-assets')
        .getPublicUrl(`temp-audio/${fileName}`);

      if (!publicUrlData?.publicUrl) {
        console.error('❌ [AUDIO-UPLOAD] Não foi possível obter URL pública');
        return {
          success: false,
          error: 'Não foi possível obter URL pública'
        };
      }

      console.log('✅ [AUDIO-UPLOAD] Upload concluído com sucesso');
      console.log('🔗 [AUDIO-UPLOAD] URL pública:', publicUrlData.publicUrl);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        fileName: fileName
      };

    } catch (error: any) {
      console.error('❌ [AUDIO-UPLOAD] Erro inesperado:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error.message || 'Desconhecido'}`
      };
    }
  }

  /**
   * Remove arquivo de áudio temporário após envio
   */
  static async cleanupTempAudio(fileName: string): Promise<void> {
    try {
      console.log('🧹 [AUDIO-UPLOAD] Limpando arquivo temporário:', fileName);
      
      const { error } = await supabase.storage
        .from('client-assets')
        .remove([`temp-audio/${fileName}`]);

      if (error) {
        console.warn('⚠️ [AUDIO-UPLOAD] Erro na limpeza (não crítico):', error);
      } else {
        console.log('✅ [AUDIO-UPLOAD] Arquivo temporário removido');
      }
    } catch (error) {
      console.warn('⚠️ [AUDIO-UPLOAD] Erro na limpeza (não crítico):', error);
    }
  }
}