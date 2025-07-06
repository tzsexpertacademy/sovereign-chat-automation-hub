
const { MessageMedia } = require('whatsapp-web.js');

class AudioProcessor {
  /**
   * Processa áudio base64 e converte para MessageMedia
   * @param {string} base64Audio - Áudio em base64
   * @param {string} fileName - Nome do arquivo (opcional)
   * @param {string} mimeType - Tipo MIME do áudio
   * @returns {MessageMedia} - Objeto MessageMedia para WhatsApp
   */
  static processBase64Audio(base64Audio, fileName = 'audio.ogg', mimeType = 'audio/ogg') {
    try {
      console.log('🎵 Processando áudio base64:', {
        fileName,
        mimeType,
        base64Length: base64Audio.length,
        sizeKB: Math.round((base64Audio.length * 0.75) / 1024) // Estimativa do tamanho
      });

      // Criar MessageMedia a partir do base64
      const media = new MessageMedia(mimeType, base64Audio, fileName);
      
      console.log('✅ MessageMedia criado com sucesso:', {
        mimetype: media.mimetype,
        filename: media.filename,
        dataLength: media.data.length
      });

      return media;
    } catch (error) {
      console.error('❌ Erro ao processar áudio base64:', error);
      throw new Error(`Falha no processamento de áudio: ${error.message}`);
    }
  }

  /**
   * Valida formato de áudio suportado
   * @param {string} mimeType - Tipo MIME do áudio
   * @returns {boolean} - Se o formato é suportado
   */
  static isValidAudioFormat(mimeType) {
    const supportedFormats = [
      'audio/ogg',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/aac',
      'audio/m4a'
    ];

    return supportedFormats.includes(mimeType.toLowerCase());
  }

  /**
   * Otimiza o tipo MIME para melhor compatibilidade
   * @param {string} originalMimeType - Tipo MIME original
   * @returns {string} - Tipo MIME otimizado
   */
  static optimizeMimeType(originalMimeType) {
    const mimeType = originalMimeType.toLowerCase();
    
    // Mapear para tipos mais compatíveis
    const mimeTypeMap = {
      'audio/webm': 'audio/ogg',
      'audio/x-wav': 'audio/wav',
      'audio/x-mpeg': 'audio/mpeg',
      'audio/mp3': 'audio/mpeg'
    };

    return mimeTypeMap[mimeType] || mimeType;
  }

  /**
   * Gera estatísticas do processamento de áudio
   * @param {string} base64Audio - Áudio base64
   * @param {string} mimeType - Tipo MIME
   * @returns {Object} - Estatísticas do áudio
   */
  static getAudioStats(base64Audio, mimeType) {
    const sizeBytes = base64Audio.length * 0.75; // Base64 para bytes
    const sizeKB = Math.round(sizeBytes / 1024);
    const sizeMB = Math.round(sizeKB / 1024 * 100) / 100;

    return {
      originalMimeType: mimeType,
      optimizedMimeType: this.optimizeMimeType(mimeType),
      base64Length: base64Audio.length,
      estimatedSizeBytes: Math.round(sizeBytes),
      estimatedSizeKB: sizeKB,
      estimatedSizeMB: sizeMB,
      isValidFormat: this.isValidAudioFormat(mimeType),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { AudioProcessor };
