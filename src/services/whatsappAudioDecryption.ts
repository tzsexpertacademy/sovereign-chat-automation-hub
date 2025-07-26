/**
 * Serviço para descriptografia de áudios do WhatsApp
 * Implementa AES-GCM com HKDF para derivação de chaves
 */

import { supabase } from '@/integrations/supabase/client';

interface DecryptionResult {
  success: boolean;
  decryptedAudio?: string;
  format?: string;
  error?: string;
  cached?: boolean;
}

export class WhatsAppAudioDecryption {
  /**
   * Descriptografa áudio do WhatsApp usando metadados
   */
  static async decryptAudio(
    encryptedUrl: string,
    mediaKey: string,
    messageId?: string,
    fileEncSha256?: string
  ): Promise<DecryptionResult> {
    try {
      console.log('🔐 [DECRYPT-SERVICE] Iniciando descriptografia...', {
        hasUrl: !!encryptedUrl,
        hasMediaKey: !!mediaKey,
        hasMessageId: !!messageId
      });

      // Baixar dados criptografados
      const response = await fetch(encryptedUrl);
      if (!response.ok) {
        throw new Error(`Erro no download: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const encryptedBase64 = btoa(
        new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Chamar função Supabase para descriptografia
      console.log('🔐 [DECRYPT-SERVICE] Chamando edge function whatsapp-decrypt-audio...');
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-audio', {
        body: {
          encryptedData: encryptedBase64,
          mediaKey: mediaKey,
          messageId: messageId,
          fileEncSha256: fileEncSha256
        }
      });
      
      console.log('📡 [DECRYPT-SERVICE] Resposta da edge function:', {
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message
      });

      if (error) {
        console.error('❌ [DECRYPT-SERVICE] Erro na function:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('❌ [DECRYPT-SERVICE] Descriptografia falhou:', data?.error);
        return { success: false, error: data?.error || 'Descriptografia falhou' };
      }

      console.log('✅ [DECRYPT-SERVICE] Descriptografia bem-sucedida!', {
        format: data.format,
        cached: data.cached
      });

      return {
        success: true,
        decryptedAudio: data.decryptedAudio,
        format: data.format,
        cached: data.cached
      };

    } catch (error) {
      console.error('❌ [DECRYPT-SERVICE] Erro crítico:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica se um áudio está no cache
   */
  static async checkCache(messageId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('decrypted_audio_cache')
        .select('decrypted_data')
        .eq('message_id', messageId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.decrypted_data;
    } catch (error) {
      console.error('❌ [CACHE-CHECK] Erro:', error);
      return null;
    }
  }

  /**
   * Detecta formato de áudio por header
   */
  static detectAudioFormat(base64Data: string): string {
    try {
      if (!base64Data || base64Data.length < 20) {
        return 'auto';
      }

      const sampleChunk = base64Data.substring(0, 32);
      const decoded = atob(sampleChunk);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

      // OGG: 4F 67 67 53 (OggS)
      if (bytes.length >= 4 && 
          bytes[0] === 0x4F && bytes[1] === 0x67 && 
          bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'ogg';
      }

      // WAV: 52 49 46 46 (RIFF)
      if (bytes.length >= 4 && 
          bytes[0] === 0x52 && bytes[1] === 0x49 && 
          bytes[2] === 0x46 && bytes[3] === 0x46) {
        return 'wav';
      }

      // MP3: FF Fx
      if (bytes.length >= 2 && 
          bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
        return 'mp3';
      }

      return 'ogg'; // WhatsApp padrão
    } catch (error) {
      console.warn('⚠️ [FORMAT-DETECT] Erro:', error);
      return 'auto';
    }
  }

  /**
   * Cria data URL otimizada para reprodução
   */
  static createAudioDataUrl(base64Audio: string, format?: string): string {
    const detectedFormat = format || this.detectAudioFormat(base64Audio);
    
    const mimeTypes = {
      'ogg': 'audio/ogg; codecs=opus',
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'webm': 'audio/webm; codecs=opus'
    };

    const mimeType = mimeTypes[detectedFormat] || 'audio/ogg; codecs=opus';
    return `data:${mimeType};base64,${base64Audio}`;
  }
}