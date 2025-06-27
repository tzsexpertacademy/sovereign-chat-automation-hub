
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { getServerConfig } from '@/config/environment';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

  // Função simplificada para enviar áudio
  const sendAudio = async (audioBlob: Blob, instanceId: string, chatId: string) => {
    console.log(`🎤 ===== ENVIANDO ÁUDIO =====`);
    
    try {
      const serverConfig = getServerConfig();
      const audioApiUrl = `${serverConfig.serverUrl}/api/clients/${instanceId}/send-audio`;
      
      console.log(`📤 URL do envio: ${audioApiUrl}`);
      console.log(`🔧 Protocolo: ${serverConfig.protocol}`);
      console.log(`🏷️ Ambiente: ${serverConfig.environment}`);
      
      // Converter blob para base64
      console.log(`🔄 Convertendo áudio para base64...`);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Audio = btoa(binaryString);
      
      console.log(`📊 Dados do áudio:`, {
        originalSize: audioBlob.size,
        base64Length: base64Audio.length,
        mimeType: audioBlob.type,
        chatId: chatId.substring(0, 10) + '...'
      });
      
      console.log(`📡 Enviando requisição para: ${audioApiUrl}`);
      
      const response = await fetch(audioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: chatId,
          audioData: base64Audio,
          fileName: `audio_manual_${Date.now()}.wav`
        })
      });
      
      console.log(`📡 Resposta recebida:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: audioApiUrl
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        console.error(`❌ Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`📄 Resultado:`, result);
      
      if (result.success) {
        console.log(`✅ ÁUDIO ENVIADO COM SUCESSO`);
        return result;
      } else {
        throw new Error(result.error || 'Erro desconhecido na resposta');
      }
      
    } catch (error) {
      console.error(`❌ ERRO no envio de áudio:`, error);
      console.error(`💥 Tipo do erro:`, error.name);
      console.error(`📝 Mensagem:`, error.message);
      throw error;
    }
  };

  const handleAudioReady = async (audioBlob: Blob, duration: number, ticket: any, connectedInstance: string, simulateMessageProgression: (id: string, isAudio: boolean) => void, markActivity: () => void) => {
    if (!ticket || !connectedInstance) {
      console.error(`❌ Dados insuficientes:`, { ticket: !!ticket, connectedInstance });
      toast({
        title: "Erro",
        description: "Nenhuma instância WhatsApp conectada",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log(`🎤 ===== PROCESSANDO ÁUDIO MANUAL =====`);
      console.log(`📊 Detalhes:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: duration,
        chatId: ticket.chat_id?.substring(0, 15) + '...',
        instanceId: connectedInstance
      });

      const messageId = `audio_manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      simulateMessageProgression(messageId, true);
      markActivity();

      // Enviar áudio com configuração corrigida
      const result = await sendAudio(audioBlob, connectedInstance, ticket.chat_id);
      
      console.log(`✅ ÁUDIO MANUAL ENVIADO COM SUCESSO`);
      
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
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binaryString);
        
        await supabase
          .from('ticket_messages')
          .update({ audio_base64: base64Audio })
          .eq('message_id', messageId);
          
        console.log(`💾 Áudio base64 salvo no banco`);
      } catch (base64Error) {
        console.log('⚠️ Não foi possível salvar áudio base64:', base64Error);
      }

      console.log(`💾 Áudio manual registrado no ticket com sucesso`);
      
      toast({
        title: "Sucesso",
        description: "Áudio enviado com sucesso"
      });

    } catch (error) {
      console.error(`❌ ERRO FINAL ao processar áudio manual:`, error);
      
      let errorMessage = 'Falha ao enviar áudio';
      let suggestions = [];
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Problema de conectividade';
        suggestions = [
          'Verifique sua conexão com a internet',
          'Verifique se o servidor WhatsApp está rodando',
          'Recarregue a página e tente novamente'
        ];
      } else if (error.message.includes('404')) {
        errorMessage = 'Endpoint não encontrado';
        suggestions = [
          'Verifique se o servidor WhatsApp está rodando',
          'Verifique se a rota /send-audio está configurada'
        ];
      } else if (error.message.includes('503')) {
        errorMessage = 'Instância WhatsApp desconectada';
        suggestions = [
          'Reconecte a instância WhatsApp',
          'Verifique o status da conexão'
        ];
      }
      
      console.error('💡 Sugestões de solução:', suggestions);
      
      toast({
        title: errorMessage,
        description: suggestions[0] || error.message,
        variant: "destructive"
      });
    }
  };

  return { handleAudioReady };
};
