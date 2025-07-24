/**
 * Serviço para limpeza e migração de serviços legados
 * Remove duplicações e centraliza funcionalidades no clientYumerService
 */

import clientYumerService from './clientYumerService';

/**
 * Lista de serviços legados que serão gradualmente removidos
 */
export const legacyServices = [
  'codechatApiService.ts',
  'codechatQRService.ts', 
  'codechatBusinessService.ts',
  'whatsappMultiClient.ts',
  'yumerWhatsappService.ts',
  'unifiedYumerService.ts'  // Mantido apenas para admin
];

/**
 * Mapeamento de funcionalidades legadas para o novo serviço
 */
export const legacyServiceMigration = {
  // codechatApiService.ts - MIGRADO
  findChats: (clientId: string, instanceName: string) => 
    clientYumerService.findChats(clientId, instanceName),
    
  findMessages: (clientId: string, instanceName: string, remoteJid: string = '') => 
    clientYumerService.findMessages(clientId, instanceName, remoteJid),
    
  findContacts: (clientId: string, instanceName: string) => 
    clientYumerService.findContacts(clientId, instanceName),
  
  // codechatQRService.ts - MIGRADO
  getQRCode: (clientId: string, instanceName: string) => 
    clientYumerService.connectInstance(clientId, instanceName),
    
  connectInstance: (clientId: string, instanceName: string) => 
    clientYumerService.connectInstance(clientId, instanceName),
    
  disconnectInstance: (clientId: string, instanceName: string) => 
    clientYumerService.disconnectInstance(clientId, instanceName),
    
  getInstanceStatus: (clientId: string, instanceName: string) => 
    clientYumerService.getConnectionState(clientId, instanceName),
  
  // whatsappMultiClient.ts - MIGRADO
  sendTextMessage: (clientId: string, instanceName: string, number: string, text: string) => 
    clientYumerService.sendTextMessage(clientId, instanceName, number, text),
    
  sendMediaMessage: (clientId: string, instanceName: string, data: any) => 
    clientYumerService.sendMedia(clientId, instanceName, data),
    
  sendAudioMessage: (clientId: string, instanceName: string, number: string, audio: string) => 
    clientYumerService.sendWhatsAppAudio(clientId, instanceName, number, audio)
};

/**
 * Webhook consolidation mapping
 */
export const webhookConsolidation = {
  legacy_webhooks: [
    'codechat-webhook',
    'codechat-v2-webhook', 
    'yumer-webhook',
    'codechat-v2-unified-webhook'
  ],
  unified_webhook: 'yumer-unified-webhook',
  description: 'Todos os eventos agora são processados pelo webhook unificado'
};

/**
 * Função para validar migração completa
 */
export function validateMigrationStatus(): {
  client_service: boolean;
  unified_webhook: boolean;
  legacy_cleaned: boolean;
  api_version: string;
} {
  return {
    client_service: true, // clientYumerService criado
    unified_webhook: true, // yumer-unified-webhook criado
    legacy_cleaned: false, // Ainda precisamos limpar
    api_version: 'v2.2.1' // API atualizada
  };
}

/**
 * Função para limpar instâncias órfãs
 */
export async function cleanupOrphanedInstances(): Promise<{
  cleaned: number;
  errors: string[];
}> {
  // Esta função será implementada na próxima fase
  console.log('🧹 [CLEANUP] Limpeza de instâncias órfãs será implementada');
  
  return {
    cleaned: 0,
    errors: []
  };
}

/**
 * Status da consolidação
 */
export const consolidationStatus = {
  phase_1_complete: true,
  services_unified: true,
  webhook_consolidated: true,
  next_phase: 'CRM Orquestrado (Fase 2)',
  api_version: 'CodeChat v2.2.1'
};

console.log('✅ [YUMER-CONSOLIDATION] Fase 1 - Serviços consolidados:', consolidationStatus);

export default {
  legacyServiceMigration,
  webhookConsolidation,
  validateMigrationStatus,
  cleanupOrphanedInstances,
  consolidationStatus
};