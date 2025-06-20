
import { supabase } from "@/integrations/supabase/client";

export const audioService = {
  async convertSpeechToText(audioBase64: string, openaiApiKey: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: audioBase64,
        openaiApiKey
      }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.text;
  },

  async convertTextToSpeech(text: string, voiceId: string, apiKey: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: {
        text,
        voiceId,
        apiKey
      }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.audioBase64;
  },

  async processAssistantMessage(params: {
    messageText: string;
    assistantId: string;
    chatId: string;
    instanceId: string;
    messageId: string;
    isAudioMessage?: boolean;
  }) {
    const { data, error } = await supabase.functions.invoke('ai-assistant-process', {
      body: params
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;
  }
};
