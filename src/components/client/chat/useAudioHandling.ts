
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { AudioSender } from '@/services/audioSender';
import { AudioConverter } from '@/utils/audioConverter';
import { audioFallbackService } from '@/services/audioFallbackService';
import { connectionManager } from '@/services/connectionManager';

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

    // Verificar conexão antes de tentar enviar
    const connectionStatus = connectionManager.getStatus();
    if (!connectionStatus.isConnected) {
      toast({
        title: "Problema de Conexão",
        description: "Servidor não está respondendo. Tentando reconectar...",
        variant: "destructive"
      });
      await connectionManager.forceReconnect();
      return;
    }

    const messageId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('🎵 ===== PROCESSAMENTO DE ÁUDIO COM FALLBACK INTELIGENTE =====');
      console.log('🔧 Sistema: Correção definitiva implementada');
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
        content: `🎵 Processando áudio (${duration}s)...`,
        message_type: 'audio',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'processing',
        timestamp: new Date().toISOString()
      });

      // Toast de início
      toast({
        title: "Processando áudio 🎵",
        description: `Sistema com fallback inteligente (${duration}s)`,
      });

      // Função para envio de áudio
      const sendAudioFunction = async (blob: Blob) => {
        return await AudioSender.sendWithIntelligentRetry(
          blob,
          ticket.chat_id,
          connectedInstance,
          messageId
        );
      };

      // Usar sistema de fallback
      const result = await audioFallbackService.processAudioWithFallback(
        audioBlob,
        duration,
        sendAudioFunction,
        ticket.chat_id,
        messageId
      );

      if (result.success) {
        let finalContent = '';
        let audioBase64 = '';

        if (result.method === 'audio') {
          // Áudio enviado com sucesso
          finalContent = `🎵 ${result.message}`;
          try {
            audioBase64 = await AudioConverter.blobToBase64(audioBlob);
          } catch (error) {
            console.warn('⚠️ Erro ao converter áudio para base64:', error);
          }
        } else if (result.method === 'text') {
          // Convertido para texto
          finalContent = result.textContent || `📝 Áudio convertido para texto (${duration}s)`;
        }

        // Atualizar mensagem no banco
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'completed',
            content: finalContent,
            audio_base64: audioBase64 || null,
            message_type: result.method === 'text' ? 'text' : 'audio'
          })
          .eq('message_id', messageId);

        // Toast de sucesso
        const successTitle = result.method === 'audio' ? "Áudio Enviado! 🎉" : "Áudio Convertido! 📝";
        toast({
          title: successTitle,
          description: result.message,
        });

      } else {
        // Falha completa
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'failed',
            content: `❌ Falha no processamento de áudio (${duration}s)`
          })
          .eq('message_id', messageId);

        toast({
          title: "Falha no Processamento",
          description: result.error || "Erro desconhecido",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('💥 Erro crítico no processamento:', error);
      
      // Marcar mensagem como falha
      try {
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'failed',
            content: `❌ Erro crítico no processamento (${duration}s)`
          })
          .eq('message_id', messageId);
      } catch (dbError) {
        console.error('❌ Erro ao atualizar status no banco:', dbError);
      }

      toast({
        title: "Erro Crítico",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  return { handleAudioReady };
};
