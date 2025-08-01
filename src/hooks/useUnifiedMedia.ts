import { useState, useEffect, useCallback } from 'react';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { supabase } from '@/integrations/supabase/client';
import { useRetryWithBackoff } from './useRetryWithBackoff';

interface UnifiedMediaData {
  messageId: string;
  mediaUrl?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  mimetype?: string;
  contentType: 'image' | 'video' | 'audio' | 'document';
  // Fallbacks base64
  audioBase64?: string;
  imageBase64?: string;
  videoBase64?: string;
  documentBase64?: string;
}

interface UnifiedMediaResult {
  displayUrl: string | null;
  isLoading: boolean;
  error: string | null;
  isFromCache: boolean;
  retry: () => void;
  hasRetried: boolean;
}

/**
 * Hook unificado para gerenciar todos os tipos de mídia
 * com fallbacks robustos e sistema de retry
 */
export const useUnifiedMedia = (mediaData: UnifiedMediaData): UnifiedMediaResult => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const { retryWithBackoff } = useRetryWithBackoff();

  const processMedia = useCallback(async (skipRetry = false) => {
    // Verificar dados básicos
    if (!mediaData.messageId) {
      setError('ID da mensagem não encontrado');
      return;
    }

    // Evitar loop infinito
    if (isProcessing || retryCount >= 3) {
      console.warn('🛑 useUnifiedMedia: Processamento já em andamento ou limite de retries atingido');
      return;
    }

    setIsProcessing(true);
    setIsLoading(true);
    setError(null);

    try {
      console.log('🎯 useUnifiedMedia: Processando', mediaData.contentType, 'para', mediaData.messageId, {
        hasMediaUrl: !!mediaData.mediaUrl,
        hasMediaKey: !!mediaData.mediaKey,
        hasBase64: !!getBase64Data(),
        directPath: mediaData.directPath
      });

      // ⚡ PRIORIDADE 1: Base64 direto (mensagens manuais/já processadas - CRM audios)
      const base64Data = getBase64Data();
      if (base64Data) {
        console.log('✅ useUnifiedMedia: Base64 detectado para CRM audio - reprodução instantânea', {
          messageId: mediaData.messageId,
          contentType: mediaData.contentType,
          base64Size: base64Data.length,
          timeStamp: new Date().toISOString()
        });
        const mimeType = mediaData.mimetype || getDefaultMimeType();
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        setDisplayUrl(dataUrl);
        setIsFromCache(true);
        setIsLoading(false); // ⚡ OTIMIZAÇÃO: Parar loading imediatamente
        return;
      }

      // PRIORIDADE 2: Mensagens recebidas com mediaKey - usar directMediaDownloadService
      if (mediaData.mediaUrl && mediaData.mediaKey) {
        console.log('🔐 useUnifiedMedia: Mídia criptografada detectada - chamando directMediaDownloadService');
        console.log('📋 useUnifiedMedia: Parâmetros:', {
          messageId: mediaData.messageId,
          mediaUrl: mediaData.mediaUrl?.substring(0, 100) + '...',
          hasMediaKey: !!mediaData.mediaKey,
          mediaKeyType: typeof mediaData.mediaKey,
          directPath: mediaData.directPath,
          mimetype: mediaData.mimetype,
          contentType: mediaData.contentType
        });
        
        const instanceId = await getInstanceId();
        console.log('🔍 useUnifiedMedia: Instance ID obtido:', instanceId);
        
        if (!instanceId) {
          setError('Instance ID não encontrado para descriptografar mídia');
          return;
        }

        console.log('📞 useUnifiedMedia: Chamando directMediaDownloadService.processMedia...');
        const result = await directMediaDownloadService.processMedia(
          instanceId,
          mediaData.messageId,
          mediaData.mediaUrl!,
          mediaData.mediaKey,
          mediaData.directPath,
          mediaData.mimetype,
          mediaData.contentType
        );

        console.log('📋 useUnifiedMedia: Resultado do directMediaDownloadService:', {
          success: result.success,
          hasMediaUrl: !!result.mediaUrl,
          cached: result.cached,
          error: result.error
        });

        if (result.success && result.mediaUrl) {
          console.log('✅ useUnifiedMedia: Mídia processada com sucesso via directMediaDownloadService');
          setDisplayUrl(result.mediaUrl);
          setIsFromCache(result.cached || false);
          return;
        }

        console.error('❌ useUnifiedMedia: Falha no directMediaDownloadService:', result.error);
        setError(`Falha na descriptografia: ${result.error}`);
        return;
      }

      // PRIORIDADE 3: URL direta (fallback para mensagens não criptografadas)
      if (mediaData.mediaUrl && !mediaData.mediaUrl.includes('.enc')) {
        console.log('📁 useUnifiedMedia: Usando URL direta (não criptografada)');
        setDisplayUrl(mediaData.mediaUrl);
        setIsFromCache(false);
        return;
      }

      // Falha: dados insuficientes
      console.warn('❌ useUnifiedMedia: Dados insuficientes:', {
        messageId: mediaData.messageId,
        hasMediaUrl: !!mediaData.mediaUrl,
        hasMediaKey: !!mediaData.mediaKey,
        hasBase64: !!getBase64Data(),
        contentType: mediaData.contentType
      });
      setError('Mídia não disponível - dados insuficientes para processamento');

    } catch (error) {
      console.error('❌ useUnifiedMedia: Erro no processamento:', error);
      setError(`Erro ao carregar mídia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  }, [mediaData, retryCount, retryWithBackoff]);

  const getBase64Data = (): string | null => {
    switch (mediaData.contentType) {
      case 'audio':
        return mediaData.audioBase64 || null;
      case 'image':
        return mediaData.imageBase64 || null;
      case 'video':
        return mediaData.videoBase64 || null;
      case 'document':
        return mediaData.documentBase64 || null;
      default:
        return null;
    }
  };

  const getDefaultMimeType = (): string => {
    switch (mediaData.contentType) {
      case 'audio':
        return 'audio/ogg';
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  };

  const getInstanceId = async (): Promise<string | null> => {
    try {
      const currentUrl = window.location.pathname;
      const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
      
      if (ticketIdMatch) {
        const { data: ticketData } = await supabase
          .from('conversation_tickets')
          .select('instance_id')
          .eq('id', ticketIdMatch[1])
          .single();
        
        return ticketData?.instance_id || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ useUnifiedMedia: Erro ao buscar instance ID:', error);
      return null;
    }
  };

  const retry = useCallback(() => {
    if (retryCount >= 3) {
      console.warn('🛑 useUnifiedMedia: Limite de retries atingido');
      return;
    }
    
    console.log('🔄 useUnifiedMedia: Tentativa de retry manual');
    setHasRetried(true);
    setRetryCount(prev => prev + 1);
    setDisplayUrl(null);
    setError(null);
    setIsProcessing(false);
    processMedia(true);
  }, [processMedia, retryCount]);

  // Efeito principal para processar mídia (apenas uma vez)
  useEffect(() => {
    if (!isProcessing && retryCount === 0) {
      processMedia();
    }
  }, [mediaData.messageId]); // Só reprocessa se o messageId mudar

  return {
    displayUrl,
    isLoading,
    error,
    isFromCache,
    retry,
    hasRetried
  };
};