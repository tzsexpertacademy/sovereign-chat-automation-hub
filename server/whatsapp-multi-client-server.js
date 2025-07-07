
// server/whatsapp-multi-client-server.js - Sistema WhatsApp Multi-Cliente
// VERSÃO MODULAR ATIVA - Migração segura concluída
// Para rollback: ./scripts/rollback-from-modular.sh

const { main } = require('./whatsapp-multi-client-server-modular');

// Log de inicialização da versão modular
console.log('🔥 WHATSAPP MULTI-CLIENT - VERSÃO MODULAR ATIVA');
console.log('📁 Arquivo original preservado como backup');
console.log('🔄 Para rollback: ./scripts/rollback-from-modular.sh');
console.log('=' .repeat(60));

// Executar sistema modular
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Erro crítico no sistema modular:', error);
    console.log('🔄 Para rollback: ./scripts/rollback-from-modular.sh');
    process.exit(1);
  });
}

module.exports = { main };
