
// server/modules/utils.js - Funções utilitárias
const { fs, path } = require('./config');

// Função para criar diretórios necessários
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Diretório criado: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Erro ao criar diretório ${dirPath}:`, error);
    return false;
  }
}

// Função para validar formato de telefone
function validatePhoneNumber(phone) {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verifica se tem pelo menos 10 dígitos (formato mínimo)
  if (cleanPhone.length < 10) {
    return { valid: false, error: 'Número muito curto' };
  }
  
  // Verifica se tem no máximo 15 dígitos (formato internacional)
  if (cleanPhone.length > 15) {
    return { valid: false, error: 'Número muito longo' };
  }
  
  return { valid: true, formatted: cleanPhone };
}

// Função para formatar número para WhatsApp
function formatWhatsAppNumber(phone) {
  const validation = validatePhoneNumber(phone);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  let formatted = validation.formatted;
  
  // Se não começar com código do país, assumir Brasil (55)
  if (!formatted.startsWith('55') && formatted.length <= 11) {
    formatted = '55' + formatted;
  }
  
  // Adicionar @c.us para formato do WhatsApp
  return formatted + '@c.us';
}

// Função para log estruturado
function logWithTimestamp(level, instanceId, message, data = null) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level: level.toUpperCase(),
    instanceId,
    message
  };
  
  if (data) {
    logData.data = data;
  }
  
  const logMessage = `[${timestamp}] ${level.toUpperCase()} [${instanceId}] ${message}`;
  
  switch (level.toLowerCase()) {
    case 'error':
      console.error(logMessage, data || '');
      break;
    case 'warn':
      console.warn(logMessage, data || '');
      break;
    case 'info':
    default:
      console.log(logMessage, data || '');
      break;
  }
  
  return logData;
}

// Função para sanitizar nome de arquivo
function sanitizeFileName(fileName) {
  return fileName
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limitar tamanho
}

// Função para obter extensão do arquivo
function getFileExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

// Função para verificar se arquivo é de mídia suportada
function isSupportedMediaType(mimeType) {
  const supportedTypes = [
    // Imagens
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Vídeos
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    // Áudios
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/mpeg',
    // Documentos
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  return supportedTypes.includes(mimeType);
}

// Função para converter bytes para formato legível
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Função para limpar arquivos temporários
function cleanupTempFiles(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      let cleanedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        // Remover arquivos mais antigos que 1 hora
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Limpeza: ${cleanedCount} arquivos temporários removidos`);
      }
      
      return cleanedCount;
    }
  } catch (error) {
    console.error('❌ Erro na limpeza de arquivos temporários:', error);
    return 0;
  }
}

// Função para delay/sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para retry com backoff exponencial
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`⏳ Tentativa ${i + 1} falhou, aguardando ${delay}ms antes da próxima...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

module.exports = {
  ensureDirectoryExists,
  validatePhoneNumber,
  formatWhatsAppNumber,
  logWithTimestamp,
  sanitizeFileName,
  getFileExtension,
  isSupportedMediaType,
  formatBytes,
  cleanupTempFiles,
  sleep,
  retryWithBackoff
};
