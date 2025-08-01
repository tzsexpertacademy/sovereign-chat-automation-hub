/**
 * Serviço de Análise Multimídia - Processamento Inteligente de Mídias
 * Suporta: Imagens, Áudios, Vídeos, PDFs, Documentos, URLs
 */

import { supabase } from '@/integrations/supabase/client';

export interface MediaAnalysisResult {
  success: boolean;
  analysis: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'url';
  metadata?: {
    size?: number;
    duration?: number;
    format?: string;
    language?: string;
    messageId?: string;
  };
  error?: string;
}

export interface MediaProcessingOptions {
  clientId: string;
  ticketId: string;
  messageId: string;
  autoSave?: boolean;
}

class MultimediaAnalysisService {
  private static instance: MultimediaAnalysisService;

  static getInstance(): MultimediaAnalysisService {
    if (!MultimediaAnalysisService.instance) {
      MultimediaAnalysisService.instance = new MultimediaAnalysisService();
    }
    return MultimediaAnalysisService.instance;
  }

  /**
   * Processar imagem com GPT-4 Vision
   */
  async processImage(
    imageBase64: string, 
    options: MediaProcessingOptions
  ): Promise<MediaAnalysisResult> {
    try {
      console.log('🖼️ [MULTIMEDIA] Processando imagem com GPT-4 Vision');

      const { data, error } = await supabase.functions.invoke('ai-multimedia-processor', {
        body: {
          type: 'image',
          content: imageBase64,
          options
        }
      });

      if (error) throw error;

      return {
        success: true,
        analysis: data.analysis,
        type: 'image',
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao processar imagem:', error);
      return {
        success: false,
        analysis: '[Erro ao analisar imagem]',
        type: 'image',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processar áudio com transcrição
   */
  async processAudio(
    audioBase64: string, 
    options: MediaProcessingOptions
  ): Promise<MediaAnalysisResult> {
    try {
      console.log('🎵 [MULTIMEDIA] Processando áudio com Whisper');

      const { data, error } = await supabase.functions.invoke('ai-multimedia-processor', {
        body: {
          type: 'audio',
          content: audioBase64,
          options
        }
      });

      if (error) throw error;

      return {
        success: true,
        analysis: data.analysis,
        type: 'audio',
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao processar áudio:', error);
      return {
        success: false,
        analysis: '[Erro ao transcrever áudio]',
        type: 'audio',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processar vídeo (frames + áudio)
   */
  async processVideo(
    videoBase64: string, 
    options: MediaProcessingOptions
  ): Promise<MediaAnalysisResult> {
    try {
      console.log('🎬 [MULTIMEDIA] Processando vídeo');

      const { data, error } = await supabase.functions.invoke('ai-multimedia-processor', {
        body: {
          type: 'video',
          content: videoBase64,
          options
        }
      });

      if (error) throw error;

      return {
        success: true,
        analysis: data.analysis,
        type: 'video',
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao processar vídeo:', error);
      return {
        success: false,
        analysis: '[Erro ao analisar vídeo]',
        type: 'video',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processar documento (PDF, DOC, TXT, etc.)
   */
  async processDocument(
    documentBase64: string, 
    mimeType: string,
    options: MediaProcessingOptions
  ): Promise<MediaAnalysisResult> {
    try {
      console.log('📄 [MULTIMEDIA] Processando documento:', mimeType);

      const { data, error } = await supabase.functions.invoke('ai-multimedia-processor', {
        body: {
          type: 'document',
          content: documentBase64,
          mimeType,
          options
        }
      });

      if (error) throw error;

      return {
        success: true,
        analysis: data.analysis,
        type: 'document',
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao processar documento:', error);
      return {
        success: false,
        analysis: '[Erro ao processar documento]',
        type: 'document',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processar URL (web scraping + análise)
   */
  async processURL(
    url: string, 
    options: MediaProcessingOptions
  ): Promise<MediaAnalysisResult> {
    try {
      console.log('🌐 [MULTIMEDIA] Processando URL:', url);

      const { data, error } = await supabase.functions.invoke('ai-multimedia-processor', {
        body: {
          type: 'url',
          content: url,
          options
        }
      });

      if (error) throw error;

      return {
        success: true,
        analysis: data.analysis,
        type: 'url',
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao processar URL:', error);
      return {
        success: false,
        analysis: `[Erro ao analisar URL: ${url}]`,
        type: 'url',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processar automaticamente baseado no tipo detectado
   */
  async processAuto(
    content: string, 
    type: 'image' | 'audio' | 'video' | 'document' | 'url',
    options: MediaProcessingOptions,
    mimeType?: string
  ): Promise<MediaAnalysisResult> {
    switch (type) {
      case 'image':
        return this.processImage(content, options);
      case 'audio':
        return this.processAudio(content, options);
      case 'video':
        return this.processVideo(content, options);
      case 'document':
        return this.processDocument(content, mimeType || 'application/octet-stream', options);
      case 'url':
        return this.processURL(content, options);
      default:
        throw new Error(`Tipo de mídia não suportado: ${type}`);
    }
  }

  /**
   * Buscar análises existentes de um ticket
   */
  async getTicketAnalyses(ticketId: string): Promise<MediaAnalysisResult[]> {
    try {
      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('message_type, media_transcription, message_id')
        .eq('ticket_id', ticketId)
        .in('message_type', ['image', 'video', 'audio', 'document'])
        .not('media_transcription', 'is', null);

      if (!messages) return [];

      return messages.map(msg => ({
        success: true,
        analysis: msg.media_transcription || '',
        type: msg.message_type as any,
        metadata: { messageId: msg.message_id }
      }));

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao buscar análises:', error);
      return [];
    }
  }

  /**
   * Estatísticas de processamento
   */
  async getProcessingStats(clientId: string): Promise<{
    totalProcessed: number;
    byType: Record<string, number>;
    successRate: number;
  }> {
    try {
      // Buscar IDs dos tickets do cliente primeiro
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId);

      if (!tickets || tickets.length === 0) {
        return { totalProcessed: 0, byType: {}, successRate: 0 };
      }

      const ticketIds = tickets.map(t => t.id);

      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('message_type, media_transcription')
        .in('ticket_id', ticketIds)
        .in('message_type', ['image', 'video', 'audio', 'document']);

      if (!messages) {
        return { totalProcessed: 0, byType: {}, successRate: 0 };
      }

      const total = messages.length;
      const processed = messages.filter(m => m.media_transcription).length;
      
      const byType = messages.reduce((acc, msg) => {
        acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalProcessed: processed,
        byType,
        successRate: total > 0 ? (processed / total) * 100 : 0
      };

    } catch (error) {
      console.error('❌ [MULTIMEDIA] Erro ao buscar estatísticas:', error);
      return { totalProcessed: 0, byType: {}, successRate: 0 };
    }
  }
}

export const multimediaAnalysisService = MultimediaAnalysisService.getInstance();
export default multimediaAnalysisService;