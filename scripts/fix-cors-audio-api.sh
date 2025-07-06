
#!/bin/bash

# Script para corrigir CORS especificamente para APIs de áudio
# Arquivo: scripts/fix-cors-audio-api.sh

echo "🔧 CORREÇÃO CORS PARA SISTEMA DE ÁUDIO"
echo "====================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-cors-audio-api.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Problemas identificados:"
echo "• CORS bloqueando /api/clients/*/send-audio"
echo "• Rota /api/clients não configurada no Nginx"
echo "• Frontend usando /api/clients, backend esperando /clients"
echo ""

echo "🔧 Atualizando configuração Nginx para suportar /api/*..."

# Criar configuração Nginx com suporte para /api/clients
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - COM SUPORTE PARA /api/clients
server {
    listen 443 ssl;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Global settings
    client_max_body_size 50M;
    proxy_buffering off;
    
    # CORS: Configure origem permitida
    map $http_origin $cors_origin {
        default "";
        "~^https://19c6b746-780c-41f1-97e3-86e1c8f2c488\.lovableproject\.com$" "https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com";
        "~^https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488\.lovable\.app$" "https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app";
        "~^https://146\.59\.227\.248$" "https://146.59.227.248";
    }
    
    # 1. HEALTH CHECK - Primeira prioridade
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Max-Age 86400 always;
    }
    
    # 2. WEBSOCKET - Segunda prioridade
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # Headers críticos WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Credentials true always;
    }
    
    # 3. API CLIENTS - NOVA ROTA PARA ÁUDIO - Terceira prioridade
    location ~ ^/api/clients {
        # Handle preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $cors_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        # Reescrever /api/clients para /clients no backend
        rewrite ^/api/clients/(.*)$ /clients/$1 break;
        
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 4. CLIENTS DIRETO - Quarta prioridade
    location ~ ^/clients {
        # Handle preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $cors_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 5. API DOCS - Quinta prioridade
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 6. FRONTEND - Última prioridade (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log warn;
}
EOF

echo "🧪 Testando configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Aplicando..."
    systemctl reload nginx
    sleep 3
    
    echo "🔍 Testando CORS após correção..."
    
    # Testar rota de áudio especificamente
    echo "Teste CORS API Audio:"
    curl -k -H "Origin: https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app" \
         -H "Access-Control-Request-Method: POST" \
         -H "Access-Control-Request-Headers: Content-Type" \
         -X OPTIONS -I "https://$DOMAIN/api/clients/test/send-audio" 2>/dev/null | grep -i "access-control"
    
    echo ""
    echo "🎉 CORS PARA SISTEMA DE ÁUDIO CORRIGIDO!"
    echo "======================================="
    echo "✅ Rota /api/clients/* adicionada"
    echo "✅ Rewrite /api/clients -> /clients configurado"
    echo "✅ CORS configurado para domínios Lovable"
    echo "✅ Suporte para preflight OPTIONS"
    
    echo ""
    echo "🌐 Rotas de áudio agora funcionais:"
    echo "• Frontend: /api/clients/INSTANCE/send-audio"
    echo "• Backend: /clients/INSTANCE/send-audio (automático)"
    
else
    echo "❌ Erro na configuração Nginx!"
    exit 1
fi
EOF

Now, I need to update the backend server to properly handle base64 audio data in the send-audio endpoint:

<lov-write file_path="server/services/audioHandlerService.js">
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
