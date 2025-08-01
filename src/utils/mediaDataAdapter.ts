// Adaptador para converter dados do banco para interface dos componentes
export interface AdaptedMediaData {
  messageId: string;
  mediaUrl?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  fileName?: string;
  fileType?: string;
  needsDecryption: boolean;
  caption?: string;
  duration?: number;
}

export const adaptMessageMedia = (message: any): AdaptedMediaData => {
  // Normalizar campos do banco para interface consistente
  const messageId = message.message_id || message.id;
  const mediaUrl = message.media_url;
  
  // Processar media_key - converter JSON para string se necessário
  let mediaKey = message.media_key || message.mediaKey;
  if (mediaKey && typeof mediaKey === 'object') {
    console.warn('⚠️ MediaAdapter: Convertendo media_key de JSON para string:', messageId);
    mediaKey = JSON.stringify(mediaKey);
  }
  
  // Processar file_enc_sha256 - converter JSON para string se necessário
  let fileEncSha256 = message.file_enc_sha256 || message.fileEncSha256;
  if (fileEncSha256 && typeof fileEncSha256 === 'object') {
    console.warn('⚠️ MediaAdapter: Convertendo file_enc_sha256 de JSON para string:', messageId);
    fileEncSha256 = JSON.stringify(fileEncSha256);
  }
  
  // Extrair directPath da media_url para mensagens recebidas
  let directPath = message.direct_path || message.directPath;
  
  // Para mensagens recebidas: extrair directPath da URL (remover domínio)
  if (!directPath && mediaUrl && mediaUrl.includes('whatsapp.net')) {
    const urlObj = new URL(mediaUrl);
    directPath = urlObj.pathname + urlObj.search;
  }
  
  // Para mensagens manuais: usar a URL completa como directPath se não temos metadata
  if (!directPath && mediaUrl && !mediaUrl.includes('whatsapp.net')) {
    directPath = mediaUrl;
  }
  const fileName = message.media_filename || message.fileName || `media_${messageId}`;
  const fileType = message.media_mimetype || message.mimetype;
  const caption = message.content !== '🎵 Áudio' && message.content !== '🖼️ Imagem' && 
                  message.content !== '🎥 Vídeo' && message.content !== '📄 Documento' 
                  ? message.content : undefined;
  const duration = message.media_duration;

  // Determinar se precisa de processamento via API (qualquer mídia com .enc)
  const needsDecryption = !!(
    mediaUrl?.includes('.enc') && 
    mediaKey
  );

// Cache estático para throttling de logs (evitar spam)
  const logKey = `${messageId}-${message.message_type}`;
  
  // Usar uma variável global para cache
  if (!globalThis._mediaAdapterCache) {
    globalThis._mediaAdapterCache = new Set<string>();
  }
  
  // Log throttling para evitar spam nos mesmos arquivos
  if (!mediaUrl && !mediaKey && !globalThis._mediaAdapterCache.has(logKey)) {
    console.warn('⚠️ MediaAdapter: Mídia sem URL/Key:', messageId);
    globalThis._mediaAdapterCache.add(logKey);
    
    // Limpar cache após 60 segundos para não crescer indefinidamente
    setTimeout(() => {
      globalThis._mediaAdapterCache?.delete(logKey);
    }, 60000);
  }

  return {
    messageId,
    mediaUrl,
    mediaKey,
    fileEncSha256,
    directPath,
    fileName,
    fileType,
    needsDecryption,
    caption,
    duration
  };
};