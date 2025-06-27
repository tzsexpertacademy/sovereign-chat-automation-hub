
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { SERVER_URL, getServerConfig, getAlternativeServerConfig } from '@/config/environment';

export const useAudioHandling = (ticketId: string) => {
  const { toast } = useToast();

  // Função robusta para enviar áudio com retry automático
  const sendAudioWithRetry = async (audioBlob: Blob, instanceId: string, chatId: string) => {
    console.log(`🎤 ===== ENVIANDO ÁUDIO COM SISTEMA DE RETRY =====`);
    
    const maxRetries = 2;
    let currentAttempt = 0;
    let lastError = null;
    
    while (currentAttempt <= maxRetries) {
      currentAttempt++;
      
      try {
        console.log(`🔄 TENTATIVA ${currentAttempt}/${maxRetries + 1} de envio de áudio`);
        
        // Obter configuração do servidor para esta tentativa
        const serverConfig = currentAttempt === 1 ? getServerConfig() : getAlternativeServerConfig();
        
        if (!serverConfig && currentAttempt > 1) {
          console.log(`⚠️ Não há configuração alternativa disponível`);
          break;
        }
        
        const baseUrl = serverConfig ? serverConfig.serverUrl : SERVER_URL;
        const audioApiUrl = `${baseUrl}/api/clients/${instanceId}/send-audio`;
        
        console.log(`📤 Tentativa ${currentAttempt} - URL: ${audioApiUrl}`);
        console.log(`🔧 Protocolo: ${serverConfig?.protocol || 'padrão'}`);
        
        // Converter blob para base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binaryString);
        
        console.log(`📊 Dados do áudio preparados:`, {
          originalSize: audioBlob.size,
          base64Length: base64Audio.length,
          mimeType: audioBlob.type,
          url: audioApiUrl
        });
        
        // Fazer requisição com timeout personalizado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
        
        const response = await fetch(audioApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: chatId,
            audioData: base64Audio,
            fileName: `audio_manual_${Date.now()}.wav`
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📡 Resposta da tentativa ${currentAttempt}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: audioApiUrl
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`📄 Dados da resposta:`, result);
        
        if (result.success) {
          console.log(`✅ ÁUDIO ENVIADO COM SUCESSO na tentativa ${currentAttempt}`);
          return result;
        } else {
          throw new Error(result.error || 'Erro desconhecido na resposta');
        }
        
      } catch (error) {
        console.error(`❌ ERRO na tentativa ${currentAttempt}:`, error);
        console.error(`💥 Tipo do erro:`, error.name);
        console.error(`📝 Mensagem:`, error.message);
        
        lastError = error;
        
        // Verificar se é erro de SSL/HTTPS
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('SSL') || 
            error.message.includes('HTTPS') ||
            error.name === 'TypeError') {
          
          console.error(`🚨 PROBLEMA DE CONECTIVIDADE DETECTADO na tentativa ${currentAttempt}`);
          
          if (currentAttempt <= maxRetries) {
            console.log(`🔄 Tentando configuração alternativa...`);
            continue;
          }
        }
        
        // Se não é erro de conectividade ou esgotamos as tentativas
        if (currentAttempt > maxRetries) {
          break;
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt));
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    console.error(`❌ FALHA COMPLETA após ${maxRetries + 1} tentativas`);
    throw lastError || new Error('Todas as tentativas de envio falharam');
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
      console.log(`🎤 ===== PROCESSANDO ÁUDIO MANUAL =====`);
      console.log(`📊 Detalhes:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: duration,
        chatId: ticket.chat_id,
        instanceId: connectedInstance
      });

      const messageId = `audio_manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      simulateMessageProgression(messageId, true);
      markActivity();

      // Usar sistema de retry robusto
      const result = await sendAudioWithRetry(audioBlob, connectedInstance, ticket.chat_id);
      
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
      } catch (base64Error) {
        console.log('⚠️ Não foi possível salvar áudio base64:', base64Error);
      }

      console.log(`💾 Áudio manual registrado no ticket`);
      
      toast({
        title: "Sucesso",
        description: "Áudio enviado com sucesso"
      });

    } catch (error) {
      console.error(`❌ ERRO FINAL ao processar áudio manual:`, error);
      
      let errorMessage = 'Falha ao enviar áudio';
      let suggestions = [];
      
      if (error.message.includes('Failed to fetch') || error.message.includes('SSL')) {
        errorMessage = 'Problema de conectividade';
        suggestions = [
          'Verifique sua conexão com a internet',
          'Se usar HTTPS, aceite o certificado em: https://146.59.227.248',
          'Recarregue a página e tente novamente'
        ];
      } else if (error.message.includes('404') || error.message.includes('Cannot GET')) {
        errorMessage = 'Servidor não encontrado';
        suggestions = [
          'Verifique se o servidor WhatsApp está rodando',
          'Contate o administrador do sistema'
        ];
      } else if (error.message.includes('503') || error.message.includes('não está conectado')) {
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
