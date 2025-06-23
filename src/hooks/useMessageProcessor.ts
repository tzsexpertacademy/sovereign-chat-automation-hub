
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface ProcessMessageParams {
  messageText: string;
  assistantId: string;
  chatId: string;
  instanceId: string;
  messageId: string;
  isAudioMessage?: boolean;
}

export const useMessageProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processMessage = useCallback(async (params: ProcessMessageParams) => {
    try {
      setIsProcessing(true);
      console.log('🤖 Processando mensagem com assistente:', params);

      const { data, error } = await supabase.functions.invoke('ai-assistant-process', {
        body: params
      });

      if (error) {
        console.error('❌ Erro na função do assistente:', error);
        throw error;
      }

      if (data?.error) {
        console.error('❌ Erro retornado pela função:', data.error);
        throw new Error(data.error);
      }

      console.log('✅ Resposta do assistente processada:', {
        success: data.success,
        isAudio: data.isAudio,
        responseLength: data.response?.length || 0
      });

      return data;
    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      toast({
        title: "Erro no Assistente",
        description: "Falha ao processar mensagem com IA",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return {
    processMessage,
    isProcessing
  };
};
