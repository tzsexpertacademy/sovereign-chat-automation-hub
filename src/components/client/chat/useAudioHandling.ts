
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
      console.log(`🎤 ===== DEBUG DETALHADO DO ÁUDIO =====`);
      console.log(`📊 Blob original:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: duration
      });

      const messageId = `audio_manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      simulateMessageProgression(messageId, true);
      markActivity();

      // CONVERTER PARA BASE64 COM DEBUG DETALHADO
      console.log(`🔄 INICIANDO conversão para base64...`);
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log(`📦 ArrayBuffer criado: ${arrayBuffer.byteLength} bytes`);
      
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`🔢 Uint8Array: ${uint8Array.length} elementos`);
      
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      console.log(`📝 BinaryString: ${binaryString.length} caracteres`);
      
      const base64Audio = btoa(binaryString);
      console.log(`🔤 Base64 final: ${base64Audio.length} caracteres`);
      console.log(`🔍 Primeiros 100 chars:`, base64Audio.substring(0, 100));
      console.log(`🔍 Últimos 100 chars:`, base64Audio.substring(base64Audio.length - 100));

      // PREPARAR DADOS PARA ENVIO
      const audioApiUrl = `${SERVER_URL}/api/clients/${connectedInstance}/send-audio`;
      const requestData = {
        to: ticket.chat_id,
        audioData: base64Audio,
        fileName: `audio_manual_${Date.now()}.wav`
      };

      console.log(`📤 ===== DADOS DA REQUISIÇÃO =====`);
      console.log(`🎯 URL:`, audioApiUrl);
      console.log(`📋 Destinatário:`, ticket.chat_id);
      console.log(`📁 Nome do arquivo:`, requestData.fileName);
      console.log(`📊 Tamanho do payload:`, JSON.stringify(requestData).length, 'caracteres');
      console.log(`🔧 Headers que serão enviados:`, {
        'Content-Type': 'application/json'
      });

      // ENVIAR REQUISIÇÃO COM TIMEOUT
      console.log(`🚀 ENVIANDO REQUISIÇÃO...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`⏰ TIMEOUT de 15 segundos atingido`);
        controller.abort();
      }, 15000);

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
      console.log(`🔗 URL final:`, response.url);
      console.log(`📄 Headers da resposta:`, [...response.headers.entries()]);

      // PROCESSAR RESPOSTA
      const responseText = await response.text();
      console.log(`📝 Resposta raw:`, responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`📄 Resposta parseada:`, result);
      } catch (parseError) {
        console.error(`❌ Erro ao parsear JSON:`, parseError);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error(`❌ ERRO HTTP ${response.status}:`, result);
        throw new Error(`HTTP ${response.status}: ${result.error || responseText}`);
      }

      if (result.success) {
        console.log(`🎉 ===== ÁUDIO ENVIADO COM SUCESSO =====`);
        console.log(`✅ Resultado:`, result);
        
        // Registrar no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: messageId,
          from_me: true,
          sender_name: 'Atendente',
          content: '🎤 Mensagem de áudio',
          message_type: 'audio',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        // Salvar áudio base64 se possível
        try {
          await supabase
            .from('ticket_messages')
            .update({ audio_base64: base64Audio })
            .eq('message_id', messageId);
          console.log(`💾 Base64 salvo no banco de dados`);
        } catch (base64Error) {
          console.log('⚠️ Não foi possível salvar áudio base64:', base64Error);
        }

        toast({
          title: "Sucesso",
          description: "Áudio enviado com sucesso"
        });

      } else {
        console.error(`❌ ERRO NA RESPOSTA:`, result);
        throw new Error(result.error || 'Erro desconhecido na resposta');
      }

    } catch (error) {
      console.error(`💥 ===== ERRO COMPLETO =====`);
      console.error(`🔍 Nome do erro:`, error.name);
      console.error(`📝 Mensagem:`, error.message);
      console.error(`📚 Stack:`, error.stack);
      
      let errorMessage = 'Falha ao enviar áudio';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout - servidor demorou muito para responder';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erro de conectividade - verifique sua internet';
      } else if (error.message.includes('404')) {
        errorMessage = 'Rota não encontrada no servidor';
      } else if (error.message.includes('503')) {
        errorMessage = 'Instância WhatsApp desconectada';
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
