
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { SERVER_URL } from '@/config/environment';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

  const sendAudioWithFallback = async (audioBlob: Blob, ticket: any, connectedInstance: string, messageId: string) => {
    // Definir formatos em ordem de preferência para WhatsApp
    const formats = [
      { blob: audioBlob, mimeType: audioBlob.type, extension: getExtensionFromMimeType(audioBlob.type), description: 'Original' },
      // Se não for OGG, tentar converter para OGG (mais compatível com WhatsApp)
      { blob: audioBlob, mimeType: 'audio/ogg', extension: 'ogg', description: 'OGG' },
      // Fallback para MP3
      { blob: audioBlob, mimeType: 'audio/mpeg', extension: 'mp3', description: 'MP3' },
    ];

    for (const format of formats) {
      try {
        console.log(`🎵 ===== TENTANDO ENVIO: ${format.description} =====`);
        console.log(`📊 Formato:`, {
          type: format.mimeType,
          size: format.blob.size,
          sizeInKB: Math.round(format.blob.size / 1024)
        });

        // Converter para base64
        const base64Audio = await blobToBase64(format.blob);

        // Preparar dados para envio
        const audioApiUrl = `${SERVER_URL}/api/clients/${connectedInstance}/send-audio`;
        const requestData = {
          to: ticket.chat_id,
          audioData: base64Audio,
          fileName: `audio_${messageId}.${format.extension}`,
          mimeType: format.mimeType
        };

        console.log(`📤 Enviando ${format.description} para WhatsApp...`);
        console.log(`🎯 URL:`, audioApiUrl);
        console.log(`📋 Destinatário:`, ticket.chat_id);
        console.log(`📁 Arquivo:`, requestData.fileName);

        // Enviar com timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error(`⏰ TIMEOUT de 30s para ${format.description}`);
          controller.abort();
        }, 30000);

        const response = await fetch(audioApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`📡 Resposta para ${format.description}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        const responseText = await response.text();
        console.log(`📝 Resposta bruta:`, responseText);

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`❌ Erro ao parsear resposta:`, parseError);
          throw new Error(`Resposta inválida: ${responseText.substring(0, 200)}`);
        }

        if (response.ok && result.success) {
          console.log(`🎉 ===== ${format.description} ENVIADO COM SUCESSO! =====`);
          
          // Salvar base64 no banco
          try {
            await supabase
              .from('ticket_messages')
              .update({ audio_base64: base64Audio })
              .eq('message_id', messageId);
            console.log(`💾 Base64 salvo no banco`);
          } catch (dbError) {
            console.log('⚠️ Não foi possível salvar base64:', dbError);
          }

          return { success: true, format: format.description };
        } else {
          console.error(`❌ ${format.description} falhou:`, result);
          // Continuar para próximo formato se este falhar
          if (formats.indexOf(format) < formats.length - 1) {
            continue;
          }
        }

      } catch (error) {
        console.error(`❌ Erro com ${format.description}:`, error);
        // Continuar para próximo formato se este falhar
        if (formats.indexOf(format) < formats.length - 1) {
          continue;
        }
      }
    }

    // Se chegou aqui, todos os formatos falharam
    throw new Error('Todos os formatos de áudio falharam');
  };

  const handleAudioReady = async (audioBlob: Blob, duration: number, ticket: any, connectedInstance: string, simulateMessageProgression: (id: string, isAudio: boolean) => void, markActivity: () => void) => {
    if (!ticket || !connectedInstance) {
      toast({
        title: "Erro",
        description: "Nenhuma instância WhatsApp conectada",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log(`🎵 ===== PROCESSANDO ÁUDIO PARA ENVIO =====`);
      console.log(`📊 Áudio recebido:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: duration,
        sizeInKB: Math.round(audioBlob.size / 1024)
      });

      const messageId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      simulateMessageProgression(messageId, true);
      markActivity();

      // Registrar mensagem no ticket primeiro
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: messageId,
        from_me: true,
        sender_name: 'Atendente',
        content: `🎵 Áudio (${duration}s)`,
        message_type: 'audio',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'processing',
        timestamp: new Date().toISOString()
      });

      // Tentar enviar com fallback
      const result = await sendAudioWithFallback(audioBlob, ticket, connectedInstance, messageId);

      // Atualizar mensagem existente para completada usando Supabase diretamente
      await supabase
        .from('ticket_messages')
        .update({ 
          processing_status: 'completed',
          content: `🎵 Áudio enviado via ${result.format} (${duration}s)`
        })
        .eq('message_id', messageId);

      toast({
        title: "Sucesso! 🎵",
        description: `Áudio enviado com sucesso via ${result.format} (${duration}s)`
      });

    } catch (error: any) {
      console.error(`💥 ===== ERRO COMPLETO NO ENVIO DE ÁUDIO =====`);
      console.error(`🔍 Nome:`, error.name);
      console.error(`📝 Mensagem:`, error.message);
      console.error(`📚 Stack:`, error.stack);
      
      let errorMessage = 'Falha ao enviar áudio';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout - tente um áudio mais curto';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erro de conectividade';
      } else if (error.message.includes('500')) {
        errorMessage = 'Erro interno do servidor WhatsApp';
      } else if (error.message.includes('413')) {
        errorMessage = 'Arquivo muito grande';
      }
      
      toast({
        title: errorMessage,
        description: `Detalhes: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return { handleAudioReady };
};

// Função auxiliar para converter blob para base64
const blobToBase64 = async (blob: Blob): Promise<string> => {
  if (typeof btoa !== 'undefined') {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binaryString);
  } else {
    // Fallback para ambientes que não têm btoa
    const base64String = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
    return base64String;
  }
};

// Função auxiliar para obter extensão do tipo MIME
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4'
  };
  
  return mimeToExt[mimeType] || 'webm';
};
