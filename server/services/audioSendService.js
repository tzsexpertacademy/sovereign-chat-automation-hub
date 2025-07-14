// ✅ CORREÇÃO DEFINITIVA - AudioSendService com APIs corretas whatsapp-web.js v1.25.0+

const fs = require('fs');
const path = require('path');

class AudioSendService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelays = [1000, 3000, 5000]; // Timeouts mais rápidos
        this.supportedFormats = [
            { ext: 'ogg', mime: 'audio/ogg' },
            { ext: 'wav', mime: 'audio/wav' },
            { ext: 'webm', mime: 'audio/webm' }
        ];
    }

    async sendAudioWithRetry(client, to, audioPath, originalFileName = 'audio') {
        console.log(`🎵 ===== CORREÇÃO DEFINITIVA - APIs WHATSAPP-WEB.JS v1.25.0+ =====`);
        console.log(`📁 Arquivo: ${audioPath}`);
        console.log(`📞 Para: ${to}`);
        console.log(`🔧 APIs corretas: MessageMedia.fromFilePath() + new MessageMedia()`);
        
        let lastError = null;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            console.log(`🔄 TENTATIVA ${attempt + 1}/${this.maxRetries}`);
            
            try {
                // Delay progressivo
                if (attempt > 0) {
                    const delay = this.retryDelays[attempt - 1];
                    console.log(`⏱️ Aguardando ${delay}ms...`);
                    await this.sleep(delay);
                }
                
                // ✅ ESTRATÉGIAS COM APIs REAIS DO WHATSAPP-WEB.JS
                const result = await this.attemptAudioSendCorrect(client, to, audioPath, originalFileName, attempt + 1);
                
                if (result.success) {
                    console.log(`✅ SUCESSO REAL na tentativa ${attempt + 1}!`);
                    return {
                        success: true,
                        attempt: attempt + 1,
                        format: 'audio/ogg',
                        message: `Áudio enviado com APIs corretas (tentativa ${attempt + 1})`
                    };
                }
                
                lastError = result.error;
                console.log(`❌ FALHA na tentativa ${attempt + 1}: ${result.error}`);
                
            } catch (error) {
                lastError = error.message;
                console.error(`💥 ERRO CRÍTICO na tentativa ${attempt + 1}:`, error);
            }
        }
        
        console.log(`❌ TODAS AS TENTATIVAS FALHARAM COM APIs CORRETAS`);
        return {
            success: false,
            error: `Falha com APIs corretas após ${this.maxRetries} tentativas: ${lastError}`,
            attempts: this.maxRetries
        };
    }

    async attemptAudioSendCorrect(client, to, audioPath, originalFileName, attempt = 1) {
        try {
            console.log(`📤 [TENTATIVA ${attempt}] APIs CORRETAS whatsapp-web.js...`);
            
            // DEBUGGING AVANÇADO: Testar Puppeteer primeiro
            console.log('🔧 [DEBUG] Testando comunicação Puppeteer...');
            
            try {
                const puppeteerTest = await client.pupPage.evaluate(() => {
                    console.log('🧪 Teste Puppeteer básico - OK');
                    return { status: 'ok', timestamp: Date.now() };
                });
                console.log('🧪 Puppeteer funciona:', puppeteerTest);
            } catch (puppeteerError) {
                console.log('❌ Erro no Puppeteer básico:', puppeteerError.message);
                throw new Error(`Puppeteer não responde: ${puppeteerError.message}`);
            }
            
            // Verificar cliente
            const state = await client.getState();
            console.log(`🔍 Estado do cliente: ${state}`);
            
            if (state !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${state}`);
            }

            // Verificar arquivo
            if (!fs.existsSync(audioPath)) {
                throw new Error(`Arquivo não encontrado: ${audioPath}`);
            }

            const stats = fs.statSync(audioPath);
            console.log(`📊 Arquivo: ${Math.round(stats.size / 1024)}KB`);
            
            // DEBUGGING: Verificar se MessageMedia está disponível no contexto
            console.log('🔧 [DEBUG] Verificando disponibilidade de APIs...');
            
            try {
                const apiCheck = await client.pupPage.evaluate(() => {
                    return {
                        hasWWebJS: typeof window.WWebJS !== 'undefined',
                        hasMessageMedia: typeof window.WWebJS?.MessageMedia !== 'undefined',
                        hasStore: typeof window.Store !== 'undefined',
                        hasClient: typeof window.Store?.SendMessage !== 'undefined'
                    };
                });
                console.log('🔧 [DEBUG] APIs disponíveis:', apiCheck);
            } catch (apiError) {
                console.log('❌ Erro ao verificar APIs:', apiError.message);
            }
            
            const { MessageMedia } = require('whatsapp-web.js');
            let result;
            
            // ✅ ESTRATÉGIA 1: MessageMedia.fromFilePath() - API OFICIAL
            if (attempt === 1) {
                console.log(`🎯 [ESTRATÉGIA 1] MessageMedia.fromFilePath() - API OFICIAL`);
                
                console.log('🔧 [DEBUG] Criando MessageMedia.fromFilePath...');
                const media = MessageMedia.fromFilePath(audioPath);
                console.log(`📦 MessageMedia criado:`, {
                    mimetype: media.mimetype,
                    filename: media.filename,
                    hasData: !!media.data,
                    dataLength: media.data ? media.data.length : 0
                });
                
                console.log('🔧 [DEBUG] Iniciando client.sendMessage com sendAudioAsVoice...');
                result = await client.sendMessage(to, media, { sendAudioAsVoice: true });
                console.log('🔧 [DEBUG] client.sendMessage completou');
                
            } 
            // ✅ ESTRATÉGIA 2: MessageMedia constructor com base64
            else if (attempt === 2) {
                console.log(`🎯 [ESTRATÉGIA 2] MessageMedia constructor com base64`);
                
                console.log('🔧 [DEBUG] Lendo arquivo como base64...');
                const fileBuffer = fs.readFileSync(audioPath);
                const base64Data = fileBuffer.toString('base64');
                const fileName = `${originalFileName}.ogg`;
                
                console.log(`📊 Base64: ${base64Data.length} chars, arquivo: ${fileName}`);
                
                console.log('🔧 [DEBUG] Criando MessageMedia manual...');
                const media = new MessageMedia('audio/ogg', base64Data, fileName);
                console.log('🔧 [DEBUG] MessageMedia manual criado, enviando com sendAudioAsVoice...');
                result = await client.sendMessage(to, media, { sendAudioAsVoice: true });
                console.log('🔧 [DEBUG] Envio manual completou');
                
            } 
            // ✅ ESTRATÉGIA 3: sendMessage com options específicas para voz
            else {
                console.log(`🎯 [ESTRATÉGIA 3] sendMessage como audio com options`);
                
                console.log('🔧 [DEBUG] Preparando estratégia 3...');
                const fileBuffer = fs.readFileSync(audioPath);
                const base64Data = fileBuffer.toString('base64');
                const fileName = `${originalFileName}.ogg`;
                
                console.log('🔧 [DEBUG] Criando MessageMedia para voz...');
                const media = new MessageMedia('audio/ogg', base64Data, fileName);
                
                console.log('🔧 [DEBUG] Enviando como mensagem de voz...');
                // Enviar especificamente como mensagem de voz
                result = await client.sendMessage(to, media, {
                    sendAudioAsVoice: true
                });
                console.log('🔧 [DEBUG] Envio como voz completou');
            }
            
            // ✅ DETECÇÃO REAL DE SUCESSO
            console.log(`📊 Resultado bruto:`, {
                hasResult: !!result,
                hasId: !!result?.id,
                hasSerialized: !!result?.id?._serialized,
                type: typeof result
            });
            
            if (result && result.id && result.id._serialized) {
                console.log(`✅ SUCESSO REAL - ID da mensagem: ${result.id._serialized}`);
                return { success: true, messageId: result.id._serialized };
            } else {
                throw new Error('Resultado inválido - API não retornou ID válido');
            }
            
        } catch (error) {
            console.error(`❌ [ERRO ${attempt}] APIs corretas falharam:`, error.message);
            
            // Categorizar erro para debugging
            let errorType = 'UNKNOWN';
            if (error.message.includes('Evaluation failed')) errorType = 'PUPPETEER_EVALUATION';
            if (error.message.includes('timeout')) errorType = 'TIMEOUT';
            if (error.message.includes('não conectado')) errorType = 'NOT_CONNECTED';
            
            console.log(`🏷️ Tipo de erro: ${errorType}`);
            
            return { 
                success: false, 
                error: error.message,
                errorType: errorType
            };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            version: 'v1.25.0+ APIs',
            maxRetries: this.maxRetries,
            supportedFormats: this.supportedFormats,
            retryDelays: this.retryDelays
        };
    }
}

module.exports = AudioSendService;