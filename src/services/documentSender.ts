import { yumerApiV2 } from '@/services/yumerApiV2Service';

export interface DocumentSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class DocumentSender {
  static async sendWithIntelligentRetry(
    documentBlob: Blob,
    chatId: string,
    instanceId: string,
    messageId: string,
    fileName?: string,
    caption?: string
  ): Promise<DocumentSendResult> {
    console.log('📄 ===== INICIANDO ENVIO VIA YUMER API V2 =====');
    console.log('🔧 CORRIGIDO: Replicando exatamente a estrutura do sendAudioFile que funciona');
    console.log('📊 Dados do documento:', {
      size: documentBlob.size,
      type: documentBlob.type,
      fileName,
      chatId,
      instanceId,
      caption
    });

    let attempts = 0;
    const maxAttempts = 3;

    // Estratégia: Usar sendMediaFile com multipart/form-data (igual ao áudio)
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: sendMediaFile com multipart/form-data`);

      try {
        // Converter Blob para File com nome apropriado
        const finalFileName = fileName || `document_${Date.now()}.pdf`;
        const documentFile = new File([documentBlob], finalFileName, {
          type: documentBlob.type || 'application/pdf'
        });

        // Usar sendMediaFile para envio direto do arquivo
        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, documentFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'document'
        });

        console.log('✅ Sucesso via sendMediaFile:', response);
        
        return {
          success: true,
          format: 'document',
          attempts,
          message: 'Documento enviado via sendMediaFile',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou (sendMediaFile):`, error.message);
        
        if (attempts === maxAttempts) {
          console.error('❌ Todas as tentativas falharam');
          return {
            success: false,
            error: `Falha após ${attempts} tentativas: ${error.message}`,
            attempts
          };
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    return {
      success: false,
      error: 'Máximo de tentativas excedido',
      attempts
    };
  }
}