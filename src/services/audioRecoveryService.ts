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
   * Verificar status de processamento de áudios
   */
  async getAudioProcessingStats(clientId: string): Promise<any> {
    console.log('📊 [AUDIO-RECOVERY] Verificando estatísticas de processamento...');
    
    try {
      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);
      
      if (!instances?.length) {
        return { error: 'Nenhuma instância encontrada' };
      }

      const instanceIds = instances.map(i => i.instance_id);
      
      // Buscar tickets das instâncias
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .in('instance_id', instanceIds);
      
      if (!tickets?.length) {
        return { error: 'Nenhum ticket encontrado' };
      }

      const ticketIds = tickets.map(t => t.id);

      // Estatísticas por status
      const { data: statusStats } = await supabase
        .from('ticket_messages')
        .select('processing_status')
        .in('ticket_id', ticketIds)
        .in('message_type', ['audio', 'ptt']);

      const stats = statusStats?.reduce((acc: any, msg: any) => {
        acc[msg.processing_status || 'unknown'] = (acc[msg.processing_status || 'unknown'] || 0) + 1;
        return acc;
      }, {}) || {};

      console.log('📊 [AUDIO-RECOVERY] Estatísticas:', stats);
      return { stats, instanceIds, ticketCount: tickets.length };
    } catch (error) {
      console.error('❌ [AUDIO-RECOVERY] Erro ao buscar estatísticas:', error);
      return { error: error.message };
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
  },

  /**
   * Forçar reprocessamento de todos os áudios recentes
   */
  async forceReprocessAllRecent(clientId: string, hoursBack: number = 24): Promise<{ updated: number; errors: number }> {
    console.log(`🔄 [AUDIO-RECOVERY] Forçando reprocessamento de áudios das últimas ${hoursBack}h...`);
    
    let updated = 0;
    let errors = 0;

    try {
      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);
      
      if (!instances?.length) {
        console.log('⚠️ [AUDIO-RECOVERY] Nenhuma instância encontrada');
        return { updated: 0, errors: 1 };
      }

      const instanceIds = instances.map(i => i.instance_id);
      
      // Buscar tickets das instâncias
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .in('instance_id', instanceIds);
      
      if (!tickets?.length) {
        console.log('⚠️ [AUDIO-RECOVERY] Nenhum ticket encontrado');
        return { updated: 0, errors: 1 };
      }

      const ticketIds = tickets.map(t => t.id);
      
      // Data limite
      const timeLimit = new Date();
      timeLimit.setHours(timeLimit.getHours() - hoursBack);

      // Buscar todos os áudios recentes
      const { data: recentAudios, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .in('ticket_id', ticketIds)
        .in('message_type', ['audio', 'ptt'])
        .gte('timestamp', timeLimit.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('❌ [AUDIO-RECOVERY] Erro ao buscar áudios recentes:', error);
        return { updated: 0, errors: 1 };
      }

      console.log(`🔄 [AUDIO-RECOVERY] Encontrados ${recentAudios?.length || 0} áudios recentes`);

      if (!recentAudios || recentAudios.length === 0) {
        return { updated: 0, errors: 0 };
      }

      // Reprocessar todos
      for (const audio of recentAudios) {
        try {
          console.log(`🔧 [AUDIO-RECOVERY] Forçando reprocessamento: ${audio.message_id}`);
          
          const { error: updateError } = await supabase
            .from('ticket_messages')
            .update({
              processing_status: 'received',
              media_transcription: null,
              content: '🎵 Áudio'
            })
            .eq('id', audio.id);

          if (updateError) {
            console.error(`❌ [AUDIO-RECOVERY] Erro ao forçar reprocessamento ${audio.message_id}:`, updateError);
            errors++;
          } else {
            console.log(`✅ [AUDIO-RECOVERY] Forçado reprocessamento: ${audio.message_id}`);
            updated++;
          }
        } catch (error) {
          console.error(`❌ [AUDIO-RECOVERY] Erro ao processar áudio ${audio.message_id}:`, error);
          errors++;
        }
      }

      console.log(`✅ [AUDIO-RECOVERY] Reprocessamento forçado concluído: ${updated} atualizados, ${errors} erros`);
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ [AUDIO-RECOVERY] Erro no reprocessamento forçado:', error);
      return { updated, errors: 1 };
    }
  }
};

// Expor função global para testes
(globalThis as any).audioRecovery = audioRecoveryService;