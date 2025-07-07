
// server/whatsapp-multi-client-server-modular.js - Arquivo principal modular
// Sistema WhatsApp Multi-Cliente - Versão Modular
// Todas as funcionalidades preservadas, código organizado em módulos

const { initializeServer } = require('./modules/server-startup');

// Inicializar servidor com todos os módulos
async function main() {
  try {
    console.log('🔥 WHATSAPP MULTI-CLIENT - VERSÃO MODULAR');
    console.log('=' .repeat(60));
    console.log('📦 Carregando módulos especializados...');
    console.log('⚡ Funcionalidade 100% preservada');
    console.log('🔧 Código organizado e modular');
    console.log('=' .repeat(60));
    
    // Inicializar servidor com todos os módulos integrados
    const { server, port } = await initializeServer();
    
    console.log('\n✨ Sistema modular inicializado com sucesso!');
    console.log(`🎯 Todos os recursos disponíveis na porta ${port}`);
    
    return { server, port };
    
  } catch (error) {
    console.error('💥 Falha na inicialização do sistema modular:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Erro crítico:', error);
    process.exit(1);
  });
}

module.exports = { main };
