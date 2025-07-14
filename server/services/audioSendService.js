// ✅ SERVIÇO SIMPLIFICADO - Apenas o que funciona

const fs = require('fs');
const path = require('path');

class AudioSendService {
    constructor() {
        this.maxRetries = 2;
        this.retryDelays = [1000, 3000];
    }

    async sendAudioWithRetry(client, to, audioPath, originalFileName = 'audio') {
        console.log(`🎵 [SIMPLIFICADO] Enviando áudio: ${audioPath}`);
        
        let lastError = null;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            console.log(`🔄 Tentativa ${attempt + 1}/${this.maxRetries}`);
            
            try {
                if (attempt > 0) {
                    const delay = this.retryDelays[attempt - 1];
                    console.log(`⏱️ Aguardando ${delay}ms...`);
                    await this.sleep(delay);
                }
                
                const result = await this.attemptAudioSend(client, to, audioPath, originalFileName);
                
                if (result.success) {
                    console.log(`✅ SUCESSO na tentativa ${attempt + 1}`);
                    return {
                        success: true,
                        attempt: attempt + 1,
                        messageId: result.messageId
                    };
                }
                
                lastError = result.error;
                console.log(`❌ Falha na tentativa ${attempt + 1}: ${result.error}`);
                
            } catch (error) {
                lastError = error.message;
                console.error(`💥 Erro na tentativa ${attempt + 1}:`, error);
            }
        }
        
        return {
            success: false,
            error: `Falha após ${this.maxRetries} tentativas: ${lastError}`,
            attempts: this.maxRetries
        };
    }

    async attemptAudioSend(client, to, audioPath, originalFileName) {
        try {
            console.log(`📤 Enviando áudio simplificado...`);
            
            // Verificar arquivo
            if (!fs.existsSync(audioPath)) {
                throw new Error(`Arquivo não encontrado: ${audioPath}`);
            }

            const stats = fs.statSync(audioPath);
            if (stats.size === 0) {
                throw new Error('Arquivo está vazio');
            }
            
            console.log(`📊 Arquivo: ${Math.round(stats.size / 1024)}KB`);
            
            // Verificar cliente
            const clientState = await client.getState();
            if (clientState !== 'CONNECTED') {
                throw new Error(`Cliente não conectado: ${clientState}`);
            }
            
            // ✅ MÉTODO SIMPLES QUE FUNCIONA
            const { MessageMedia } = require('whatsapp-web.js');
            
            console.log('🎵 Criando MessageMedia...');
            const fileBuffer = fs.readFileSync(audioPath);
            const base64Data = fileBuffer.toString('base64');
            const fileName = `${originalFileName}.ogg`;
            
            const media = new MessageMedia('audio/ogg', base64Data, fileName);
            
            console.log('🎵 Enviando com sendAudioAsVoice...');
            const result = await client.sendMessage(to, media, { sendAudioAsVoice: true });
            
            if (result && result.id && result.id._serialized) {
                console.log(`✅ Áudio enviado - ID: ${result.id._serialized}`);
                return { success: true, messageId: result.id._serialized };
            } else {
                throw new Error('Resultado inválido - sem ID');
            }
            
        } catch (error) {
            console.error(`❌ Erro no envio:`, error.message);
            return { 
                success: false, 
                error: error.message
            };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AudioSendService;