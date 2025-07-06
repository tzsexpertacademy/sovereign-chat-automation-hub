
// Processador de áudio para converter base64 em formato compatível
// Este arquivo NÃO altera nenhuma funcionalidade existente

const fs = require('fs');
const path = require('path');

class AudioProcessor {
  /**
   * Converte dados base64 para formato compatível com o endpoint existente
   * Simula req.files.file para reutilizar a lógica atual
   */
  static processBase64Audio(audioData, fileName = 'audio.wav', mimeType = 'audio/wav') {
    try {
      console.log('🎵 AudioProcessor: Processando áudio base64...');
      
      // Remover prefixo data:audio/... se presente
      const base64Data = audioData.replace(/^data:audio\/[a-z]+;base64,/, '');
      
      // Converter base64 para buffer
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      console.log(`🎵 AudioProcessor: Buffer criado - ${audioBuffer.length} bytes`);
      
      // Simular estrutura req.files.file para compatibilidade total
      const mockFile = {
        fieldname: 'file',
        originalname: fileName,
        encoding: '7bit',
        mimetype: mimeType,
        buffer: audioBuffer,
        size: audioBuffer.length,
        // Propriedades adicionais para máxima compatibilidade
        destination: undefined,
        filename: undefined,
        path: undefined
      };
      
      console.log('✅ AudioProcessor: Áudio processado com sucesso');
      return mockFile;
      
    } catch (error) {
      console.error('❌ AudioProcessor: Erro ao processar áudio:', error);
      throw new Error(`Erro no processamento de áudio: ${error.message}`);
    }
  }
  
  /**
   * Valida dados de entrada antes do processamento
   */
  static validateAudioData(audioData, fileName, mimeType) {
    if (!audioData) {
      throw new Error('audioData é obrigatório');
    }
    
    if (typeof audioData !== 'string') {
      throw new Error('audioData deve ser uma string base64');
    }
    
    // Validar se é base64 válido
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const cleanData = audioData.replace(/^data:audio\/[a-z]+;base64,/, '');
    
    if (!base64Regex.test(cleanData)) {
      throw new Error('audioData não é um base64 válido');
    }
    
    return true;
  }
}

module.exports = AudioProcessor;
