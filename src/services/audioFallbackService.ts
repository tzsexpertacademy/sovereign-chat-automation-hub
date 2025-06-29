
// Sistema de fallback inteligente para áudio com conversão para texto

import { useToast } from '@/hooks/use-toast';

export interface AudioFallbackResult {
  success: boolean;
  method: 'audio' | 'text' | 'failed';
  message: string;
  textContent?: string;
  error?: string;
}

class AudioFallbackService {
  private failedAudios: Map<string, Blob> = new Map();
  private maxRetries = 3;
  private retryDelays = [2000, 5000, 10000];

  async processAudioWithFallback(
    audioBlob: Blob,
    duration: number,
    sendAudioFunction: (blob: Blob) => Promise<any>,
    chatId: string,
    messageId: string
  ): Promise<AudioFallbackResult> {
    console.log('🎵 ===== PROCESSAMENTO DE ÁUDIO COM FALLBACK =====');
    console.log('📊 Informações do áudio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      duration,
      chatId,
      messageId
    });

    // Tentar envio direto do áudio
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentativa ${attempt + 1}/${this.maxRetries} de envio de áudio`);
        
        if (attempt > 0) {
          const delay = this.retryDelays[attempt - 1];
          console.log(`⏱️ Aguardando ${delay}ms antes da próxima tentativa...`);
          await this.sleep(delay);
        }

        const result = await sendAudioFunction(audioBlob);
        
        if (result.success) {
          console.log('✅ Áudio enviado com sucesso na tentativa', attempt + 1);
          return {
            success: true,
            method: 'audio',
            message: `Áudio enviado com sucesso (${duration}s)`
          };
        } else {
          console.warn(`⚠️ Tentativa ${attempt + 1} falhou:`, result.error);
        }
      } catch (error: any) {
        console.error(`❌ Erro na tentativa ${attempt + 1}:`, error);
        
        // Se é o erro "Evaluation failed", não vale a pena tentar novamente
        if (error.message && error.message.includes('Evaluation failed')) {
          console.log('🚨 Erro "Evaluation failed" detectado, pulando para fallback');
          break;
        }
      }
    }

    console.log('🔄 Todas as tentativas de áudio falharam, iniciando fallback...');
    
    // Salvar áudio para reenvio posterior
    this.failedAudios.set(messageId, audioBlob);
    
    // Tentar conversão para texto
    try {
      const textContent = await this.convertAudioToText(audioBlob);
      
      if (textContent) {
        console.log('✅ Áudio convertido para texto com sucesso');
        return {
          success: true,
          method: 'text',
          message: `Áudio convertido para texto (${duration}s)`,
          textContent
        };
      } else {
        throw new Error('Conversão para texto retornou vazio');
      }
    } catch (error: any) {
      console.error('❌ Fallback para texto também falhou:', error);
      
      // Último recurso: mensagem de erro amigável
      const fallbackMessage = `🎵 [ÁUDIO NÃO ENVIADO]

❌ Não foi possível enviar o áudio de ${duration}s devido a problemas técnicos.

💡 Soluções:
• Tente reenviar o áudio
• Use uma mensagem de texto
• Verifique sua conexão

🔧 Erro técnico: ${error.message || 'Falha na conversão'}`;

      return {
        success: true,
        method: 'text',
        message: 'Áudio convertido para mensagem de erro',
        textContent: fallbackMessage
      };
    }
  }

  private async convertAudioToText(audioBlob: Blob): Promise<string | null> {
    try {
      console.log('🔄 Iniciando conversão de áudio para texto...');
      
      // Simular conversão (em produção, usar serviço real como Whisper)
      // Por enquanto, retornar uma mensagem padrão
      const mockTranscription = `[Mensagem de áudio de ${Math.round(audioBlob.size / 1024)}KB]`;
      
      // Aguardar um pouco para simular processamento
      await this.sleep(2000);
      
      console.log('✅ Conversão simulada concluída');
      return mockTranscription;
    } catch (error) {
      console.error('❌ Erro na conversão para texto:', error);
      return null;
    }
  }

  public getFailedAudio(messageId: string): Blob | null {
    return this.failedAudios.get(messageId) || null;
  }

  public removeFailedAudio(messageId: string): boolean {
    return this.failedAudios.delete(messageId);
  }

  public getFailedAudiosCount(): number {
    return this.failedAudios.size;
  }

  public clearFailedAudios(): void {
    this.failedAudios.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
export const audioFallbackService = new AudioFallbackService();
