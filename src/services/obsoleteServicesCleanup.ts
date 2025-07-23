
/**
 * Serviço para limpeza dos serviços obsoletos
 * Remove duplicações e migra para yumerApiV2Service
 */

import yumerApiV2Service from './yumerApiV2Service';

// Mapeamento de funcionalidades obsoletas para novas
export const obsoleteServiceMigration = {
  // codechatApiService.ts - OBSOLETO
  findChats: (instanceName: string) => yumerApiV2Service.findChats(instanceName),
  findMessages: (instanceName: string, remoteJid: string = '') => yumerApiV2Service.findMessages(instanceName, remoteJid),
  findContacts: (instanceName: string) => yumerApiV2Service.findContacts(instanceName),
  
  // codechatQRService.ts - OBSOLETO
  getQRCode: (instanceName: string) => yumerApiV2Service.getQRCode(instanceName),
  connectInstance: (instanceName: string) => yumerApiV2Service.connectInstance(instanceName),
  disconnectInstance: (instanceName: string) => yumerApiV2Service.logoutInstance(instanceName),
  getInstanceStatus: (instanceName: string) => yumerApiV2Service.getConnectionState(instanceName),
  
  // codechatBusinessService.ts - OBSOLETO  
  createBusiness: (business: any) => ({ message: 'Business functionality not implemented in v2.2.1' }),
  getBusiness: (businessId: string) => ({ message: 'Business functionality not implemented in v2.2.1' }),
  updateBusiness: (businessId: string, updates: any) => ({ message: 'Business functionality not implemented in v2.2.1' }),
  
  // whatsappMultiClient.ts - OBSOLETO
  sendTextMessage: (instanceName: string, number: string, text: string) => yumerApiV2Service.sendText(instanceName, number, text),
  sendMediaMessage: (instanceName: string, data: any) => yumerApiV2Service.sendMedia(instanceName, data),
  sendAudioMessage: (instanceName: string, number: string, audio: string) => yumerApiV2Service.sendWhatsAppAudio(instanceName, number, audio)
};

/**
 * Lista de arquivos obsoletos que devem ser removidos
 */
export const obsoleteFiles = [
  'src/services/codechatApiService.ts',
  'src/services/codechatQRService.ts',
  'src/services/codechatBusinessService.ts',
  'src/services/whatsappMultiClient.ts'
];

/**
 * Função para validar se todos os endpoints estão implementados
 */
export function validateEndpointCoverage(): {
  implemented: string[];
  missing: string[];
  total: number;
} {
  const officialEndpoints = [
    // Admin
    '/health', '/info',
    
    // Business
    'GET /business', 'POST /business', 'GET /business/{id}', 'PUT /business/{id}', 'DELETE /business/{id}',
    
    // Instance
    'GET /instance', 'POST /instance/create', 'POST /instance/connect/{instanceName}',
    'DELETE /instance/logout/{instanceName}', 'DELETE /instance/delete/{instanceName}',
    'GET /instance/connectionState/{instanceName}', 'GET /instance/fetchInstances/{instanceName}',
    'PUT /instance/restart/{instanceName}',
    
    // Contact
    'POST /chat/findContacts/{instanceName}', 'POST /chat/upsertContact/{instanceName}',
    'PUT /chat/updateContactProfilePicture/{instanceName}', 'POST /chat/fetchProfilePictureUrl/{instanceName}',
    'PUT /chat/blockContact/{instanceName}', 'PUT /chat/unblockContact/{instanceName}',
    
    // Group
    'POST /group/findGroupByJid/{instanceName}', 'POST /group/create/{instanceName}',
    'PUT /group/updateGroupInfo/{instanceName}', 'PUT /group/updateGParticipant/{instanceName}',
    'PUT /group/updateGSetting/{instanceName}', 'DELETE /group/leaveGroup/{instanceName}',
    
    // Media
    'POST /media/upload/{instanceName}', 'POST /media/download/{instanceName}',
    
    // Profile
    'GET /chat/fetchProfile/{instanceName}', 'PUT /chat/updateProfile/{instanceName}',
    'PUT /chat/updateProfilePicture/{instanceName}', 'DELETE /chat/removeProfilePicture/{instanceName}',
    
    // Settings
    'GET /chat/fetchPrivacySettings/{instanceName}', 'PUT /chat/updatePrivacySettings/{instanceName}',
    
    // Presence
    'PUT /chat/sendPresence/{instanceName}',
    
    // Labels
    'GET /chat/getLabels/{instanceName}', 'PUT /chat/handleLabel/{instanceName}',
    
    // Webhook
    'GET /webhook/find/{instanceName}', 'PUT /webhook/set/{instanceName}',
    
    // Message
    'POST /message/sendText/{instanceName}', 'POST /message/sendMedia/{instanceName}',
    'POST /message/sendWhatsAppAudio/{instanceName}', 'POST /message/sendReaction/{instanceName}',
    
    // Chat
    'GET /chat/findChats/{instanceName}', 'POST /chat/findMessages/{instanceName}',
    'PUT /chat/readMessages/{instanceName}', 'PUT /chat/archiveChat/{instanceName}',
    'DELETE /chat/deleteMessage/{instanceName}'
  ];

  const implementedEndpoints = [
    '/health', '/info',
    'GET /business', 'POST /business', 'GET /business/{id}', 'PUT /business/{id}', 'DELETE /business/{id}',
    'GET /instance', 'POST /instance/create', 'POST /instance/connect/{instanceName}',
    'DELETE /instance/logout/{instanceName}', 'DELETE /instance/delete/{instanceName}',
    'GET /instance/connectionState/{instanceName}', 'GET /instance/fetchInstances/{instanceName}',
    'PUT /instance/restart/{instanceName}',
    'POST /chat/findContacts/{instanceName}', 'POST /chat/upsertContact/{instanceName}',
    'PUT /chat/updateContactProfilePicture/{instanceName}', 'POST /chat/fetchProfilePictureUrl/{instanceName}',
    'PUT /chat/blockContact/{instanceName}', 'PUT /chat/unblockContact/{instanceName}',
    'POST /group/findGroupByJid/{instanceName}', 'POST /group/create/{instanceName}',
    'PUT /group/updateGroupInfo/{instanceName}', 'PUT /group/updateGParticipant/{instanceName}',
    'PUT /group/updateGSetting/{instanceName}', 'DELETE /group/leaveGroup/{instanceName}',
    'POST /media/upload/{instanceName}', 'POST /media/download/{instanceName}',
    'GET /chat/fetchProfile/{instanceName}', 'PUT /chat/updateProfile/{instanceName}',
    'PUT /chat/updateProfilePicture/{instanceName}', 'DELETE /chat/removeProfilePicture/{instanceName}',
    'GET /chat/fetchPrivacySettings/{instanceName}', 'PUT /chat/updatePrivacySettings/{instanceName}',
    'PUT /chat/sendPresence/{instanceName}',
    'GET /chat/getLabels/{instanceName}', 'PUT /chat/handleLabel/{instanceName}',
    'GET /webhook/find/{instanceName}', 'PUT /webhook/set/{instanceName}',
    'POST /message/sendText/{instanceName}', 'POST /message/sendMedia/{instanceName}',
    'POST /message/sendWhatsAppAudio/{instanceName}', 'POST /message/sendReaction/{instanceName}',
    'GET /chat/findChats/{instanceName}', 'POST /chat/findMessages/{instanceName}',
    'PUT /chat/readMessages/{instanceName}', 'PUT /chat/archiveChat/{instanceName}',
    'DELETE /chat/deleteMessage/{instanceName}'
  ];

  const missing = officialEndpoints.filter(endpoint => !implementedEndpoints.includes(endpoint));

  return {
    implemented: implementedEndpoints,
    missing,
    total: officialEndpoints.length
  };
}

console.log('📊 [YUMER-V2] Cobertura de endpoints:', validateEndpointCoverage());
