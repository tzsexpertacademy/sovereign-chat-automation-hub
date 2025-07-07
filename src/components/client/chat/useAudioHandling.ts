
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { AudioSender } from '@/services/audioSender';
import { AudioConverter } from '@/utils/audioConverter';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

  const handleAudioReady = async (
    audioBlob: Blob,
    duration: number,
    ticket: any,
    connectedInstance: string,
    simulateMessageProgression: (id: string, isAudio: boolean) => void,
    markActivity: () => void
  ) => {
    if (!ticket || !connectedInstance) {
      toast({
        title: "Erro",
        description: "Nenhuma instância WhatsApp conectada",
        variant: "destructive"
      });
      return;
    }

    const messageId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('🎵 ===== SISTEMA DE ÁUDIO V3.0 (JSON+BASE64) =====');
      console.log('🔧 Correção: Endpoints JSON implementados no servidor');
      console.log('📊 Dados do áudio:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration,
        sizeInKB: Math.round(audioBlob.size / 1024)
      });

      // Iniciar indicadores visuais
      simulateMessageProgression(messageId, true);
      markActivity();

      // Registrar mensagem como processando
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: messageId,
        from_me: true,
        sender_name: 'Atendente',
        content: `🎵 Enviando áudio (${duration}s)...`,
        message_type: 'audio',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'processing',
        timestamp: new Date().toISOString()
      });

      // Toast de início
      toast({
        title: "Enviando áudio 🎵",
        description: `Sistema JSON+base64 (${duration}s)`,
      });

      // Usar sistema corrigido de envio
      const result = await AudioSender.sendWithIntelligentRetry(
        audioBlob,
        ticket.chat_id,
        connectedInstance,
        messageId
      );

      if (result.success) {
        // Salvar base64 para histórico
        try {
          const base64Audio = await AudioConverter.blobToBase64(audioBlob);
          await supabase
            .from('ticket_messages')
            .update({ 
              processing_status: 'completed',
              content: `🎵 ${result.message} (${duration}s)`,
              audio_base64: base64Audio
            })
            .eq('message_id', messageId);
        } catch (dbError) {
          console.warn('⚠️ Erro ao salvar no banco:', dbError);
        }

        // Toast de sucesso
        toast({
          title: "Sucesso! 🎉",
          description: `Áudio enviado via JSON+base64 (${duration}s)`,
        });

      } else {
        // Marcar como falha
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'failed',
            content: `❌ Falha no envio de áudio (${duration}s): ${result.error}`
          })
          .eq('message_id', messageId);

        // Toast de erro
        toast({
          title: "Falha no Envio",
          description: result.error || "Erro desconhecido",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('💥 Erro crítico no processamento de áudio:', error);
      
      // Marcar mensagem como falha
      try {
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'failed',
            content: `❌ Erro no processamento de áudio (${duration}s)`
          })
          .eq('message_id', messageId);
      } catch (dbError) {
        console.error('❌ Erro ao atualizar status no banco:', dbError);
      }

      toast({
        title: "Erro no Processamento",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  return { handleAudioReady };
};
