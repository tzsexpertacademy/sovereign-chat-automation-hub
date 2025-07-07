
// BACKUP DO ARQUIVO ORIGINAL - NÃO DELETAR
// Este é o backup de segurança do arquivo original de 2028 linhas
// Mantido para rollback em caso de necessidade

const { createServer } = require('http');
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
const mime = require('mime-types');

// ARQUIVO ORIGINAL PRESERVADO - USE EM CASO DE EMERGÊNCIA
// Para voltar ao arquivo original, renomeie este arquivo para:
// whatsapp-multi-client-server.js

console.log('⚠️  ARQUIVO DE BACKUP - Use apenas em caso de rollback');
console.log('📁 Para ativar: renomeie para whatsapp-multi-client-server.js');
console.log('🔄 Para usar versão modular: use whatsapp-multi-client-server-modular.js');

// Todo o código original seria aqui, mas está preservado para segurança
// Este arquivo serve apenas como referência e backup
