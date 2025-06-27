
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { SERVER_URL } from '@/config/environment';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

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
      console.log(`🎵 ===== DEBUG ÁUDIO WAV NATIVO =====`);
      console.log(`📊 Blob WAV original:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: duration,
        sizeInKB: Math.round(audioBlob.size / 1024),
        sizeInMB: Math.round(audioBlob.size / 1024 / 1024 * 100) / 100
      });

      // VERIFICAR SE É REALMENTE WAV
      if (audioBlob.type !== 'audio/wav') {
        console.warn(`⚠️ Tipo inesperado: ${audioBlob.type}, deveria ser audio/wav`);
      }

      const messageId = `audio_wav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      simulateMessageProgression(messageId, true);
      markActivity();

      // CONVERTER PARA BASE64 (método otimizado)
      console.log(`🔄 Convertendo WAV para base64...`);
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log(`📦 ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
      
      // Usar método nativo do navegador se disponível
      let base64Audio: string;
      if (typeof btoa !== 'undefined') {
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        base64Audio = btoa(binaryString);
      } else {
        // Fallback para ambientes que não têm btoa
        const base64String = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(audioBlob);
        });
        base64Audio = base64String;
      }

      console.log(`✅ Base64 WAV gerado:`, {
        length: base64Audio.length,
        firstChars: base64Audio.substring(0, 50),
        lastChars: base64Audio.substring(base64Audio.length - 50)
      });

      // PREPARAR DADOS PARA ENVIO
      const audioApiUrl = `${SERVER_URL}/api/clients/${connectedInstance}/send-audio`;
      const requestData = {
        to: ticket.chat_id,
        audioData: base64Audio,
        fileName: `audio_wav_${Date.now()}.wav`,
        mimeType: 'audio/wav'
      };

      console.log(`📤 ===== ENVIANDO WAV PARA WHATSAPP =====`);
      console.log(`🎯 URL:`, audioApiUrl);
      console.log(`📋 Destinatário:`, ticket.chat_id);
      console.log(`📁 Arquivo:`, requestData.fileName);
      console.log(`🎵 Tipo MIME:`, requestData.mimeType);
      console.log(`📊 Payload size:`, JSON.stringify(requestData).length, 'chars');

      // ENVIAR COM TIMEOUT ADEQUADO PARA ÁUDIO
      console.log(`🚀 Enviando WAV...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`⏰ TIMEOUT de 30 segundos para áudio`);
        controller.abort();
      }, 30000); // 30s para áudio

      const response = await fetch(audioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`📡 ===== RESPOSTA DO SERVIDOR =====`);
      console.log(`📊 Status:`, response.status);
      console.log(`📋 Status Text:`, response.statusText);
      console.log(`✅ OK:`, response.ok);

      const responseText = await response.text();
      console.log(`📝 Resposta bruta:`, responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`📄 Resposta parseada:`, result);
      } catch (parseError) {
        console.error(`❌ Erro ao parsear resposta:`, parseError);
        throw new Error(`Resposta inválida: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error(`❌ ERRO HTTP ${response.status}:`, result);
        throw new Error(`HTTP ${response.status}: ${result.error || result.message || responseText}`);
      }

      if (result.success) {
        console.log(`🎉 ===== ÁUDIO WAV ENVIADO COM SUCESSO =====`);
        console.log(`✅ Resultado completo:`, result);
        
        // Registrar mensagem no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: messageId,
          from_me: true,
          sender_name: 'Atendente',
          content: `🎵 Áudio WAV (${duration}s)`,
          message_type: 'audio',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        // Tentar salvar base64 no banco
        try {
          await supabase
            .from('ticket_messages')
            .update({ audio_base64: base64Audio })
            .eq('message_id', messageId);
          console.log(`💾 Base64 WAV salvo no banco`);
        } catch (dbError) {
          console.log('⚠️ Não foi possível salvar base64:', dbError);
        }

        toast({
          title: "Sucesso! 🎵",
          description: `Áudio WAV enviado com sucesso (${duration}s)`
        });

      } else {
        console.error(`❌ FALHA NA RESPOSTA:`, result);
        throw new Error(result.error || result.message || 'Erro desconhecido');
      }

    } catch (error) {
      console.error(`💥 ===== ERRO COMPLETO NO ÁUDIO WAV =====`);
      console.error(`🔍 Nome:`, error.name);
      console.error(`📝 Mensagem:`, error.message);
      console.error(`📚 Stack:`, error.stack);
      
      let errorMessage = 'Falha ao enviar áudio WAV';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout - áudio muito longo ou conexão lenta';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erro de conectividade - verifique sua internet';
      } else if (error.message.includes('404')) {
        errorMessage = 'Endpoint de áudio não encontrado no servidor';
      } else if (error.message.includes('503')) {
        errorMessage = 'Instância WhatsApp desconectada';
      } else if (error.message.includes('413')) {
        errorMessage = 'Arquivo de áudio muito grande';
      }
      
      toast({
        title: errorMessage,
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return { handleAudioReady };
};
