
// Utilitário para converter JSON+base64 em req.files simulado
// Permite reutilizar toda a lógica existente do servidor

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Converte dados JSON+base64 em estrutura req.files compatível
 * @param {Object} jsonData - { audioData, fileName, mimeType }
 * @returns {Object} - req.files simulado
 */
function convertJsonToFiles(jsonData) {
  try {
    const { audioData, fileName, mimeType } = jsonData;
    
    if (!audioData || !fileName) {
      throw new Error('audioData e fileName são obrigatórios');
    }

    // Remove prefixo data:audio/...;base64, se existir
    const base64Data = audioData.replace(/^data:[^;]+;base64,/, '');
    
    // Converte base64 para Buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Cria arquivo temporário
    const tempDir = os.tmpdir();
    const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${fileName}`;
    const tempPath = path.join(tempDir, tempFileName);
    
    // Escreve arquivo temporário
    fs.writeFileSync(tempPath, buffer);
    
    // Cria estrutura req.files simulada
    const fileObject = {
      name: fileName,
      mimetype: mimeType || 'audio/ogg',
      size: buffer.length,
      tempFilePath: tempPath,
      mv: function(destination) {
        return new Promise((resolve, reject) => {
          try {
            fs.copyFileSync(tempPath, destination);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    };
    
    // Simula estrutura req.files
    const files = {
      file: fileObject
    };
    
    console.log(`📁 Arquivo JSON convertido: ${fileName} (${buffer.length} bytes)`);
    
    return files;
    
  } catch (error) {
    console.error('❌ Erro na conversão JSON→Files:', error);
    throw error;
  }
}

/**
 * Limpa arquivo temporário após uso
 * @param {Object} files - Estrutura req.files
 */
function cleanupTempFile(files) {
  try {
    if (files && files.file && files.file.tempFilePath) {
      if (fs.existsSync(files.file.tempFilePath)) {
        fs.unlinkSync(files.file.tempFilePath);
        console.log(`🗑️ Arquivo temporário removido: ${files.file.tempFilePath}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Erro ao limpar arquivo temporário:', error);
  }
}

module.exports = {
  convertJsonToFiles,
  cleanupTempFile
};
