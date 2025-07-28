/**
 * Serviço de Configuração de Humanização para Assistentes
 * Permite configurar personalidades e comportamentos humanizados
 */

import { supabase } from '@/integrations/supabase/client';

// ===== INTERFACES =====
export interface HumanizedPersonality {
  id: string;
  name: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'empathetic';
  responseDelay: { min: number; max: number };
  typingSpeed: number; // WPM
  reactionProbability: number; // 0-1
}

export interface HumanizedConfig {
  enabled: boolean;
  personality: HumanizedPersonality;
  behavior: {
    typing: {
      enabled: boolean;
      minDuration: number;
      maxDuration: number;
    };
    presence: {
      enabled: boolean;
      showTyping: boolean;
    };
    messageHandling: {
      splitLongMessages: boolean;
      maxCharsPerChunk: number;
      delayBetweenChunks: number;
    };
  };
}

// ===== PERSONALIDADES PADRÃO =====
export const defaultPersonalities: HumanizedPersonality[] = [
  {
    id: 'friendly-assistant',
    name: 'Assistente Amigável',
    tone: 'friendly',
    responseDelay: { min: 2000, max: 4000 },
    typingSpeed: 45,
    reactionProbability: 0.7
  },
  {
    id: 'professional-support',
    name: 'Suporte Profissional',
    tone: 'professional',
    responseDelay: { min: 1500, max: 3000 },
    typingSpeed: 60,
    reactionProbability: 0.3
  },
  {
    id: 'casual-buddy',
    name: 'Parceiro Casual',
    tone: 'casual',
    responseDelay: { min: 1000, max: 5000 },
    typingSpeed: 35,
    reactionProbability: 0.9
  },
  {
    id: 'empathetic-counselor',
    name: 'Conselheiro Empático',
    tone: 'empathetic',
    responseDelay: { min: 2500, max: 5000 },
    typingSpeed: 40,
    reactionProbability: 0.8
  }
];

// ===== CONFIGURAÇÃO PADRÃO =====
export const defaultHumanizedConfig: HumanizedConfig = {
  enabled: true,
  personality: defaultPersonalities[0],
  behavior: {
    typing: {
      enabled: true,
      minDuration: 1000,
      maxDuration: 5000
    },
    presence: {
      enabled: true,
      showTyping: true
    },
    messageHandling: {
      splitLongMessages: true,
      maxCharsPerChunk: 350,
      delayBetweenChunks: 2500
    }
  }
};

// ===== SERVIÇO =====
export const assistantHumanizationService = {
  
  // Buscar configuração de humanização do assistente
  async getHumanizationConfig(assistantId: string): Promise<HumanizedConfig> {
    try {
      console.log(`🎭 [HUMANIZATION-SERVICE] Buscando configuração para assistente: ${assistantId}`);
      
      const { data: assistant, error } = await supabase
        .from('assistants')
        .select('advanced_settings')
        .eq('id', assistantId)
        .single();

      if (error) {
        console.error('❌ [HUMANIZATION-SERVICE] Erro ao buscar assistente:', error);
        return defaultHumanizedConfig;
      }

      if (assistant?.advanced_settings) {
        const advancedSettings = typeof assistant.advanced_settings === 'string' 
          ? JSON.parse(assistant.advanced_settings) 
          : assistant.advanced_settings;
        
        if (advancedSettings.humanization) {
          console.log('✅ [HUMANIZATION-SERVICE] Configuração customizada encontrada');
          return { ...defaultHumanizedConfig, ...advancedSettings.humanization };
        }
      }

      console.log('📋 [HUMANIZATION-SERVICE] Usando configuração padrão');
      return defaultHumanizedConfig;
      
    } catch (error) {
      console.error('❌ [HUMANIZATION-SERVICE] Erro ao processar configuração:', error);
      return defaultHumanizedConfig;
    }
  },

  // Salvar configuração de humanização do assistente
  async saveHumanizationConfig(assistantId: string, config: HumanizedConfig): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`💾 [HUMANIZATION-SERVICE] Salvando configuração para assistente: ${assistantId}`, {
        enabled: config.enabled,
        personality: config.personality.name
      });

      // Buscar advanced_settings existente
      const { data: assistant, error: fetchError } = await supabase
        .from('assistants')
        .select('advanced_settings')
        .eq('id', assistantId)
        .single();

      if (fetchError) {
        console.error('❌ [HUMANIZATION-SERVICE] Erro ao buscar assistente:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Mesclar com configurações existentes
      let advancedSettings = {};
      if (assistant?.advanced_settings) {
        advancedSettings = typeof assistant.advanced_settings === 'string' 
          ? JSON.parse(assistant.advanced_settings) 
          : assistant.advanced_settings;
      }

      advancedSettings = {
        ...advancedSettings,
        humanization: config
      };

      // Salvar no banco
      const { error: updateError } = await supabase
        .from('assistants')
        .update({
          advanced_settings: JSON.stringify(advancedSettings),
          updated_at: new Date().toISOString()
        })
        .eq('id', assistantId);

      if (updateError) {
        console.error('❌ [HUMANIZATION-SERVICE] Erro ao atualizar assistente:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('✅ [HUMANIZATION-SERVICE] Configuração salva com sucesso');
      return { success: true };

    } catch (error) {
      console.error('❌ [HUMANIZATION-SERVICE] Erro ao salvar configuração:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  },

  // Obter personalidades disponíveis
  getAvailablePersonalities(): HumanizedPersonality[] {
    return [...defaultPersonalities];
  },

  // Buscar personalidade por ID
  getPersonalityById(personalityId: string): HumanizedPersonality | null {
    return defaultPersonalities.find(p => p.id === personalityId) || null;
  },

  // Validar configuração
  validateConfig(config: Partial<HumanizedConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.behavior?.typing) {
      if (config.behavior.typing.minDuration < 500) {
        errors.push('Duração mínima de typing deve ser pelo menos 500ms');
      }
      if (config.behavior.typing.maxDuration > 10000) {
        errors.push('Duração máxima de typing deve ser no máximo 10 segundos');
      }
      if (config.behavior.typing.minDuration >= config.behavior.typing.maxDuration) {
        errors.push('Duração mínima deve ser menor que a máxima');
      }
    }

    if (config.behavior?.messageHandling) {
      if (config.behavior.messageHandling.maxCharsPerChunk < 100) {
        errors.push('Tamanho mínimo por chunk deve ser pelo menos 100 caracteres');
      }
      if (config.behavior.messageHandling.maxCharsPerChunk > 1000) {
        errors.push('Tamanho máximo por chunk deve ser no máximo 1000 caracteres');
      }
      if (config.behavior.messageHandling.delayBetweenChunks < 1000) {
        errors.push('Delay entre chunks deve ser pelo menos 1 segundo');
      }
    }

    if (config.personality) {
      if (config.personality.typingSpeed < 10 || config.personality.typingSpeed > 100) {
        errors.push('Velocidade de digitação deve estar entre 10 e 100 WPM');
      }
      if (config.personality.responseDelay.min < 500) {
        errors.push('Delay mínimo de resposta deve ser pelo menos 500ms');
      }
      if (config.personality.responseDelay.max > 10000) {
        errors.push('Delay máximo de resposta deve ser no máximo 10 segundos');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Gerar configuração de exemplo para teste
  generateTestConfig(personalityId: string): HumanizedConfig {
    const personality = this.getPersonalityById(personalityId) || defaultPersonalities[0];
    
    return {
      enabled: true,
      personality,
      behavior: {
        typing: {
          enabled: true,
          minDuration: 800,
          maxDuration: 3000
        },
        presence: {
          enabled: true,
          showTyping: true
        },
        messageHandling: {
          splitLongMessages: true,
          maxCharsPerChunk: 300,
          delayBetweenChunks: 2000
        }
      }
    };
  }
};