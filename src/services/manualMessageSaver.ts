import { ticketsService } from './ticketsService';
import { supabase } from '@/integrations/supabase/client';

export interface ManualMessageData {
  ticketId: string;
  messageId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  clientId: string;
  // 🎵 MÍDIA: Campos para funcionamento instantâneo de todas as mídias
  audioBase64?: string;
  imageBase64?: string;
  videoBase64?: string;
  documentBase64?: string;
  mediaDuration?: number;
}

class ManualMessageSaver {
  async saveManualMessage(data: ManualMessageData): Promise<boolean> {
    try {
      console.log('💾 Salvando mensagem manual:', data);

      // 🔥 CORREÇÃO CRÍTICA: Salvar TODOS os metadados de mídia
      const result = await ticketsService.addTicketMessage({
        ticket_id: data.ticketId,
        message_id: data.messageId,
        from_me: true,
        sender_name: 'Atendente',
        content: data.content,
        message_type: data.messageType,
        // 🔥 METADADOS DE MÍDIA COMPLETOS
        media_url: data.mediaUrl,
        media_key: data.mediaKey ? this.ensureBase64String(data.mediaKey) : null,
        file_enc_sha256: data.fileEncSha256 ? this.ensureBase64String(data.fileEncSha256) : null,
        media_mime_type: data.mimeType,
        media_duration: data.mediaDuration,
        // 🎵 MÍDIA BASE64: Para funcionamento instantâneo de todas as mídias
        audio_base64: data.audioBase64,
        // 🔥 PROPRIEDADES ADICIONAIS PARA CONTROLE
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'completed',
        timestamp: new Date().toISOString()
      });

      if (result && result.id) {
        console.log('✅ Mensagem manual salva com sucesso');
        
        // Forçar reload do realtime para sincronizar
        await this.triggerRealtimeRefresh(data.ticketId);
        
        return true;
      } else {
        console.error('❌ Falha ao salvar mensagem manual');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro crítico ao salvar mensagem manual:', error);
      return false;
    }
  }

  private async triggerRealtimeRefresh(ticketId: string): Promise<void> {
    try {
      // Trigger manual para forçar refresh do realtime
      const { error } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('ticket_id', ticketId)
        .limit(1);
        
      if (error) {
        console.warn('⚠️ Erro ao trigger realtime refresh:', error);
      }
    } catch (e) {
      console.warn('⚠️ Falha ao trigger realtime:', e);
    }
  }

  // 🔥 HELPER: Garantir que dados sejam Base64 strings
  private ensureBase64String(data: any): string | null {
    if (!data) return null;
    
    // Se já é string, retorna como está
    if (typeof data === 'string') return data;
    
    // Se é objeto/array (dados malformados), converter para Base64
    try {
      if (typeof data === 'object') {
        // Assumir que é um array de bytes ou Uint8Array serializado
        const bytes = Array.isArray(data) ? data : Object.values(data);
        const uint8Array = new Uint8Array(bytes);
        return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
      }
    } catch (error) {
      console.warn('⚠️ Erro ao converter dados para Base64:', error);
    }
    
    return null;
  }

  // 🎬 HELPER: Verificar se já tem base64 para a mídia
  private hasMediaBase64(data: ManualMessageData): boolean {
    switch (data.messageType) {
      case 'audio': return !!data.audioBase64;
      case 'image': return !!data.imageBase64;
      case 'video': return !!data.videoBase64;
      case 'document': return !!data.documentBase64;
      default: return false;
    }
  }

  // 🎬 HELPER: Converter File para Base64
  private async convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo data:mime/type;base64, se existir
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async saveMediaMessage(data: ManualMessageData & { 
    mediaFile: File;
    uploadResponse: any; 
  }): Promise<boolean> {
    try {
      console.log('💾 Salvando mensagem de mídia manual:', {
        messageId: data.messageId,
        type: data.messageType,
        fileName: data.fileName,
        hasUploadResponse: !!data.uploadResponse
      });

      // 🔥 CORREÇÃO: Extrair TODOS os dados da resposta do upload
      let mediaUrl = data.mediaUrl;
      let mediaKey = data.mediaKey;
      let fileEncSha256 = data.fileEncSha256;
      let mediaDuration = data.mediaDuration;

      if (data.uploadResponse) {
        // ✅ Suporte a estruturas diferentes de resposta
        const mediaData = data.uploadResponse.media || data.uploadResponse;
        mediaUrl = mediaData.url || mediaUrl;
        mediaKey = mediaData.mediaKey || mediaKey;
        fileEncSha256 = mediaData.fileEncSha256 || fileEncSha256;
        mediaDuration = mediaData.duration || mediaDuration;
        
        console.log('🔍 Dados extraídos do upload:', {
          hasUrl: !!mediaUrl,
          hasKey: !!mediaKey,
          hasHash: !!fileEncSha256,
          duration: mediaDuration,
          keyType: typeof mediaKey
        });
      }

      // 🎵 CORREÇÃO PARA TODAS AS MÍDIAS: Converter File para Base64
      let audioBase64 = data.audioBase64;
      let imageBase64 = data.imageBase64;
      let videoBase64 = data.videoBase64;
      let documentBase64 = data.documentBase64;

      if (data.mediaFile && !this.hasMediaBase64(data)) {
        try {
          console.log(`🎬 Convertendo ${data.messageType} manual para base64...`);
          const base64Data = await this.convertFileToBase64(data.mediaFile);
          
          switch (data.messageType) {
            case 'audio':
              audioBase64 = base64Data;
              console.log('✅ Áudio convertido:', { size: base64Data.length });
              break;
            case 'image':
              imageBase64 = base64Data;
              console.log('✅ Imagem convertida:', { size: base64Data.length });
              break;
            case 'video':
              videoBase64 = base64Data;
              console.log('✅ Vídeo convertido:', { size: base64Data.length });
              break;
            case 'document':
              documentBase64 = base64Data;
              console.log('✅ Documento convertido:', { size: base64Data.length });
              break;
          }
        } catch (conversionError) {
          console.warn(`⚠️ Erro ao converter ${data.messageType}:`, conversionError);
        }
      }

      return await this.saveManualMessage({
        ...data,
        mediaUrl,
        mediaKey,
        fileEncSha256,
        mediaDuration,
        audioBase64,
        imageBase64,
        videoBase64,
        documentBase64,
        content: data.caption || `📎 ${data.messageType}`,
        fileName: data.fileName || data.mediaFile.name,
        mimeType: data.mimeType || data.mediaFile.type
      });
    } catch (error) {
      console.error('❌ Erro ao salvar mensagem de mídia:', error);
      return false;
    }
  }
}

export const manualMessageSaver = new ManualMessageSaver();