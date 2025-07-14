
// server/modules/server-startup.js - Inicialização do servidor
const { 
  express, 
  cors, 
  fileUpload, 
  swaggerJSDoc, 
  swaggerUi, 
  http,
  Server,
  PORT,
  corsOptions,
  socketOptions,
  fileUploadOptions,
  swaggerOptions
} = require('./config');

const { setupWebSocketHandlers, setupAutoCleanup } = require('./websocket');
const { setupApiRoutes } = require('./api-routes');
const { ensureDirectoryExists, cleanupTempFiles } = require('./utils');
const { fs, path } = require('./config');

// Função para inicializar o servidor
async function initializeServer() {
  console.log('🚀 Iniciando servidor WhatsApp Multi-Cliente...');
  
  // Criar app Express
  const app = express();
  
  // Criar servidor HTTP
  const server = http.createServer(app);
  
  // Inicializar Socket.IO
  const io = new Server(server, socketOptions);
  
  // Configurar middlewares
  setupMiddlewares(app);
  
  // Configurar documentação Swagger
  setupSwagger(app);
  
  // Configurar WebSocket
  setupWebSocketHandlers(io);
  setupAutoCleanup(io);
  
  // Configurar rotas da API
  setupApiRoutes(app, io);
  
  // Configurar diretórios necessários
  setupDirectories();
  
  // Configurar limpeza periódica
  setupPeriodicCleanup();
  
  // Iniciar servidor
  return await startServer(server);
}

// Configurar middlewares do Express
function setupMiddlewares(app) {
  console.log('⚙️ Configurando middlewares...');
  
  // CORS
  app.use(cors(corsOptions));
  
  // Body parsing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // File upload
  app.use(fileUpload(fileUploadOptions));
  
  // Headers de segurança
  app.use((req, res, next) => {
    res.header('X-Powered-By', 'WhatsApp Multi-Client API');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    next();
  });
  
  // Log de requisições
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📥 ${timestamp} ${req.method} ${req.path}`);
    next();
  });
  
  console.log('✅ Middlewares configurados');
}

// Configurar documentação Swagger
function setupSwagger(app) {
  console.log('📚 Configurando documentação Swagger...');
  
  try {
    const specs = swaggerJSDoc(swaggerOptions);
    
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'WhatsApp Multi-Client API',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true
      }
    }));
    
    console.log('✅ Swagger configurado em /api-docs');
  } catch (error) {
    console.error('❌ Erro ao configurar Swagger:', error);
  }
}

// Configurar diretórios necessários
function setupDirectories() {
  console.log('📁 Configurando diretórios...');
  
  const directories = [
    path.join(__dirname, '..', 'sessions'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'temp'),
    '/tmp/whatsapp-uploads'
  ];
  
  directories.forEach(dir => {
    ensureDirectoryExists(dir);
  });
  
  console.log('✅ Diretórios configurados');
}

// Configurar limpeza periódica
function setupPeriodicCleanup() {
  console.log('🧹 Configurando limpeza periódica...');
  
  // Limpar arquivos temporários a cada 30 minutos
  setInterval(() => {
    cleanupTempFiles('/tmp/');
    cleanupTempFiles(path.join(__dirname, '..', 'temp'));
  }, 30 * 60 * 1000);
  
  console.log('✅ Limpeza periódica configurada');
}

// Iniciar servidor HTTP
function startServer(server) {
  return new Promise((resolve, reject) => {
    try {
      server.listen(PORT, () => {
        console.log('\n🎉 SERVIDOR INICIADO COM SUCESSO!');
        console.log('=' .repeat(50));
        console.log(`🌐 Servidor rodando na porta: ${PORT}`);
        console.log(`📚 Documentação Swagger: http://localhost:${PORT}/api-docs`);
        console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
        console.log(`🔌 WebSocket disponível na mesma porta`);
        console.log('=' .repeat(50));
        
        // Configurar handlers de processo
        setupProcessHandlers(server);
        
        resolve({ server, port: PORT });
      });
      
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Porta ${PORT} já está em uso!`);
        } else {
          console.error('❌ Erro ao iniciar servidor:', error);
        }
        reject(error);
      });
      
    } catch (error) {
      console.error('💥 Erro crítico na inicialização:', error);
      reject(error);
    }
  });
}

// Configurar handlers de processo
function setupProcessHandlers(server) {
  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`\n⚠️ Sinal ${signal} recebido, iniciando desligamento gracioso...`);
    
    server.close(() => {
      console.log('✅ Servidor HTTP fechado');
      
      // Fechar clientes WhatsApp
      // (será implementado quando os clientes estiverem disponíveis)
      
      console.log('👋 Desligamento concluído');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      console.error('❌ Forçando desligamento após timeout');
      process.exit(1);
    }, 30000);
  };
  
  // Escutar sinais de término
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Tratar erros não capturados
  process.on('uncaughtException', (error) => {
    console.error('💥 Erro não capturado:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Promise rejeitada não tratada:', reason);
    console.error('Promise:', promise);
    gracefulShutdown('unhandledRejection');
  });
  
  console.log('✅ Handlers de processo configurados');
}

module.exports = {
  initializeServer,
  setupMiddlewares,
  setupSwagger,
  setupDirectories,
  setupPeriodicCleanup,
  startServer,
  setupProcessHandlers
};
