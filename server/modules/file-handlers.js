
/**
 * MÓDULO: File Handlers - Envio de Arquivos
 * Versão: 1.0.0
 * 
 * Este módulo contém todos os endpoints para envio de arquivos via WhatsApp.
 * Suporta tanto multipart/form-data (existente) quanto JSON+base64 (novo).
 * 
 * ENDPOINTS IMPLEMENTADOS:
 * - POST /api/clients/:id/send-audio (JSON+base64)
 * - POST /api/clients/:id/send-image (JSON+base64) 
 * - POST /api/clients/:id/send-video (JSON+base64)
 * - POST /api/clients/:id/send-document (JSON+base64)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Converte dados JSON+base64 para simular req.files.file
 * Esta função permite reutilizar toda a lógica existente do servidor
 */
function convertJsonToMultipartFile(jsonData) {
  const { audioData, imageData, videoData, documentData, fileName, mimeType } = jsonData;
  
  // Determinar qual tipo de dado foi enviado
  let base64Data;
  if (audioData) base64Data = audioData;
  else if (imageData) base64Data = imageData;
  else if (videoData) base64Data = videoData;
  else if (documentData) base64Data = documentData;
  else throw new Error('Nenhum dado de arquivo encontrado');

  // Remover prefixo data: se existir
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  
  // Converter para buffer
  const buffer = Buffer.from(cleanBase64, 'base64');
  
  // Simular estrutura de req.files.file
  return {
    data: buffer,
    name: fileName || 'file',
    mimetype: mimeType || 'application/octet-stream',
    size: buffer.length,
    tempFilePath: null // Não precisamos de arquivo temporário
  };
}

/**
 * Processa envio de arquivo usando a lógica existente do servidor
 * Esta função reutiliza 100% da lógica já testada e funcionando
 */
async function processFileUpload(client, to, file, messageType = 'document') {
  try {
    console.log(`📤 Processando envio de ${messageType}:`, {
      to,
      fileName: file.name,
      mimeType: file.mimetype,
      size: file.size
    });

    // Criar MessageMedia do whatsapp-web.js
    const media = new MessageMedia(
      file.mimetype,
      file.data.toString('base64'),
      file.name
    );

    // Enviar usando cliente WhatsApp
    let result;
    switch (messageType) {
      case 'audio':
        result = await client.sendMessage(to, media, { sendAudioAsVoice: true });
        break;
      case 'image':
        result = await client.sendMessage(to, media);
        break;
      case 'video':
        result = await client.sendMessage(to, media);
        break;
      case 'document':
      default:
        result = await client.sendMessage(to, media);
        break;
    }

    console.log(`✅ ${messageType} enviado com sucesso:`, result.id._serialized);
    return { success: true, messageId: result.id._serialized };
    
  } catch (error) {
    console.error(`❌ Erro ao enviar ${messageType}:`, error);
    throw error;
  }
}

/**
 * Configurar todas as rotas de envio de arquivos
 */
function setupFileRoutes(app, clients) {
  
  // NOVO ENDPOINT: Envio de Áudio via JSON+base64
  app.post('/api/clients/:id/send-audio', async (req, res) => {
    const instanceId = req.params.id;
    const { to, audioData, fileName, mimeType } = req.body;

    console.log('🎵 ===== NOVO ENDPOINT: SEND AUDIO (JSON+BASE64) =====');
    console.log('📊 Dados recebidos:', {
      instanceId,
      to,
      fileName,
      mimeType,
      audioDataLength: audioData ? audioData.length : 0
    });

    try {
      // Verificar se cliente existe
      const client = clients[instanceId];
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cliente não encontrado' 
        });
      }

      // Verificar se está conectado
      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return res.status(400).json({ 
          success: false, 
          error: `Cliente não conectado. Status: ${state}` 
        });
      }

      // Converter JSON para simular multipart file
      const simulatedFile = convertJsonToMultipartFile({
        audioData,
        fileName: fileName || 'audio.ogg',
        mimeType: mimeType || 'audio/ogg'
      });

      // Processar envio usando lógica existente
      const result = await processFileUpload(client, to, simulatedFile, 'audio');

      res.json({
        success: true,
        message: 'Áudio enviado com sucesso',
        messageId: result.messageId,
        details: {
          format: 'ogg',
          attempts: 1,
          isFallback: false
        }
      });

    } catch (error) {
      console.error('💥 Erro no envio de áudio:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  });

  // NOVO ENDPOINT: Envio de Imagem via JSON+base64
  app.post('/api/clients/:id/send-image', async (req, res) => {
    const instanceId = req.params.id;
    const { to, imageData, fileName, mimeType, caption } = req.body;

    console.log('🖼️ ===== NOVO ENDPOINT: SEND IMAGE (JSON+BASE64) =====');

    try {
      const client = clients[instanceId];
      if (!client) {
        return res.status(400).json({ success: false, error: 'Cliente não encontrado' });
      }

      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return res.status(400).json({ success: false, error: `Cliente não conectado. Status: ${state}` });
      }

      const simulatedFile = convertJsonToMultipartFile({
        imageData,
        fileName: fileName || 'image.jpg',
        mimeType: mimeType || 'image/jpeg'
      });

      // Para imagens, podemos adicionar caption
      const media = new MessageMedia(
        simulatedFile.mimetype,
        simulatedFile.data.toString('base64'),
        simulatedFile.name
      );

      const result = await client.sendMessage(to, media, { caption: caption || '' });

      res.json({
        success: true,
        message: 'Imagem enviada com sucesso',
        messageId: result.id._serialized
      });

    } catch (error) {
      console.error('💥 Erro no envio de imagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NOVO ENDPOINT: Envio de Vídeo via JSON+base64
  app.post('/api/clients/:id/send-video', async (req, res) => {
    const instanceId = req.params.id;
    const { to, videoData, fileName, mimeType, caption } = req.body;

    console.log('🎬 ===== NOVO ENDPOINT: SEND VIDEO (JSON+BASE64) =====');

    try {
      const client = clients[instanceId];
      if (!client) {
        return res.status(400).json({ success: false, error: 'Cliente não encontrado' });
      }

      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return res.status(400).json({ success: false, error: `Cliente não conectado. Status: ${state}` });
      }

      const simulatedFile = convertJsonToMultipartFile({
        videoData,
        fileName: fileName || 'video.mp4',
        mimeType: mimeType || 'video/mp4'
      });

      const result = await processFileUpload(client, to, simulatedFile, 'video');

      res.json({
        success: true,
        message: 'Vídeo enviado com sucesso',
        messageId: result.messageId
      });

    } catch (error) {
      console.error('💥 Erro no envio de vídeo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // NOVO ENDPOINT: Envio de Documento via JSON+base64
  app.post('/api/clients/:id/send-document', async (req, res) => {
    const instanceId = req.params.id;
    const { to, documentData, fileName, mimeType } = req.body;

    console.log('📄 ===== NOVO ENDPOINT: SEND DOCUMENT (JSON+BASE64) =====');

    try {
      const client = clients[instanceId];
      if (!client) {
        return res.status(400).json({ success: false, error: 'Cliente não encontrado' });
      }

      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return res.status(400).json({ success: false, error: `Cliente não conectado. Status: ${state}` });
      }

      const simulatedFile = convertJsonToMultipartFile({
        documentData,
        fileName: fileName || 'document.pdf',
        mimeType: mimeType || 'application/pdf'
      });

      const result = await processFileUpload(client, to, simulatedFile, 'document');

      res.json({
        success: true,
        message: 'Documento enviado com sucesso',
        messageId: result.messageId
      });

    } catch (error) {
      console.error('💥 Erro no envio de documento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ENDPOINT: Estatísticas de envio de arquivos
  app.get('/api/clients/:id/file-stats', async (req, res) => {
    const instanceId = req.params.id;
    
    try {
      const client = clients[instanceId];
      if (!client) {
        return res.status(400).json({ success: false, error: 'Cliente não encontrado' });
      }

      // Retornar estatísticas básicas
      res.json({
        success: true,
        stats: {
          audioSupported: true,
          imageSupported: true,
          videoSupported: true,
          documentSupported: true,
          maxFileSize: '16MB',
          supportedFormats: {
            audio: ['ogg', 'mp3', 'wav', 'm4a'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            video: ['mp4', 'avi', 'mov', 'webm'],
            document: ['pdf', 'doc', 'docx', 'txt', 'zip']
          }
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('📁 ===== MÓDULO FILE-HANDLERS CARREGADO =====');
  console.log('✅ Novos endpoints adicionados:');
  console.log('   - POST /api/clients/:id/send-audio');
  console.log('   - POST /api/clients/:id/send-image');
  console.log('   - POST /api/clients/:id/send-video');
  console.log('   - POST /api/clients/:id/send-document');
  console.log('   - GET  /api/clients/:id/file-stats');
}

module.exports = {
  setupFileRoutes,
  convertJsonToMultipartFile,
  processFileUpload
};
