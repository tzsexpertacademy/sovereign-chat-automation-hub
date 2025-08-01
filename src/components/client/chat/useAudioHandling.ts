
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
      console.log('🎵 ===== PROCESSANDO ÁUDIO (YUMER API V2) =====');
      console.log('🔧 Sistema corrigido: usando API oficial Yumer v2.2.1');
      console.log('📊 Dados do áudio:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration,
        sizeInKB: Math.round(audioBlob.size / 1024),
        chatId: ticket.chat_id,
        instanceId: connectedInstance
      });

      // Iniciar indicadores visuais
      markActivity();

      // CORREÇÃO: Processar áudio com metadados de duração para WhatsApp
      console.log('🔧 Processando áudio com metadados de duração...');
      const optimizedAudioBlob = await AudioConverter.convertToOGGWithDuration(audioBlob, duration);
      
      console.log('✅ Áudio otimizado:', {
        originalSize: audioBlob.size,
        optimizedSize: optimizedAudioBlob.size,
        originalType: audioBlob.type,
        optimizedType: optimizedAudioBlob.type,
        duration: duration
      });

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
        description: `Via Yumer API v2.2.1 (${duration}s)`,
      });

      // Usar sistema corrigido com Yumer API v2 COM DURAÇÃO E METADADOS
      const result = await AudioSender.sendWithIntelligentRetry(
        optimizedAudioBlob, // CORREÇÃO: Usar áudio com metadados
        ticket.chat_id,
        connectedInstance,
        messageId,
        duration // CORREÇÃO: Passar duração do áudio gravado
      );

      if (result.success) {
        // 🔥 CORREÇÃO CRÍTICA: Salvar o áudio OTIMIZADO (que foi enviado)
        // para garantir que funcione perfeitamente na reprodução
        try {
          console.log('💾 Salvando áudio otimizado no banco para reprodução instantânea...');
          const base64Audio = await AudioConverter.blobToBase64(optimizedAudioBlob);
          
          const updateResult = await supabase
            .from('ticket_messages')
            .update({ 
              processing_status: 'completed',
              content: `🎵 ${result.message} (${duration}s)`,
              audio_base64: base64Audio,
              media_duration: Math.round(duration),
              // Para áudios enviados do frontend, salvamos apenas o base64
              // pois não precisam de descriptografia
              media_url: null, // URLs diretas serão tratadas como fallback
              media_key: null, // Não há criptografia para áudios do frontend
              file_enc_sha256: null
            })
            .eq('message_id', messageId);
            
          console.log('✅ Áudio CRM salvo no banco:', {
            messageId,
            base64Size: base64Audio.length,
            duration: Math.round(duration),
            status: 'completed',
            updateSuccess: updateResult.error === null,
            updateError: updateResult.error?.message
          });

          // ⚡ OTIMIZAÇÃO: Forçar refresh instantâneo do componente
          console.log('⚡ Áudio CRM pronto para reprodução instantânea');
        } catch (dbError) {
          console.warn('⚠️ Erro ao salvar no banco:', dbError);
        }

        // Toast de sucesso detalhado
        const successMessage = result.isFallback 
          ? `Áudio convertido para texto (${duration}s)`
          : `Áudio enviado via ${result.format} (${duration}s)`;

        toast({
          title: "Sucesso! 🎉",
          description: successMessage,
        });

        // Log de sucesso detalhado
        console.log('📊 Áudio enviado com sucesso via Yumer API v2:', {
          format: result.format,
          attempts: result.attempts,
          messageId,
          duration
        });

      } else {
        // Marcar como falha
        await supabase
          .from('ticket_messages')
          .update({ 
            processing_status: 'failed',
            content: `❌ Falha no envio de áudio (${duration}s)`
          })
          .eq('message_id', messageId);

        // Toast de erro com detalhes
        const errorMessage = result.attempts && result.attempts > 0
          ? `Falha após ${result.attempts} tentativas: ${result.error}`
          : result.error || "Erro desconhecido";

        toast({
          title: "Falha no Envio",
          description: errorMessage,
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
