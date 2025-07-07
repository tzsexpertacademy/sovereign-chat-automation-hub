
// server/modules/config.js - Configurações corrigidas e validadas
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

// Configurações do servidor com validação
const PORT = process.env.PORT || 4000;

// Credenciais Supabase CORRIGIDAS
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymygyagbvbsdfkduxmgu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.x9kJjmvyoGaB1e_tBfmSV8Z8eM6t_0WdGqF4_rMwKDI';

// Validar credenciais críticas na inicialização
function validateCredentials() {
  console.log('🔍 Validando credenciais...');
  
  if (!SUPABASE_URL) {
    console.error('❌ SUPABASE_URL não configurada');
    process.exit(1);
  }
  
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY não configurada');
    process.exit(1);
  }
  
  console.log('✅ Credenciais validadas com sucesso');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
}

// Executar validação
validateCredentials();

// Configuração do Swagger atualizada
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Client API - CORRIGIDA',
      version: '2.0.0',
      description: 'API para gerenciar múltiplas instâncias do WhatsApp - Sistema Modular Corrigido',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desenvolvimento',
      },
      {
        url: 'https://146.59.227.248',
        description: 'Servidor de produção',
      },
    ],
  },
  apis: ['./modules/*.js', './whatsapp-multi-client-server-modular.js'],
};

// Configurações do Express aprimoradas
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://whatsapp-multi-client.lovable.app',
    'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
    'https://ymygyagbvbsdfkduxmgu.supabase.co'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Configurações do Socket.IO aprimoradas
const socketOptions = {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
  upgradeTimeout: 10000
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

// Função para criar diretórios necessários
function createRequiredDirectories() {
  const directories = [
    path.join(__dirname, '..', 'sessions'),
    path.join(__dirname, '..', 'logs'),
    path.join(__dirname, '..', '..', 'logs')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Diretório criado: ${dir}`);
    }
  });
}

// Executar criação de diretórios
createRequiredDirectories();

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
  fileUploadOptions,
  validateCredentials,
  createRequiredDirectories
};
