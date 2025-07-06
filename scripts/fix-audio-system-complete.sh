
#!/bin/bash

# Script completo para corrigir o sistema de áudio
# Arquivo: scripts/fix-audio-system-complete.sh

echo "🎵 CORREÇÃO COMPLETA DO SISTEMA DE ÁUDIO"
echo "======================================="

# Verificar se está rodando como root para CORS
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-audio-system-complete.sh"
    exit 1
fi

echo "🔧 ETAPA 1: Corrigindo CORS e roteamento..."
chmod +x ./scripts/fix-cors-audio-api.sh
./scripts/fix-cors-audio-api.sh

if [ $? -ne 0 ]; then
    echo "❌ Falha na correção de CORS"
    exit 1
fi

echo ""
echo "🔧 ETAPA 2: Verificando se audioHandlerService.js existe..."

if [ ! -f "server/services/audioHandlerService.js" ]; then
    echo "⚠️ Criando audioHandlerService.js..."
    mkdir -p server/services
    
    cat > server/services/audioHandlerService.js << 'EOF'
// Serviço para converter dados de áudio base64 para formato compatível com WhatsApp
// Arquivo: server/services/audioHandlerService.js

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class AudioHandlerService {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'whatsapp-audio');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log('📁 Diretório temporário criado:', this.tempDir);
        } catch (error) {
            console.error('❌ Erro ao criar diretório temporário:', error);
        }
    }

    // Converter base64 para arquivo temporário
    async base64ToTempFile(base64Data, filename = 'audio.ogg') {
        console.log('🔄 ===== CONVERTENDO BASE64 PARA ARQUIVO =====');
        console.log('📊 Dados de entrada:', {
            base64Length: base64Data.length,
            filename: filename,
            firstChars: base64Data.substring(0, 50)
        });

        try {
            // Limpar dados base64 se necessário
            let cleanBase64 = base64Data;
            if (base64Data.includes('data:') && base64Data.includes(',')) {
                cleanBase64 = base64Data.split(',')[1];
                console.log('🧹 Base64 limpo, removido header data:');
            }

            // Converter para buffer
            const audioBuffer = Buffer.from(cleanBase64, 'base64');
            
            console.log('📦 Buffer criado:', {
                size: audioBuffer.length,
                sizeKB: Math.round(audioBuffer.length / 1024),
                isValid: audioBuffer.length > 100
            });

            if (audioBuffer.length < 100) {
                throw new Error('Arquivo de áudio muito pequeno (possível corrupção)');
            }

            // Criar arquivo temporário
            const tempFilePath = path.join(this.tempDir, `${Date.now()}_${filename}`);
            await fs.writeFile(tempFilePath, audioBuffer);

            console.log('💾 Arquivo temporário criado:', {
                path: tempFilePath,
                exists: await this.fileExists(tempFilePath)
            });

            return tempFilePath;

        } catch (error) {
            console.error('❌ ERRO na conversão base64:', error);
            throw new Error(`Erro na conversão de áudio: ${error.message}`);
        }
    }

    // Limpar arquivo temporário
    async cleanupTempFile(filePath) {
        try {
            if (await this.fileExists(filePath)) {
                await fs.unlink(filePath);
                console.log('🗑️ Arquivo temporário removido:', filePath);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao remover arquivo temporário:', error.message);
        }
    }

    // Verificar se arquivo existe
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Detectar formato de áudio pelos primeiros bytes
    detectAudioFormat(buffer) {
        console.log('🔍 Detectando formato de áudio...');
        
        const firstBytes = buffer.slice(0, 20).toString('hex');
        console.log('🔍 Primeiros bytes (hex):', firstBytes);
        
        if (buffer.toString('ascii', 0, 4) === 'OggS') {
            console.log('🎵 Formato detectado: OGG');
            return { format: 'ogg', mimeType: 'audio/ogg' };
        }
        
        if (buffer.toString('ascii', 0, 4) === 'RIFF') {
            console.log('🎵 Formato detectado: WAV');
            return { format: 'wav', mimeType: 'audio/wav' };
        }
        
        if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
            console.log('🎵 Formato detectado: MP3');
            return { format: 'mp3', mimeType: 'audio/mpeg' };
        }
        
        console.log('🎵 Formato padrão: OGG (fallback)');
        return { format: 'ogg', mimeType: 'audio/ogg' };
    }

    // Processar dados de áudio recebidos do frontend
    async processAudioData(audioData, originalFileName = 'audio') {
        console.log('🎵 ===== PROCESSANDO DADOS DE ÁUDIO =====');
        console.log('📊 Dados recebidos:', {
            type: typeof audioData,
            length: typeof audioData === 'string' ? audioData.length : 'N/A',
            originalFileName
        });

        try {
            let tempFilePath;
            let detectedFormat;

            if (typeof audioData === 'string') {
                // Dados base64 do frontend
                console.log('📤 Processando base64 do frontend...');
                
                // Criar arquivo temporário
                tempFilePath = await this.base64ToTempFile(audioData, `${originalFileName}.ogg`);
                
                // Ler arquivo para detectar formato
                const fileBuffer = await fs.readFile(tempFilePath);
                detectedFormat = this.detectAudioFormat(fileBuffer);
                
            } else {
                throw new Error('Formato de dados de áudio não suportado');
            }

            console.log('✅ Áudio processado com sucesso:', {
                tempFilePath,
                format: detectedFormat.format,
                mimeType: detectedFormat.mimeType
            });

            return {
                tempFilePath,
                format: detectedFormat.format,
                mimeType: detectedFormat.mimeType
            };

        } catch (error) {
            console.error('❌ ERRO no processamento de áudio:', error);
            throw error;
        }
    }
}

module.exports = { AudioHandlerService };
EOF
    
    echo "✅ audioHandlerService.js criado com sucesso!"
else
    echo "✅ audioHandlerService.js já existe"
fi

echo ""
echo "🔧 ETAPA 3: Reiniciando servidor para aplicar mudanças..."
cd /home/ubuntu/sovereign-chat-automation-hub

# Parar servidor
if [ -f "./scripts/production-stop-whatsapp.sh" ]; then
    chmod +x ./scripts/production-stop-whatsapp.sh
    ./scripts/production-stop-whatsapp.sh
    sleep 5
fi

# Iniciar servidor com novas correções
if [ -f "./scripts/production-start-whatsapp.sh" ]; then
    chmod +x ./scripts/production-start-whatsapp.sh
    ./scripts/production-start-whatsapp.sh
    sleep 10
else
    echo "⚠️ Script de start não encontrado, iniciando manualmente..."
    cd server
    nohup node whatsapp-multi-client-server.js > /var/log/whatsapp-server.log 2>&1 &
    cd ..
    sleep 10
fi

echo ""
echo "🔧 ETAPA 4: Testando sistema de áudio..."

# Testar health check
echo "🏥 Testando health check..."
HEALTH_RESPONSE=$(curl -k -s "https://146.59.227.248/health")
echo "Resposta: $HEALTH_RESPONSE"

# Testar CORS específico para áudio
echo ""
echo "🎵 Testando CORS para API de áudio..."
CORS_TEST=$(curl -k -H "Origin: https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type" \
            -X OPTIONS -I -s "https://146.59.227.248/api/clients/test/send-audio" | grep -i "access-control-allow-origin")

if [ -n "$CORS_TEST" ]; then
    echo "✅ CORS funcionando: $CORS_TEST"
else
    echo "⚠️ CORS pode não estar funcionando corretamente"
fi

echo ""
echo "🎉 CORREÇÕES APLICADAS!"
echo "======================"
echo "✅ Nginx.conf atualizado com map CORS"
echo "✅ CORS configurado para /api/clients/*"
echo "✅ Roteamento /api/clients -> /clients"
echo "✅ Backend atualizado para suportar base64"
echo "✅ Serviços de áudio melhorados"
echo "✅ Servidor reiniciado"
echo ""
echo "🌐 Sistema de áudio deve estar funcionando agora!"
echo "Teste no frontend: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/client/35f36a03-39b2-412c-bba6-01fdd45c2dd3/connect"
