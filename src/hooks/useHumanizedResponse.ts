
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface HumanizedResponseProps {
  clientId: string;
}

export const useHumanizedResponse = ({ clientId }: HumanizedResponseProps) => {
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Calcular delay baseado no tamanho da resposta (simula velocidade de digitação humana)
  const calculateTypingDelay = useCallback((text: string) => {
    // Velocidade média de digitação: 40-50 palavras por minuto
    // Aproximadamente 4-5 caracteres por segundo
    const baseDelay = text.length * 200; // 200ms por caractere base
    const randomVariation = Math.random() * 1000; // Variação de até 1 segundo
    const minDelay = 2000; // Mínimo 2 segundos
    const maxDelay = 15000; // Máximo 15 segundos
    
    return Math.min(Math.max(baseDelay + randomVariation, minDelay), maxDelay);
  }, []);

  // Mostrar indicador de digitação
  const showTypingIndicator = useCallback(async (chatId: string) => {
    try {
      console.log('⌨️ Mostrando indicador de digitação para:', chatId);
      setIsTyping(true);
      await whatsappService.sendTypingIndicator(clientId, chatId, true);
    } catch (error) {
      console.error('❌ Erro ao mostrar indicador de digitação:', error);
    }
  }, [clientId]);

  // Esconder indicador de digitação
  const hideTypingIndicator = useCallback(async (chatId: string) => {
    try {
      console.log('⌨️ Escondendo indicador de digitação para:', chatId);
      setIsTyping(false);
      await whatsappService.sendTypingIndicator(clientId, chatId, false);
    } catch (error) {
      console.error('❌ Erro ao esconder indicador de digitação:', error);
    }
  }, [clientId]);

  // Mostrar indicador de gravação de áudio
  const showRecordingIndicator = useCallback(async (chatId: string) => {
    try {
      console.log('🎤 Mostrando indicador de gravação para:', chatId);
      setIsRecording(true);
      await whatsappService.sendRecordingIndicator(clientId, chatId, true);
    } catch (error) {
      console.error('❌ Erro ao mostrar indicador de gravação:', error);
    }
  }, [clientId]);

  // Esconder indicador de gravação
  const hideRecordingIndicator = useCallback(async (chatId: string) => {
    try {
      console.log('🎤 Escondendo indicador de gravação para:', chatId);
      setIsRecording(false);
      await whatsappService.sendRecordingIndicator(clientId, chatId, false);
    } catch (error) {
      console.error('❌ Erro ao esconder indicador de gravação:', error);
    }
  }, [clientId]);

  // Enviar resposta humanizada com delay e indicadores
  const sendHumanizedResponse = useCallback(async (
    chatId: string, 
    response: string,
    isAudioResponse: boolean = false
  ) => {
    try {
      console.log('🤖 Iniciando resposta humanizada:', { 
        chatId, 
        responseLength: response.length,
        isAudio: isAudioResponse 
      });

      // Calcular delay baseado no tamanho da resposta
      const typingDelay = calculateTypingDelay(response);
      console.log(`⏱️ Delay calculado: ${typingDelay}ms`);

      // Mostrar indicador apropriado
      if (isAudioResponse) {
        await showRecordingIndicator(chatId);
      } else {
        await showTypingIndicator(chatId);
      }

      // Aguardar o delay para simular digitação/gravação
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      // Esconder indicador
      if (isAudioResponse) {
        await hideRecordingIndicator(chatId);
      } else {
        await hideTypingIndicator(chatId);
      }

      // Enviar a mensagem
      console.log('📤 Enviando resposta após delay humanizado');
      if (isAudioResponse && response.startsWith('audio:')) {
        await whatsappService.sendMessage(clientId, chatId, response);
      } else {
        await whatsappService.sendMessage(clientId, chatId, response);
      }

      console.log('✅ Resposta humanizada enviada com sucesso');

    } catch (error) {
      console.error('❌ Erro ao enviar resposta humanizada:', error);
      
      // Garantir que os indicadores sejam removidos mesmo em caso de erro
      if (isAudioResponse) {
        await hideRecordingIndicator(chatId);
      } else {
        await hideTypingIndicator(chatId);
      }
      
      throw error;
    }
  }, [clientId, calculateTypingDelay, showTypingIndicator, hideTypingIndicator, showRecordingIndicator, hideRecordingIndicator]);

  return {
    isTyping,
    isRecording,
    sendHumanizedResponse,
    showTypingIndicator,
    hideTypingIndicator,
    showRecordingIndicator,
    hideRecordingIndicator
  };
};
