
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
                
                // Tentar enviar áudio
                const result = await this.attemptAudioSend(client, to, audioPath, format, originalFileName);
                
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
        
        // Tentar fallback para texto se disponível
        try {
            const fallbackResult = await this.attemptTextFallback(client, to, originalFileName);
            if (fallbackResult.success) {
                return fallbackResult;
            }
        } catch (fallbackError) {
            console.error(`⚠️ Fallback para texto também falhou:`, fallbackError);
        }
        
        return {
            success: false,
            error: `Falha após ${this.maxRetries} tentativas. Último erro: ${lastError}`,
            attempts: this.maxRetries
        };
    }

    async attemptAudioSend(client, to, audioPath, format, originalFileName) {
        try {
            console.log(`📤 Enviando como ${format.ext}...`);
            
            // Verificar se cliente está pronto
            const state = await client.getState();
            if (state !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${state}`);
            }
            
            // Criar mídia
            const media = MessageMedia.fromFilePath(audioPath);
            media.mimetype = format.mime;
            media.filename = `${originalFileName}.${format.ext}`;
            
            console.log(`📊 Mídia configurada:`, {
                mimetype: media.mimetype,
                filename: media.filename,
                hasData: !!media.data,
                dataSize: media.data?.length || 0
            });
            
            // Configurar opções de envio
            const sendOptions = {
                sendAudioAsVoice: true,
                caption: undefined
            };
            
            // Enviar com timeout
            const sendPromise = client.sendMessage(to, media, sendOptions);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout no envio')), 30000);
            });
            
            await Promise.race([sendPromise, timeoutPromise]);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Erro no envio ${format.ext}:`, error.message);
            
            // Verificar se é o erro "Evaluation failed"
            if (error.message.includes('Evaluation failed')) {
                console.log(`🔍 Detectado erro "Evaluation failed" - Problema na API do WhatsApp`);
            }
            
            return { 
                success: false, 
                error: error.message,
                isEvaluationError: error.message.includes('Evaluation failed')
            };
        }
    }

    async attemptTextFallback(client, to, originalFileName) {
        try {
            console.log(`📝 Tentando fallback para texto...`);
            
            const fallbackMessage = `🎵 [ÁUDIO NÃO ENVIADO]
            
Tentamos enviar um áudio mas houve uma falha técnica.
Arquivo: ${originalFileName}
Motivo: Problema de compatibilidade com WhatsApp Web

Por favor, tente reenviar o áudio ou use uma mensagem de texto.`;
            
            await client.sendMessage(to, fallbackMessage);
            
            return {
                success: true,
                isFallback: true,
                message: 'Áudio convertido para mensagem de texto devido a falha técnica'
            };
            
        } catch (error) {
            console.error(`❌ Erro no fallback para texto:`, error);
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
