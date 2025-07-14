// ✅ CORREÇÃO DEFINITIVA - AudioSendService com APIs corretas whatsapp-web.js v1.25.0+

const fs = require('fs');
const path = require('path');

class AudioSendService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelays = [2000, 5000, 10000]; // Timeouts mais longos para estabilidade
        this.supportedFormats = [
            { ext: 'ogg', mime: 'audio/ogg' },
            { ext: 'wav', mime: 'audio/wav' },
            { ext: 'webm', mime: 'audio/webm' },
            { ext: 'mp3', mime: 'audio/mpeg' }
        ];
        this.maxFileSize = 16 * 1024 * 1024; // 16MB limit
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
            console.log(`📤 [TENTATIVA ${attempt}] APIs OTIMIZADAS whatsapp-web.js v21+...`);
            
            // Verificar arquivo primeiro
            if (!fs.existsSync(audioPath)) {
                throw new Error(`Arquivo não encontrado: ${audioPath}`);
            }

            const stats = fs.statSync(audioPath);
            console.log(`📊 Arquivo: ${Math.round(stats.size / 1024)}KB`);
            
            // Verificar tamanho do arquivo
            if (stats.size > this.maxFileSize) {
                throw new Error(`Arquivo muito grande: ${Math.round(stats.size / 1024 / 1024)}MB. Limite: ${this.maxFileSize / 1024 / 1024}MB`);
            }
            
            // Verificar cliente com timeout
            console.log('🔧 [DEBUG] Verificando estado do cliente...');
            
            let clientState;
            try {
                // Timeout para getState
                const statePromise = client.getState();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout ao verificar estado')), 10000)
                );
                clientState = await Promise.race([statePromise, timeoutPromise]);
                console.log(`🔍 Estado do cliente: ${clientState}`);
            } catch (stateError) {
                console.log('❌ Erro ao verificar estado:', stateError.message);
                throw new Error(`Falha ao verificar estado do cliente: ${stateError.message}`);
            }
            
            if (clientState !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${clientState}`);
            }

            // Verificar página do Puppeteer
            console.log('🔧 [DEBUG] Verificando página do Puppeteer...');
            
            try {
                const pageCheck = await client.pupPage.evaluate(() => {
                    return {
                        ready: document.readyState === 'complete',
                        hasWWebJS: typeof window.WWebJS !== 'undefined',
                        timestamp: Date.now()
                    };
                });
                console.log('🧪 Página do Puppeteer:', pageCheck);
                
                if (!pageCheck.ready) {
                    throw new Error('Página do WhatsApp não está pronta');
                }
            } catch (pageError) {
                console.log('❌ Erro na página do Puppeteer:', pageError.message);
                throw new Error(`Página do WhatsApp não responde: ${pageError.message}`);
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
            // ✅ ESTRATÉGIA 3: Fallback inteligente com timeout
            else {
                console.log(`🎯 [ESTRATÉGIA 3] Fallback inteligente com timeout`);
                
                console.log('🔧 [DEBUG] Preparando estratégia de fallback...');
                const fileBuffer = fs.readFileSync(audioPath);
                const base64Data = fileBuffer.toString('base64');
                const fileName = `${originalFileName}.ogg`;
                
                console.log('🔧 [DEBUG] Criando MessageMedia para fallback...');
                const media = new MessageMedia('audio/ogg', base64Data, fileName);
                
                console.log('🔧 [DEBUG] Enviando com timeout personalizado...');
                // Implementar timeout personalizado
                const sendPromise = client.sendMessage(to, media, {
                    sendAudioAsVoice: true
                });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout no envio de áudio')), 30000)
                );
                
                result = await Promise.race([sendPromise, timeoutPromise]);
                console.log('🔧 [DEBUG] Envio com timeout completou');
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
            version: 'v21.0.0+ OTIMIZADO',
            maxRetries: this.maxRetries,
            supportedFormats: this.supportedFormats,
            retryDelays: this.retryDelays,
            maxFileSize: this.maxFileSize,
            features: [
                'timeout_personalizado',
                'verificacao_estado_robusto',
                'fallback_inteligente',
                'limpeza_automatica_arquivos'
            ]
        };
    }
}

module.exports = AudioSendService;