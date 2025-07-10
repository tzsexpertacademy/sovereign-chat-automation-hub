
// server/modules/config.js - Configurações e dependências
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const fileUpload = require('express-fileupload');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mime = require('mime-types');

// Configurações do servidor
const PORT = process.env.PORT || 4000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymygyagbvbsdfkduxmgu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.x9kJjmvyoGaB1e_tBfmSV8Z8eM6t_0WdGqF4_rMwKDI';

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Client API',
      version: '1.0.0',
      description: 'API para gerenciar múltiplas instâncias do WhatsApp',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desenvolvimento',
      },
    ],
  },
  apis: ['./whatsapp-multi-client-server.js', './modules/*.js'],
};

// Configurações do Express
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://whatsapp-multi-client.lovable.app',
    'https://ymygyagbvbsdfkduxmgu.supabase.co'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Configurações do Socket.IO
const socketOptions = {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
};

// Configurações do file upload
const fileUploadOptions = {
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  abortOnLimit: true,
  responseOnLimit: 'Arquivo muito grande. Máximo 50MB.',
  useTempFiles: true,
  tempFileDir: '/tmp/',
  parseNested: true
};

module.exports = {
  express,
  Server,
  cors,
  Client,
  LocalAuth,
  QRCode,
  createClient,
  fileUpload,
  swaggerJSDoc,
  swaggerUi,
  fs,
  path,
  http,
  mime,
  PORT,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  swaggerOptions,
  corsOptions,
  socketOptions,
  fileUploadOptions
};
