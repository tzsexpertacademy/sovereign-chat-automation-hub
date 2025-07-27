/**
 * WhatsApp Document Service
 * Gerencia visualização e processamento de documentos do WhatsApp
 */

import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppDocumentData {
  messageId: string;
  encryptedData?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  documentUrl?: string;
  fileName?: string;
  fileType?: string;
}

export interface ProcessedDocument {
  documentData?: string;
  documentUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  fileName?: string;
  fileType?: string;
  needsDecryption: boolean;
  isLoading: boolean;
  error?: string;
}

class WhatsAppDocumentService {
  private cache = new Map<string, string>();

  /**
   * Obtém dados de documento seguros para visualização
   */
  getDocumentDisplayData(message: any): ProcessedDocument {
    if (message.message_type !== 'document') {
      return { needsDecryption: false, isLoading: false };
    }

    const hasMediaUrl = !!message.media_url;
    const hasDecryptionKeys = !!(message.media_key && message.file_enc_sha256);
    
    console.log('📄 [DOCUMENT-SERVICE] Analisando documento:', {
      messageId: message.message_id,
      hasMediaUrl,
      hasDecryptionKeys,
      mediaKey: message.media_key ? 'presente' : 'ausente',
      fileEncSha256: message.file_enc_sha256 ? 'presente' : 'ausente',
      fileName: message.file_name || 'sem nome',
      url: message.media_url?.substring(0, 100) + '...'
    });

    if (!hasMediaUrl) {
      return {
        needsDecryption: false,
        isLoading: false,
        error: 'URL do documento não encontrada'
      };
    }

    // 1. Documento criptografado (tem chaves de descriptografia)
    if (hasDecryptionKeys) {
      return {
        documentUrl: message.media_url,
        messageId: message.message_id || message.id,
        mediaKey: message.media_key,
        fileEncSha256: message.file_enc_sha256,
        fileName: message.file_name || this.generateFileName(message),
        fileType: message.file_type || message.mimetype,
        needsDecryption: true,
        isLoading: false
      };
    }

    // 2. Documento com URL direta (sem chaves = não criptografado)
    return {
      documentUrl: message.media_url,
      fileName: message.file_name || this.generateFileName(message),
      fileType: message.file_type || message.mimetype,
      needsDecryption: false,
      isLoading: false
    };
  }

  /**
   * Gera um nome de arquivo baseado no tipo da mensagem
   */
  private generateFileName(message: any): string {
    const timestamp = new Date().getTime();
    const extension = this.getExtensionFromMimeType(message.file_type || message.mimetype);
    return `document_${message.message_id || timestamp}${extension}`;
  }

  /**
   * Obtém extensão do arquivo baseada no MIME type
   */
  private getExtensionFromMimeType(mimeType?: string): string {
    if (!mimeType) return '';
    
    const mimeMap: { [key: string]: string } = {
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'application/zip': '.zip',
      'application/x-rar-compressed': '.rar',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3'
    };

    return mimeMap[mimeType] || '';
  }

  /**
   * Descriptografa um documento usando a edge function
   */
  async decryptDocument(documentData: WhatsAppDocumentData): Promise<string | null> {
    const { messageId, documentUrl, mediaKey, fileEncSha256 } = documentData;

    if (!messageId || !mediaKey || !fileEncSha256) {
      console.error('❌ [DOCUMENT-SERVICE] Dados insuficientes para descriptografia');
      return null;
    }

    // Verificar cache primeiro
    const cacheKey = `document_${messageId}`;
    if (this.cache.has(cacheKey)) {
      console.log('📄 [DOCUMENT-SERVICE] Documento encontrado no cache');
      return this.cache.get(cacheKey) || null;
    }

    try {
      console.log('🔐 [DOCUMENT-SERVICE] Iniciando descriptografia via edge function');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-document', {
        body: {
          messageId,
          mediaUrl: documentUrl,
          mediaKey,
          fileEncSha256
        }
      });

      if (error) {
        console.error('❌ [DOCUMENT-SERVICE] Erro na edge function:', error);
        return null;
      }

      if (data?.decryptedData) {
        const documentBase64 = data.decryptedData;
        const format = data.documentFormat || 'application/octet-stream';
        
        // Criar URL blob a partir do base64
        const binaryString = atob(documentBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: format });
        const blobUrl = URL.createObjectURL(blob);
        
        // Cachear resultado
        this.cache.set(cacheKey, blobUrl);
        
        console.log('✅ [DOCUMENT-SERVICE] Documento descriptografado com sucesso');
        return blobUrl;
      }

      console.error('❌ [DOCUMENT-SERVICE] Resposta inválida da edge function');
      return null;

    } catch (error) {
      console.error('❌ [DOCUMENT-SERVICE] Erro ao descriptografar documento:', error);
      return null;
    }
  }

  /**
   * Verifica se uma mensagem tem documento
   */
  hasDocument(message: any): boolean {
    return message.message_type === 'document' && !!message.media_url;
  }

  /**
   * Verifica se um documento precisa de descriptografia
   */
  needsDecryption(message: any): boolean {
    return !!(
      message.message_type === 'document' && 
      message.media_key &&
      message.file_enc_sha256
    );
  }

  /**
   * Extrai dados do documento de uma mensagem
   */
  extractDocumentData(message: any): WhatsAppDocumentData | null {
    if (!this.hasDocument(message)) {
      return null;
    }

    return {
      messageId: message.message_id || message.id,
      documentUrl: message.media_url,
      mediaKey: message.media_key,
      fileEncSha256: message.file_enc_sha256,
      fileName: message.file_name,
      fileType: message.file_type || message.mimetype
    };
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    // Revogar URLs blob para liberar memória
    this.cache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.cache.clear();
    console.log('🗑️ [DOCUMENT-SERVICE] Cache limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Exportar instância singleton
export const whatsappDocumentService = new WhatsAppDocumentService();
export default whatsappDocumentService;