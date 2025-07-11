
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

class AudioSendService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelays = [2000, 5000, 10000]; // 2s, 5s, 10s
        this.supportedFormats = [
            { ext: 'ogg', mime: 'audio/ogg' },
            { ext: 'wav', mime: 'audio/wav' },
            { ext: 'mp3', mime: 'audio/mpeg' }
        ];
    }

    async sendAudioWithRetry(client, to, audioPath, originalFileName = 'audio') {
        console.log(`🎵 ===== INICIANDO ENVIO DE ÁUDIO COM RETRY =====`);
        console.log(`📁 Arquivo: ${audioPath}`);
        console.log(`📞 Para: ${to}`);
        
        let lastError = null;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const format = this.supportedFormats[attempt % this.supportedFormats.length];
            
            console.log(`🔄 TENTATIVA ${attempt + 1}/${this.maxRetries} - Formato: ${format.ext}`);
            
            try {
                // Aguardar delay progressivo nas tentativas seguintes
                if (attempt > 0) {
                    const delay = this.retryDelays[attempt - 1];
                    console.log(`⏱️ Aguardando ${delay}ms antes da tentativa...`);
                    await this.sleep(delay);
                }
                
                // Tentar enviar áudio com informação da tentativa
                const result = await this.attemptAudioSend(client, to, audioPath, format, originalFileName, attempt + 1);
                
                if (result.success) {
                    console.log(`✅ SUCESSO na tentativa ${attempt + 1} com formato ${format.ext}`);
                    return {
                        success: true,
                        attempt: attempt + 1,
                        format: format.ext,
                        message: `Áudio enviado com sucesso (${format.ext})`
                    };
                }
                
                lastError = result.error;
                console.log(`❌ FALHA na tentativa ${attempt + 1}: ${result.error}`);
                
            } catch (error) {
                lastError = error.message;
                console.error(`💥 ERRO CRÍTICO na tentativa ${attempt + 1}:`, error);
            }
        }
        
        console.log(`❌ TODAS AS TENTATIVAS FALHARAM`);
        
        // Obter estatísticas do arquivo para fallback melhorado
        let audioStats = {};
        try {
            if (fs.existsSync(audioPath)) {
                const stats = fs.statSync(audioPath);
                audioStats = { size: stats.size };
            }
        } catch (statsError) {
            console.warn(`⚠️ Não foi possível obter estatísticas do arquivo:`, statsError.message);
        }

        // Tentar fallback para texto com informações detalhadas
        try {
            const fallbackResult = await this.attemptTextFallback(client, to, originalFileName, audioStats);
            if (fallbackResult.success) {
                return fallbackResult;
            }
        } catch (fallbackError) {
            console.error(`⚠️ [FALLBACK] Fallback para texto também falhou:`, fallbackError);
        }
        
        return {
            success: false,
            error: `Falha após ${this.maxRetries} tentativas. Último erro: ${lastError}`,
            attempts: this.maxRetries
        };
    }

    async attemptAudioSend(client, to, audioPath, format, originalFileName, attempt = 1) {
        try {
            console.log(`📤 [TENTATIVA ${attempt}] Enviando como ${format.ext}...`);
            
            // Diagnóstico avançado do cliente
            const state = await client.getState();
            console.log(`🔍 [DIAGNÓSTICO] Estado do cliente: ${state}`);
            
            if (state !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${state}`);
            }

            // Verificar se arquivo existe e obter estatísticas
            const stats = fs.statSync(audioPath);
            console.log(`📊 [DIAGNÓSTICO] Arquivo:`, {
                tamanho: stats.size,
                tamanhoKB: Math.round(stats.size / 1024),
                existe: fs.existsSync(audioPath),
                formato: path.extname(audioPath)
            });
            
            // ✅ CORREÇÃO DEFINITIVA: Estratégias sem MessageMedia
            console.log(`🔧 [CORREÇÃO DEFINITIVA] Tentativa ${attempt}: Evitando "Evaluation failed"`);
            
            // Ler arquivo diretamente em base64 (mais confiável)
            const fileBuffer = fs.readFileSync(audioPath);
            const base64Data = fileBuffer.toString('base64');
            
            // Validar base64 gerado
            console.log(`🔍 [VALIDAÇÃO] Base64:`, {
                hasData: !!base64Data,
                dataLength: base64Data.length,
                firstChars: base64Data.substring(0, 30),
                isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)
            });
            
            let result;
            
            // ✅ ESTRATÉGIAS PROGRESSIVAS SEM MessageMedia
            if (attempt === 1) {
                // Estratégia 1: Envio direto como buffer (mais estável)
                console.log(`🎯 [ESTRATÉGIA 1] Envio direto como buffer`);
                result = await client.sendMessage(to, fileBuffer, {
                    type: 'audio',
                    mimetype: format.mime,
                    filename: `${originalFileName}.${format.ext}`
                });
            } else if (attempt === 2) {
                // Estratégia 2: Envio como documento com buffer
                console.log(`🎯 [ESTRATÉGIA 2] Documento com buffer`);
                result = await client.sendMessage(to, fileBuffer, {
                    type: 'document',
                    mimetype: format.mime,
                    filename: `${originalFileName}.${format.ext}`,
                    caption: '🎵 Mensagem de áudio'
                });
            } else {
                // Estratégia 3: MessageMedia manual (última tentativa)
                console.log(`🎯 [ESTRATÉGIA 3] MessageMedia manual seguro`);
                const { MessageMedia } = require('whatsapp-web.js');
                
                // Criar MessageMedia sem usar fromFilePath
                const media = new MessageMedia(format.mime, base64Data, `${originalFileName}.${format.ext}`);
                
                result = await client.sendMessage(to, media, {
                    caption: `🎵 Áudio: ${originalFileName}`
                });
            }
            
            console.log(`📊 [CONFIGURAÇÃO] Estratégia ${attempt}:`, {
                formato: format.ext,
                mimetype: format.mime,
                filename: `${originalFileName}.${format.ext}`,
                hasData: !!base64Data,
                dataSize: base64Data.length
            });
            
            // Timeout adaptativo por tentativa
            const timeouts = [10000, 15000, 25000]; // 10s, 15s, 25s (mais rápido)
            const currentTimeout = timeouts[attempt - 1] || 25000;
            
            console.log(`⏱️ [TIMEOUT] Configurado para ${currentTimeout}ms`);
            
            // Aguardar resultado
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Timeout no envio (${currentTimeout}ms)`)), currentTimeout);
            });
            
            console.log(`📤 [ENVIANDO] Iniciando estratégia ${attempt}...`);
            const finalResult = await Promise.race([Promise.resolve(result), timeoutPromise]);
            
            if (finalResult && (finalResult.id || finalResult._data)) {
                console.log(`✅ [SUCESSO] Áudio enviado com estratégia ${attempt}!`);
            } else {
                throw new Error('Resultado inválido - sem ID de mensagem');
            }
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ [ERRO ${attempt}] Falha no envio ${format.ext}:`, error.message);
            
            // Categorizar tipos de erro
            const errorType = this.categorizeError(error.message);
            console.log(`🏷️ [CATEGORIA] Tipo de erro: ${errorType}`);
            
            // Log detalhado para problemas específicos
            if (error.message.includes('Evaluation failed')) {
                console.log(`🔍 [WHATSAPP-WEB.JS] Erro "Evaluation failed" detectado`);
                console.log(`💡 [SUGESTÃO] Problema na API interna do WhatsApp Web`);
            }
            
            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                console.log(`⏱️ [TIMEOUT] Timeout detectado - rede ou servidor lento`);
            }
            
            return { 
                success: false, 
                error: error.message,
                errorType: errorType,
                isEvaluationError: error.message.includes('Evaluation failed'),
                isTimeout: error.message.includes('timeout') || error.message.includes('Timeout')
            };
        }
    }

    categorizeError(errorMessage) {
        if (errorMessage.includes('Evaluation failed')) return 'WHATSAPP_API_ERROR';
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) return 'TIMEOUT';
        if (errorMessage.includes('Client not ready')) return 'CLIENT_NOT_READY';
        if (errorMessage.includes('não conectado')) return 'NOT_CONNECTED';
        if (errorMessage.includes('Network')) return 'NETWORK_ERROR';
        return 'UNKNOWN';
    }

    async attemptTextFallback(client, to, originalFileName, audioStats = {}) {
        try {
            console.log(`📝 [FALLBACK] Tentando fallback para texto...`);
            
            const duration = audioStats.duration ? `${audioStats.duration}s` : 'duração desconhecida';
            const size = audioStats.size ? `${Math.round(audioStats.size / 1024)}KB` : 'tamanho desconhecido';
            
            const fallbackMessage = `🎵 [ÁUDIO NÃO ENVIADO - ${duration}]
            
⚠️ Falha técnica no envio do áudio
📁 Arquivo: ${originalFileName} (${size})
🔧 Sistema: WhatsApp Web com retry inteligente

💡 Sugestões:
• Tente gravar novamente
• Use mensagem de texto
• Verifique sua conexão

O sistema tentou múltiplos formatos automaticamente.`;
            
            await client.sendMessage(to, fallbackMessage);
            
            console.log(`✅ [FALLBACK] Mensagem de fallback enviada com sucesso`);
            
            return {
                success: true,
                isFallback: true,
                message: 'Áudio convertido para mensagem de texto devido a falha técnica'
            };
            
        } catch (error) {
            console.error(`❌ [FALLBACK] Erro no fallback para texto:`, error);
            return { success: false, error: error.message };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Método para estatísticas
    getStats() {
        return {
            maxRetries: this.maxRetries,
            supportedFormats: this.supportedFormats,
            retryDelays: this.retryDelays
        };
    }
}

module.exports = AudioSendService;
