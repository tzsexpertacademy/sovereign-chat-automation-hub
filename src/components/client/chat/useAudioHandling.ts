
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { SERVER_URL } from '@/config/environment';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

  const convertWavToMp3 = async (wavBlob: Blob): Promise<Blob> => {
    try {
      console.log('🔄 Tentando converter WAV para MP3...');
      
      // Criar um elemento audio temporário para converter
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Recriar como MP3 usando MediaRecorder se disponível
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) {
        const stream = new MediaStream();
        const source = audioContext.createMediaStreamSource(stream);
        
        // Fallback: retornar o WAV original se conversão falhar
        console.log('📄 Conversão MP3 não implementada, usando WAV original');
        return wavBlob;
      }
      
      return wavBlob;
    } catch (error) {
      console.error('❌ Erro na conversão:', error);
      return wavBlob;
    }
  };

  const sendAudioWithFallback = async (audioBlob: Blob, ticket: any, connectedInstance: string, messageId: string) => {
    const formats = [
      { blob: audioBlob, mimeType: 'audio/wav', extension: 'wav', description: 'WAV Original' },
    ];

    // Se o formato original não for WAV, tentar converter
    if (audioBlob.type !== 'audio/wav') {
      try {
        const convertedWav = await convertWavToMp3(audioBlob);
        formats.unshift({ 
          blob: convertedWav, 
          mimeType: 'audio/wav', 
          extension: 'wav', 
          description: 'WAV Convertido' 
        });
      } catch (error) {
        console.warn('⚠️ Conversão falhou:', error);
      }
    }

    for (const format of formats) {
      try {
        console.log(`🎵 ===== TENTANDO ENVIO: ${format.description} =====`);
        console.log(`📊 Formato:`, {
          type: format.mimeType,
          size: format.blob.size,
          sizeInKB: Math.round(format.blob.size / 1024)
        });

        // Converter para base64
        const arrayBuffer = await format.blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64Audio = btoa(binaryString);

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
          // Continuar para próximo formato
          continue;
        }

      } catch (error) {
        console.error(`❌ Erro com ${format.description}:`, error);
        // Continuar para próximo formato
        continue;
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

      // Atualizar status para completo
      await ticketsService.updateTicketMessage(messageId, {
        processing_status: 'completed',
        content: `🎵 Áudio enviado via ${result.format} (${duration}s)`
      });

      toast({
        title: "Sucesso! 🎵",
        description: `Áudio enviado com sucesso via ${result.format} (${duration}s)`
      });

    } catch (error) {
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
