// 📄 TESTE FALLBACK DOCUMENTO - Verificar se upload de documentos funciona
// Objetivo: Isolar se o problema é específico do tipo "audio"

const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

async function testarFallbackDocumento(client, chatId) {
  console.log('📄 ===== TESTE FALLBACK DOCUMENTO =====');
  
  try {
    // Criar arquivo de teste temporário
    const testFilePath = '/tmp/test-document.txt';
    const testContent = `Teste de upload de documento\nData: ${new Date().toISOString()}\nObjetivo: Verificar se uploads funcionam`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Arquivo de teste criado:', testFilePath);
    
    // TESTE 1: MessageMedia.fromFilePath com documento
    console.log('\n🎯 TESTE 1: MessageMedia.fromFilePath (documento)');
    try {
      const media = MessageMedia.fromFilePath(testFilePath);
      console.log('📦 MessageMedia criado:', {
        mimetype: media.mimetype,
        filename: media.filename,
        data: media.data ? `${media.data.length} chars` : 'N/A'
      });
      
      const result = await client.sendMessage(chatId, media, {
        caption: '📄 Teste de documento via fromFilePath'
      });
      
      console.log('✅ TESTE 1: SUCESSO - Documento enviado:', result.id._serialized);
      
    } catch (error) {
      console.error('❌ TESTE 1: FALHOU -', error.message);
      if (error.message.includes('Evaluation failed')) {
        console.error('🚨 MESMO ERRO "Evaluation failed" detectado com documento!');
      }
    }
    
    // TESTE 2: MessageMedia constructor com base64
    console.log('\n🎯 TESTE 2: MessageMedia constructor (base64)');
    try {
      const fileBuffer = fs.readFileSync(testFilePath);
      const base64 = fileBuffer.toString('base64');
      
      const media = new MessageMedia('text/plain', base64, 'test-document.txt');
      console.log('📦 MessageMedia criado:', {
        mimetype: media.mimetype,
        filename: media.filename,
        data: media.data ? `${media.data.length} chars` : 'N/A'
      });
      
      const result = await client.sendMessage(chatId, media, {
        caption: '📄 Teste de documento via constructor'
      });
      
      console.log('✅ TESTE 2: SUCESSO - Documento enviado:', result.id._serialized);
      
    } catch (error) {
      console.error('❌ TESTE 2: FALHOU -', error.message);
      if (error.message.includes('Evaluation failed')) {
        console.error('🚨 MESMO ERRO "Evaluation failed" detectado com documento!');
      }
    }
    
    // TESTE 3: Mensagem simples (controle)
    console.log('\n🎯 TESTE 3: Mensagem simples (controle)');
    try {
      const result = await client.sendMessage(chatId, '📝 Teste de mensagem simples para verificar se client funciona');
      console.log('✅ TESTE 3: SUCESSO - Mensagem enviada:', result.id._serialized);
      
    } catch (error) {
      console.error('❌ TESTE 3: FALHOU -', error.message);
      if (error.message.includes('Evaluation failed')) {
        console.error('🚨 PROBLEMA GRAVE: Até mensagens simples falham com "Evaluation failed"!');
      }
    }
    
    // Limpar arquivo de teste
    try {
      fs.unlinkSync(testFilePath);
      console.log('\n🗑️ Arquivo de teste removido');
    } catch (error) {
      console.warn('⚠️ Não foi possível remover arquivo de teste:', error.message);
    }
    
    console.log('\n📊 ===== ANÁLISE DOS RESULTADOS =====');
    console.log('Se TODOS os testes falharam com "Evaluation failed":');
    console.log('  🚨 O problema é NO PUPPETEER/CHROME, não nas APIs do whatsapp-web.js');
    console.log('  🔧 Soluções: verificar argumentos do Puppeteer, memória, permissões');
    console.log('');
    console.log('Se apenas ÁUDIO falha:');
    console.log('  🎵 O problema é específico do processamento de áudio');
    console.log('  🔧 Soluções: verificar codecs, formatos, tamanho do arquivo');
    console.log('');
    console.log('Se DOCUMENTOS funcionam mas ÁUDIO não:');
    console.log('  📄 Upload básico funciona, problema na conversão/processamento de áudio');
    console.log('  🔧 Soluções: ajustar formato, usar diferentes estratégias de áudio');
    
  } catch (error) {
    console.error('💥 ERRO GERAL NO TESTE:', error.message);
    console.error(error.stack);
  }
}

module.exports = { testarFallbackDocumento };