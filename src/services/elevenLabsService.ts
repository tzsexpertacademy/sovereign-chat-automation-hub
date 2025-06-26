
import { supabase } from "@/integrations/supabase/client";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: 'premade' | 'cloned' | 'professional';
  description?: string;
  preview_url?: string | null;
  labels?: Record<string, any>;
  settings?: Record<string, any> | null;
}

export interface OrganizedVoices {
  premade: ElevenLabsVoice[];
  cloned: ElevenLabsVoice[];
  professional: ElevenLabsVoice[];
}

export const elevenLabsService = {
  async fetchAllVoices(apiKey: string): Promise<OrganizedVoices> {
    try {
      console.log('🎤 Fetching ElevenLabs voices...');
      
      const { data, error } = await supabase.functions.invoke('get-elevenlabs-voices', {
        body: { apiKey }
      });

      if (error) {
        console.error('❌ Error calling Edge Function:', error);
        throw new Error(error.message || 'Failed to fetch voices');
      }

      if (!data.success) {
        console.error('❌ Edge Function returned error:', data.error);
        throw new Error(data.error || 'Failed to fetch voices');
      }

      console.log('✅ Voices fetched successfully:', data.total, 'voices');
      return data.voices;
    } catch (error) {
      console.error('❌ Error in fetchAllVoices:', error);
      throw error;
    }
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('🔍 Validating ElevenLabs API key...');
      
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const isValid = response.ok;
      console.log(isValid ? '✅ API key valid' : '❌ API key invalid');
      return isValid;
    } catch (error) {
      console.error('❌ Error validating API key:', error);
      return false;
    }
  },

  async testVoice(apiKey: string, voiceId: string, text: string, model: string = 'eleven_multilingual_v2'): Promise<string> {
    try {
      console.log('🎵 Testing voice:', voiceId);
      
      const { data, error } = await supabase.functions.invoke('test-elevenlabs-voice', {
        body: { 
          text, 
          voiceId, 
          apiKey, 
          model 
        }
      });

      if (error) {
        console.error('❌ Error calling test voice function:', error);
        throw new Error(error.message || 'Failed to test voice');
      }

      if (!data.success) {
        console.error('❌ Voice test failed:', data.error);
        throw new Error(data.error || 'Failed to test voice');
      }

      console.log('✅ Voice test successful');
      return data.audioBase64;
    } catch (error) {
      console.error('❌ Error in testVoice:', error);
      throw error;
    }
  }
};
