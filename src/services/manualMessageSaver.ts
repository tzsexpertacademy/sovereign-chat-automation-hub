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
}

class ManualMessageSaver {
  async saveManualMessage(data: ManualMessageData): Promise<boolean> {
    try {
      console.log('💾 Salvando mensagem manual:', data);

      // Salvar no banco via service
      const result = await ticketsService.addTicketMessage({
        ticket_id: data.ticketId,
        message_id: data.messageId,
        from_me: true,
        sender_name: 'Atendente',
        content: data.content,
        message_type: data.messageType,
        media_url: data.mediaUrl,
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

      // Extrair dados da resposta do upload se disponível
      let mediaUrl = data.mediaUrl;
      let mediaKey = data.mediaKey;
      let fileEncSha256 = data.fileEncSha256;

      if (data.uploadResponse && data.uploadResponse.media) {
        mediaUrl = data.uploadResponse.media.url || mediaUrl;
        mediaKey = data.uploadResponse.media.mediaKey || mediaKey;
        fileEncSha256 = data.uploadResponse.media.fileEncSha256 || fileEncSha256;
      }

      return await this.saveManualMessage({
        ...data,
        mediaUrl,
        mediaKey,
        fileEncSha256,
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