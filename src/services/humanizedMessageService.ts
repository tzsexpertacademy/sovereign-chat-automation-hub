/**
 * Serviço de Comportamento Humanizado para Mensagens WhatsApp
 * Implementa delays, typing indicators e comportamentos naturais
 */

export interface HumanizedBehavior {
  enabled: boolean;
  typing: {
    enabled: boolean;
    minDuration: number;
    maxDuration: number;
    wordsPerMinute: number;
  };
  delays: {
    baseDelay: number;
    randomFactor: number;
    longMessageThreshold: number;
    longMessageMultiplier: number;
  };
  presence: {
    composing: boolean;
    recording: boolean;
    available: boolean;
  };
}

export class HumanizedMessageService {
  private config: HumanizedBehavior = {
    enabled: true,
    typing: {
      enabled: true,
      minDuration: 1000,
      maxDuration: 5000,
      wordsPerMinute: 150
    },
    delays: {
      baseDelay: 800,
      randomFactor: 0.5,
      longMessageThreshold: 100,
      longMessageMultiplier: 1.5
    },
    presence: {
      composing: true,
      recording: true,
      available: true
    }
  };

  constructor(config?: Partial<HumanizedBehavior>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Calcula delay humanizado baseado no tamanho da mensagem
   */
  calculateHumanizedDelay(message: string): number {
    if (!this.config.enabled) {
      return this.config.delays.baseDelay;
    }

    const messageLength = message.length;
    let delay = this.config.delays.baseDelay;

    // Delay maior para mensagens longas
    if (messageLength > this.config.delays.longMessageThreshold) {
      delay *= this.config.delays.longMessageMultiplier;
    }

    // Adicionar fator aleatório para naturalidade
    const randomFactor = 1 + (Math.random() - 0.5) * this.config.delays.randomFactor;
    delay *= randomFactor;

    return Math.floor(delay);
  }

  /**
   * Calcula duração de typing baseado no tamanho da mensagem
   */
  calculateTypingDuration(message: string): number {
    if (!this.config.enabled || !this.config.typing.enabled) {
      return 0;
    }

    const words = message.split(' ').length;
    const wordsPerMs = this.config.typing.wordsPerMinute / 60000;
    let duration = words / wordsPerMs;

    // Aplicar limites mínimo e máximo
    duration = Math.max(this.config.typing.minDuration, duration);
    duration = Math.min(this.config.typing.maxDuration, duration);

    return Math.floor(duration);
  }

  /**
   * Determina o tipo de presence baseado no conteúdo
   */
  getPresenceType(message: string, isAudio: boolean = false): 'composing' | 'recording' | 'available' {
    if (!this.config.enabled) {
      return 'available';
    }

    if (isAudio && this.config.presence.recording) {
      return 'recording';
    }

    if (this.config.presence.composing) {
      return 'composing';
    }

    return 'available';
  }

  /**
   * Aplica comportamento humanizado a opções de mensagem
   */
  applyHumanizedOptions(message: string, isAudio: boolean = false): {
    delay: number;
    presence: 'composing' | 'recording' | 'available';
    typingDuration: number;
  } {
    return {
      delay: this.calculateHumanizedDelay(message),
      presence: this.getPresenceType(message, isAudio),
      typingDuration: this.calculateTypingDuration(message)
    };
  }

  /**
   * Quebra mensagens longas em partes menores
   */
  splitLongMessage(message: string, maxLength: number = 1000): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const parts: string[] = [];
    let remaining = message;

    while (remaining.length > maxLength) {
      // Procurar quebra natural (ponto, vírgula, quebra de linha)
      let splitIndex = maxLength;
      const naturalBreaks = ['. ', ', ', '\n', '; ', '! ', '? '];
      
      for (const breakChar of naturalBreaks) {
        const lastBreak = remaining.lastIndexOf(breakChar, maxLength);
        if (lastBreak > maxLength * 0.5) { // Pelo menos 50% do tamanho máximo
          splitIndex = lastBreak + breakChar.length;
          break;
        }
      }

      // Se não achou quebra natural, procurar último espaço
      if (splitIndex === maxLength) {
        const lastSpace = remaining.lastIndexOf(' ', maxLength);
        if (lastSpace > maxLength * 0.7) { // Pelo menos 70% do tamanho máximo
          splitIndex = lastSpace + 1;
        }
      }

      parts.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    if (remaining.length > 0) {
      parts.push(remaining);
    }

    return parts;
  }

  /**
   * Simula delay de digitação
   */
  async simulateTyping(duration: number): Promise<void> {
    if (duration <= 0) return;
    
    return new Promise(resolve => {
      setTimeout(resolve, duration);
    });
  }

  /**
   * Atualiza configuração do serviço
   */
  updateConfig(newConfig: Partial<HumanizedBehavior>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): HumanizedBehavior {
    return { ...this.config };
  }

  /**
   * Desabilita comportamento humanizado
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Habilita comportamento humanizado
   */
  enable(): void {
    this.config.enabled = true;
  }
}

// Instância singleton para uso global
export const humanizedMessageService = new HumanizedMessageService();

export default humanizedMessageService;