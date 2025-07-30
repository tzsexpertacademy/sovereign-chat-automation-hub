// Adaptador para converter dados do banco para interface dos componentes
export interface AdaptedMediaData {
  messageId: string;
  mediaUrl?: string;
  mediaKey?: string;
  fileEncSha256?: string;
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
  const mediaKey = message.media_key || message.mediaKey;
  const fileEncSha256 = message.file_enc_sha256 || message.fileEncSha256;
  const fileName = message.media_filename || message.fileName || `media_${messageId}`;
  const fileType = message.media_mimetype || message.mimetype;
  const caption = message.content !== '🎵 Áudio' && message.content !== '🖼️ Imagem' && 
                  message.content !== '🎥 Vídeo' && message.content !== '📄 Documento' 
                  ? message.content : undefined;
  const duration = message.media_duration;

  // Determinar se precisa de descriptografia
  const needsDecryption = !!(
    mediaUrl?.includes('.enc') && 
    mediaKey && 
    fileEncSha256
  );

  // Log reduzido para evitar spam
  if (!mediaUrl && !mediaKey) {
    console.warn('⚠️ MediaAdapter: Mídia sem URL/Key:', messageId);
  }

  return {
    messageId,
    mediaUrl,
    mediaKey,
    fileEncSha256,
    fileName,
    fileType,
    needsDecryption,
    caption,
    duration
  };
};