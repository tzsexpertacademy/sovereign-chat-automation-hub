// BACKUP COMPLETO - whatsapp-web.js 1.21.0
// Este é o backup do servidor funcionando com a versão 1.21.0
// Salvo em: ${new Date().toISOString()}

// Import necessary modules
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const uuidv4 = require('uuid').v4;
const mime = require('mime-types');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Swagger configuration options
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WhatsApp Multi Client API',
            version: '1.0.0',
            description: 'API for managing multiple WhatsApp clients',
        },
    },
    apis: ['./whatsapp-multi-client-server.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    debug: false
}));

// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static files
app.use('/files', express.static('files'));

// HTTP server setup
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// WhatsApp clients storage
const clients = {};

// Generate client ID
function generateClientId() {
    return uuidv4();
}

/**
 * @swagger
 * /start-client:
 *   post:
 *     summary: Start a new WhatsApp client
 *     description: Starts a new WhatsApp client and returns a client ID and QR code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The client ID (optional, will be generated if not provided).
 *     responses:
 *       200:
 *         description: Client started successfully. Returns client ID and QR code.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   description: The ID of the client.
 *                 qrCode:
 *                   type: string
 *                   description: The QR code for the client.
 *       500:
 *         description: Failed to start client.
 */
app.post('/start-client', async (req, res) => {
    const clientId = req.body.clientId || generateClientId();

    if (clients[clientId]) {
        return res.status(400).json({ error: 'Client ID already exists' });
    }

    clients[clientId] = { client: null, qrCode: null, connected: false };

    clients[clientId].client = new Client({
        authStrategy: new LocalAuth({ clientId: clientId }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--unhandled-rejections=mode',
                '--disable-dev-shm-usage'
            ],
        }
    });

    clients[clientId].client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Error generating QR code:', err);
                return res.status(500).json({ error: 'Failed to generate QR code' });
            }
            clients[clientId].qrCode = url;
            io.emit('qr', { clientId: clientId, qrCode: url });
            console.log('QR code emitted for client ID:', clientId);
            res.status(200).json({ clientId: clientId, qrCode: url }); // Send the response here
        });
    });

    clients[clientId].client.on('ready', () => {
        clients[clientId].connected = true;
        console.log('Client is ready!');
        io.emit('ready', clientId);
    });

    clients[clientId].client.on('disconnected', (reason) => {
        clients[clientId].connected = false;
        console.log('Client was disconnected: ', reason);
        io.emit('disconnected', clientId);
        // Remove the client after disconnection
        delete clients[clientId];
    });

    clients[clientId].client.on('message', msg => {
        console.log('MESSAGE RECEIVED', msg);
        io.emit('message', { clientId: clientId, message: msg });
    });

    clients[clientId].client.initialize();
});

/**
 * @swagger
 * /get-qr/{clientId}:
 *   get:
 *     summary: Get the QR code for a specific client
 *     description: Retrieves the current QR code for a given client ID.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: The ID of the client.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: The QR code for the client.
 *       404:
 *         description: Client not found.
 */
app.get('/get-qr/:clientId', (req, res) => {
    const clientId = req.params.clientId;
    if (clients[clientId] && clients[clientId].qrCode) {
        res.status(200).json({ qrCode: clients[clientId].qrCode });
    } else {
        res.status(404).json({ error: 'Client not found or QR code not generated' });
    }
});

/**
 * @swagger
 * /send-message:
 *   post:
 *     summary: Send a message to a WhatsApp number
 *     description: Sends a text message to a specified WhatsApp number using a client.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The ID of the client.
 *               number:
 *                 type: string
 *                 description: The WhatsApp number to send the message to.
 *               message:
 *                 type: string
 *                 description: The message to send.
 *     responses:
 *       200:
 *         description: Message sent successfully.
 *       404:
 *         description: Client not found.
 *       500:
 *         description: Failed to send message.
 */
app.post('/send-message', async (req, res) => {
    const clientId = req.body.clientId;
    const number = req.body.number;
    const message = req.body.message;

    if (!clients[clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }

    try {
        await clients[clientId].client.sendMessage(`${number}@c.us`, message);
        res.status(200).json({ status: 'Message sent' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * @swagger
 * /send-media:
 *   post:
 *     summary: Send media to a WhatsApp number
 *     description: Sends media (image, video, document) to a specified WhatsApp number using a client.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: The ID of the client.
 *               number:
 *                 type: string
 *                 description: The WhatsApp number to send the media to.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The media file to send.
 *               caption:
 *                 type: string
 *                 description: The caption for the media (optional).
 *     responses:
 *       200:
 *         description: Media sent successfully.
 *       400:
 *         description: No file uploaded.
 *       404:
 *         description: Client not found.
 *       500:
 *         description: Failed to send media.
 */
app.post('/send-media', async (req, res) => {
    const clientId = req.body.clientId;
    const number = req.body.number;
    const caption = req.body.caption || '';

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }

    if (!clients[clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }

    const file = req.files.file;
    const fileExtension = mime.extension(file.mimetype);
    const filename = `${uuidv4()}.${fileExtension}`;
    const uploadPath = `${__dirname}/files/${filename}`;

    file.mv(uploadPath, async (err) => {
        if (err) {
            console.error('File upload error:', err);
            return res.status(500).json({ error: 'File upload failed' });
        }

        try {
            const media = MessageMedia.fromFilePath(uploadPath);
            await clients[clientId].client.sendMessage(`${number}@c.us`, media, { caption: caption });
            // Delete the file after sending
            fs.unlinkSync(uploadPath);
            res.status(200).json({ status: 'Media sent' });
        } catch (error) {
            console.error('Failed to send media:', error);
            res.status(500).json({ error: 'Failed to send media' });
        }
    });
});

/**
 * @swagger
 * /get-contacts/{clientId}:
 *   get:
 *     summary: Get contacts for a specific client
 *     description: Retrieves the contacts for a given client ID.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: The ID of the client.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   number:
 *                     type: string
 *                     description: The phone number of the contact.
 *                   name:
 *                     type: string
 *                     description: The name of the contact.
 *       404:
 *         description: Client not found.
 *       500:
 *         description: Failed to retrieve contacts.
 */
app.get('/get-contacts/:clientId', async (req, res) => {
    const clientId = req.params.clientId;

    if (!clients[clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }

    try {
        const contacts = await clients[clientId].client.getContacts();
        const formattedContacts = contacts.map(contact => ({
            number: contact.number,
            name: contact.name || contact.pushname || 'Sem nome'
        }));
        res.status(200).json(formattedContacts);
    } catch (error) {
        console.error('Failed to get contacts:', error);
        res.status(500).json({ error: 'Failed to retrieve contacts' });
    }
});

/**
 * @swagger
 * /get-chats/{clientId}:
 *   get:
 *     summary: Get chats for a specific client
 *     description: Retrieves the chats for a given client ID.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: The ID of the client.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chats retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: The ID of the chat.
 *                   name:
 *                     type: string
 *                     description: The name of the chat.
 *       404:
 *         description: Client not found.
 *       500:
 *         description: Failed to retrieve chats.
 */
app.get('/get-chats/:clientId', async (req, res) => {
    const clientId = req.params.clientId;

    if (!clients[clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }

    try {
        const chats = await clients[clientId].client.getChats();
        const formattedChats = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name || chat.id.user
        }));
        res.status(200).json(formattedChats);
    } catch (error) {
        console.error('Failed to get chats:', error);
        res.status(500).json({ error: 'Failed to retrieve chats' });
    }
});

/**
 * @swagger
 * /logout/{clientId}:
 *   post:
 *     summary: Logout a WhatsApp client
 *     description: Logs out a WhatsApp client by its ID.
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: The ID of the client to logout.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client logged out successfully.
 *       404:
 *         description: Client not found.
 *       500:
 *         description: Failed to logout client.
 */
app.post('/logout/:clientId', async (req, res) => {
    const clientId = req.params.clientId;

    if (!clients[clientId]) {
        return res.status(404).json({ error: 'Client not found' });
    }

    try {
        await clients[clientId].client.logout();
        delete clients[clientId];
        res.status(200).json({ status: 'Client logged out' });
    } catch (error) {
        console.error('Failed to logout client:', error);
        res.status(500).json({ error: 'Failed to logout client' });
    }
});

/**
 * @swagger
 * /stop:
 *   get:
 *     summary: Stop the server
 *     description: Stops the server gracefully.
 *     responses:
 *       200:
 *         description: Server stopped successfully.
 */
app.get('/stop', (req, res) => {
    console.log('Stopping server...');
    res.status(200).send('Server stopping...');
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});

// Supabase Storage - Upload Endpoint
app.post('/upload', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.files.file;
    const filePath = `public/${Date.now()}-${file.name}`;

    try {
        const { data, error } = await supabase
            .storage
            .from('your-bucket-name') // Replace with your bucket name
            .upload(filePath, file.data, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).send('Failed to upload to Supabase.');
        }

        const publicURL = `https://your-supabase-url.supabase.co/storage/v1/object/public/${data.Key}`; // Replace with your Supabase URL
        res.json({ url: publicURL });
    } catch (error) {
        console.error('Unexpected error during upload:', error);
        res.status(500).send('Unexpected error during upload.');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Este arquivo serve como backup de segurança da versão 1.21.0
// Em caso de problemas com o upgrade, restaurar este arquivo

console.log('🔄 ARQUIVO DE BACKUP - whatsapp-web.js 1.21.0');
console.log('📅 Backup criado em:', new Date().toISOString());
console.log('⚠️  Este é um backup de segurança. Use apenas se o upgrade falhar.');

// Para restaurar:
// 1. Copie este arquivo para whatsapp-multi-client-server.js
// 2. Execute: npm install whatsapp-web.js@1.21.0 --save
// 3. Reinicie o servidor
