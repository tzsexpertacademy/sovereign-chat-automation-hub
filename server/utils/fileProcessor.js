
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Processador Universal de Arquivos
 * Converte dados base64 em arquivos temporários e simula req.files
 */
class FileProcessor {
  /**
   * Converte base64 para Buffer e cria arquivo temporário
   */
  static async processBase64File(base64Data, fileName, mimeType) {
    try {
      console.log('📁 Processando arquivo base64:', { fileName, mimeType, size: base64Data.length });
      
      // Limpar prefixes de data URL se existirem
      let cleanBase64 = base64Data;
      if (base64Data.includes(',')) {
        cleanBase64 = base64Data.split(',')[1];
      }
      
      // Converter para Buffer
      const buffer = Buffer.from(cleanBase64, 'base64');
      console.log('📊 Buffer criado:', { originalSize: base64Data.length, bufferSize: buffer.length });
      
      // Criar arquivo temporário
      const tempDir = os.tmpdir();
      const tempFileName = `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${fileName}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      // Escrever arquivo
      fs.writeFileSync(tempFilePath, buffer);
      console.log('💾 Arquivo temporário criado:', tempFilePath);
      
      // Simular objeto req.files.file
      const fileObject = {
        fieldname: 'file',
        originalname: fileName,
        encoding: '7bit',
        mimetype: mimeType,
        destination: tempDir,
        filename: tempFileName,
        path: tempFilePath,
        size: buffer.length,
        buffer: buffer
      };
      
      console.log('✅ Objeto file simulado:', {
        originalname: fileObject.originalname,
        mimetype: fileObject.mimetype,
        size: fileObject.size,
        path: fileObject.path
      });
      
      return fileObject;
      
    } catch (error) {
      console.error('❌ Erro ao processar arquivo base64:', error);
      throw new Error(`Erro ao processar arquivo: ${error.message}`);
    }
  }
  
  /**
   * Cleanup de arquivo temporário
   */
  static cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Arquivo temporário removido:', filePath);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao remover arquivo temporário:', error.message);
    }
  }
  
  /**
   * Valida tipo MIME suportado pelo WhatsApp
   */
  static validateFileType(mimeType, fileType) {
    const supportedTypes = {
      audio: [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
        'audio/webm', 'audio/aac', 'audio/m4a'
      ],
      image: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
        'image/webp', 'image/bmp', 'image/tiff'
      ],
      video: [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 
        'video/webm', 'video/3gp', 'video/mkv'
      ],
      document: [
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/zip', 'application/x-rar-compressed'
      ]
    };
    
    const allowed = supportedTypes[fileType] || [];
    const isSupported = allowed.includes(mimeType);
    
    console.log('🔍 Validação de tipo:', { fileType, mimeType, isSupported });
    
    return {
      isSupported,
      supportedTypes: allowed
    };
  }
  
  /**
   * Valida tamanho do arquivo
   */
  static validateFileSize(size, fileType) {
    const maxSizes = {
      audio: 16 * 1024 * 1024,    // 16MB
      image: 5 * 1024 * 1024,     // 5MB  
      video: 64 * 1024 * 1024,    // 64MB
      document: 100 * 1024 * 1024 // 100MB
    };
    
    const maxSize = maxSizes[fileType] || maxSizes.document;
    const isValid = size <= maxSize;
    
    console.log('📏 Validação de tamanho:', { 
      fileType, 
      size: `${(size / 1024 / 1024).toFixed(2)}MB`, 
      maxSize: `${(maxSize / 1024 / 1024).toFixed(2)}MB`,
      isValid 
    });
    
    return {
      isValid,
      maxSize,
      currentSize: size
    };
  }
}

module.exports = FileProcessor;
