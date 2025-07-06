const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { tmpdir } = require('os');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const clients = new Map();
const qrCodes = new Map();

const { AudioSendService } = require('./services/audioSendService');
const { AudioHandlerService } = require('./services/audioHandlerService');

// Initialize services
const audioSendService = new AudioSendService();
const audioHandlerService = new AudioHandlerService();

io.on('connection', (socket) => {
    console.log('🔥 New connection:', socket.id);

    socket.on('disconnect', () => {
        console.log('💀 Disconnected:', socket.id);
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        clients: clients.size,
        timestamp: new Date().toISOString()
    });
});

app.post('/client/new', async (req, res) => {
    const { clientId } = req.body;

    if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
    }

    if (clients.has(clientId)) {
        return res.status(409).json({ error: 'Client already exists' });
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: clientId }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- May be the reason
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR RECEIVED', qr);
        qrCodes.set(clientId, qr);
        io.emit('qr', { clientId, qr });

        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qr);
            io.emit('qrCodeDataUrl', { clientId, qrCodeDataUrl });
        } catch (error) {
            console.error('Error generating QR code data URL:', error);
            io.emit('qrCodeDataUrl', { clientId, error: 'Failed to generate QR code' });
        }
    });

    client.on('authenticated', (session) => {
        console.log('WHATSAPP WEB => Authenticated', clientId);
        io.emit('authenticated', { clientId });
    });

    client.on('auth_failure', (msg) => {
        console.error('WHATSAPP WEB => Auth failure', clientId, msg);
        io.emit('auth_failure', { clientId, message: msg });
    });

    client.on('ready', () => {
        console.log('WHATSAPP WEB => Ready', clientId);
        clients.set(clientId, client);
        io.emit('ready', { clientId });
    });

    client.on('message', msg => {
        console.log('Message received', clientId, msg.body);
        io.emit('message', { clientId, message: msg });
    });

    client.on('disconnected', (reason) => {
        console.log('Client disconnected', clientId, reason);
        clients.delete(clientId);
        io.emit('disconnected', { clientId, reason });
    });

    client.initialize();

    res.status(200).json({
        success: true,
        clientId: clientId,
        message: 'Client initialized'
    });
});

app.get('/client/:clientId/qr', (req, res) => {
    const { clientId } = req.params;
    const qr = qrCodes.get(clientId);

    if (qr) {
        res.status(200).json({ qr });
    } else {
        res.status(404).json({ error: 'QR code not found' });
    }
});

app.get('/clients', (req, res) => {
    const clientList = Array.from(clients.keys());
    res.status(200).json({ clients: clientList });
});

app.get('/clients/:clientId/status', async (req, res) => {
    const { clientId } = req.params;
    const client = clients.get(clientId);

    if (!client) {
        return res.status(404).json({
            success: false,
            error: 'Client not found'
        });
    }

    try {
        const state = await client.getState();
        res.status(200).json({
            success: true,
            status: state
        });
    } catch (error) {
        console.error('Error getting client state:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get client state'
        });
    }
});

app.delete('/clients/:clientId', (req, res) => {
    const { clientId } = req.params;
    const client = clients.get(clientId);

    if (!client) {
        return res.status(404).json({
            success: false,
            error: 'Client not found'
        });
    }

    client.destroy();
    clients.delete(clientId);
    qrCodes.delete(clientId);

    res.status(200).json({
        success: true,
        message: 'Client deleted'
    });
});

app.post('/clients/:clientId/send', async (req, res) => {
    const { clientId } = req.params;
    const { number, message } = req.body;

    const client = clients.get(clientId);

    if (!client) {
        return res.status(404).json({
            success: false,
            error: 'Client not found'
        });
    }

    try {
        await client.sendMessage(number, message);
        res.status(200).json({
            success: true,
            message: 'Message sent'
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// ENDPOINT ATUALIZADO: Enviar áudio (compatível com base64 do frontend)
app.post('/clients/:clientId/send-audio', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        console.log(`🎵 ===== ENDPOINT SEND-AUDIO ATUALIZADO =====`);
        console.log(`📱 Cliente: ${clientId}`);
        console.log(`📊 Content-Type: ${req.headers['content-type']}`);
        console.log(`📊 Body keys:`, Object.keys(req.body || {}));

        // Verificar se cliente existe e está conectado
        const client = clients.get(clientId);
        if (!client) {
            console.error(`❌ Cliente ${clientId} não encontrado`);
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }

        const state = await client.getState();
        if (state !== 'CONNECTED') {
            console.error(`❌ Cliente ${clientId} não está conectado. Estado: ${state}`);
            return res.status(400).json({
                success: false,
                error: `Cliente não conectado. Estado: ${state}`
            });
        }

        console.log(`✅ Cliente ${clientId} verificado e conectado`);

        // Extrair dados do request (suporta tanto JSON quanto multipart)
        let to, audioData, fileName;

        if (req.headers['content-type']?.includes('application/json')) {
            // Dados JSON com base64 (do frontend)
            console.log('📤 Processando dados JSON com base64...');
            
            const { to: requestTo, audioData: requestAudioData, fileName: requestFileName } = req.body;
            
            if (!requestTo || !requestAudioData) {
                return res.status(400).json({
                    success: false,
                    error: 'Parâmetros obrigatórios: to, audioData'
                });
            }

            to = requestTo;
            audioData = requestAudioData;
            fileName = requestFileName || 'audio';

            console.log('📊 Dados extraídos:', {
                to: to.substring(0, 20) + '...',
                audioDataLength: audioData.length,
                fileName
            });

        } else {
            // Dados multipart (compatibilidade)
            console.log('📤 Processando dados multipart...');
            
            to = req.body.to;
            fileName = req.file?.originalname || 'audio.ogg';
            
            if (req.file) {
                // Converter buffer para base64 para usar o mesmo fluxo
                audioData = req.file.buffer.toString('base64');
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Arquivo de áudio não encontrado'
                });
            }
        }

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Parâmetro "to" é obrigatório'
            });
        }

        console.log(`📤 Enviando áudio para: ${to}`);

        // Processar dados de áudio usando o novo serviço
        const audioProcessingResult = await audioHandlerService.processAudioData(audioData, fileName);
        
        console.log('🔄 Áudio processado:', audioProcessingResult);

        // Enviar áudio usando o serviço de retry
        const result = await audioSendService.sendAudioWithRetry(
            client,
            to,
            audioProcessingResult.tempFilePath,
            fileName
        );

        // Limpar arquivo temporário
        await audioHandlerService.cleanupTempFile(audioProcessingResult.tempFilePath);

        if (result.success) {
            console.log(`✅ Áudio enviado com sucesso para ${to}`);
            res.json({
                success: true,
                message: result.message,
                details: {
                    format: audioProcessingResult.format,
                    attempts: result.attempt,
                    isFallback: result.isFallback || false
                }
            });
        } else {
            console.error(`❌ Falha no envio de áudio para ${to}:`, result.error);
            res.status(500).json({
                success: false,
                error: result.error,
                details: {
                    attempts: result.attempts
                }
            });
        }

    } catch (error) {
        console.error(`💥 ERRO CRÍTICO no endpoint send-audio:`, error);
        res.status(500).json({
            success: false,
            error: `Erro interno: ${error.message}`
        });
    }
});

server.listen(4000, () => {
    console.log('Server is running on port 4000');
});
