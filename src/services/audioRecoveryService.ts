import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço para reprocessar áudios que ficaram com status incorreto
 */
export const audioRecoveryService = {
  /**
   * Buscar áudios que ficaram com status "processed" mas sem transcrição
   */
  async findOrphanedAudios(clientId: string): Promise<any[]> {
    console.log('🔍 [AUDIO-RECOVERY] Buscando áudios órfãos para cliente:', clientId);
    
    try {
      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);
      
      if (!instances?.length) {
        console.log('⚠️ [AUDIO-RECOVERY] Nenhuma instância encontrada');
        return [];
      }

      // Buscar tickets das instâncias do cliente
      const instanceIds = instances.map(i => i.instance_id);
      
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .in('instance_id', instanceIds);
      
      if (!tickets?.length) {
        console.log('⚠️ [AUDIO-RECOVERY] Nenhum ticket encontrado');
        return [];
      }

      const ticketIds = tickets.map(t => t.id);

      // Buscar mensagens de áudio com status "processed" mas sem transcrição
      const { data: orphanedAudios, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .in('ticket_id', ticketIds)
        .in('message_type', ['audio', 'ptt'])
        .eq('processing_status', 'processed')
        .or('media_transcription.is.null,media_transcription.eq.')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ [AUDIO-RECOVERY] Erro ao buscar áudios órfãos:', error);
        return [];
      }

      console.log(`📊 [AUDIO-RECOVERY] Encontrados ${orphanedAudios?.length || 0} áudios órfãos`);
      
      return orphanedAudios || [];
    } catch (error) {
      console.error('❌ [AUDIO-RECOVERY] Erro na busca:', error);
      return [];
    }
  },

  /**
   * Reprocessar áudios órfãos marcando como "received" para serem processados
   */
  async reprocessOrphanedAudios(clientId: string): Promise<{ updated: number; errors: number }> {
    console.log('🔄 [AUDIO-RECOVERY] Iniciando reprocessamento de áudios órfãos...');
    
    let updated = 0;
    let errors = 0;

    try {
      const orphanedAudios = await this.findOrphanedAudios(clientId);
      
      if (orphanedAudios.length === 0) {
        console.log('✅ [AUDIO-RECOVERY] Nenhum áudio órfão encontrado');
        return { updated: 0, errors: 0 };
      }

      console.log(`🔄 [AUDIO-RECOVERY] Reprocessando ${orphanedAudios.length} áudios órfãos...`);

      for (const audio of orphanedAudios) {
        try {
          console.log(`🔧 [AUDIO-RECOVERY] Marcando áudio para reprocessamento: ${audio.message_id}`);
          
          const { error } = await supabase
            .from('ticket_messages')
            .update({
              processing_status: 'received',
              media_transcription: null,
              content: audio.content?.replace(/\[Erro.*?\]/, '🎵 Áudio') || '🎵 Áudio'
            })
            .eq('id', audio.id);

          if (error) {
            console.error(`❌ [AUDIO-RECOVERY] Erro ao atualizar ${audio.message_id}:`, error);
            errors++;
          } else {
            console.log(`✅ [AUDIO-RECOVERY] Áudio marcado para reprocessamento: ${audio.message_id}`);
            updated++;
          }
        } catch (error) {
          console.error(`❌ [AUDIO-RECOVERY] Erro ao processar áudio ${audio.message_id}:`, error);
          errors++;
        }
      }

      console.log(`✅ [AUDIO-RECOVERY] Reprocessamento concluído: ${updated} atualizados, ${errors} erros`);
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ [AUDIO-RECOVERY] Erro no reprocessamento:', error);
      return { updated, errors: 1 };
    }
  },

  /**
   * Marcar um áudio específico para reprocessamento
   */
  async reprocessSingleAudio(messageId: string): Promise<boolean> {
    console.log(`🔧 [AUDIO-RECOVERY] Reprocessando áudio específico: ${messageId}`);
    
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .update({
          processing_status: 'received',
          media_transcription: null
        })
        .eq('message_id', messageId)
        .in('message_type', ['audio', 'ptt']);

      if (error) {
        console.error(`❌ [AUDIO-RECOVERY] Erro ao reprocessar ${messageId}:`, error);
        return false;
      }

      console.log(`✅ [AUDIO-RECOVERY] Áudio marcado para reprocessamento: ${messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ [AUDIO-RECOVERY] Erro ao reprocessar ${messageId}:`, error);
      return false;
    }
  }
};

// Expor função global para testes
(globalThis as any).audioRecovery = audioRecoveryService;