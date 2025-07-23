
import { useState, useCallback } from 'react';
import { codechatV2CompleteApiService } from '@/services/codechatV2CompleteApiService';
import * as Types from '@/types/codechatV2Types';
import { useToast } from '@/hooks/use-toast';

export const useCodeChatV2Complete = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleError = useCallback((error: any, defaultMessage: string) => {
    const message = error?.message || defaultMessage;
    setError(message);
    toast({
      title: "Erro",
      description: message,
      variant: "destructive"
    });
    throw error;
  }, [toast]);

  const executeRequest = useCallback(async <T>(
    request: () => Promise<T>,
    successMessage?: string
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await request();
      
      if (successMessage) {
        toast({
          title: "Sucesso",
          description: successMessage,
          variant: "default"
        });
      }
      
      return result;
    } catch (error: any) {
      handleError(error, 'Erro na operação');
    } finally {
      setLoading(false);
    }
  }, [handleError, toast]);

  // ============ ADMIN FUNCTIONS ============
  const admin = {
    createBusiness: useCallback(async (data: Types.BusinessCreateRequest, adminToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.createBusiness(data, adminToken),
        'Business criado com sucesso'
      );
    }, [executeRequest]),

    getAllBusinesses: useCallback(async (adminToken: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getAllBusinesses(adminToken));
    }, [executeRequest]),

    refreshBusinessToken: useCallback(async (businessId: string, data: Types.BusinessOldToken, adminToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.refreshBusinessToken(businessId, data, adminToken),
        'Token atualizado com sucesso'
      );
    }, [executeRequest]),

    moveInstance: useCallback(async (data: Types.MoveInstanceRequest, adminToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.moveInstance(data, adminToken),
        'Instância movida com sucesso'
      );
    }, [executeRequest]),

    deleteBusiness: useCallback(async (businessId: string, adminToken: string, force?: boolean) => {
      return executeRequest(
        () => codechatV2CompleteApiService.deleteBusiness(businessId, adminToken, force),
        'Business deletado com sucesso'
      );
    }, [executeRequest])
  };

  // ============ BUSINESS FUNCTIONS ============
  const business = {
    getBusiness: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getBusiness(businessId, businessToken));
    }, [executeRequest]),

    updateBusiness: useCallback(async (businessId: string, data: Types.BusinessUpdateRequest, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateBusiness(businessId, data, businessToken),
        'Business atualizado com sucesso'
      );
    }, [executeRequest]),

    createInstance: useCallback(async (businessId: string, data: Types.InstanceCreateRequest, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.createBusinessInstance(businessId, data, businessToken),
        'Instância criada com sucesso'
      );
    }, [executeRequest]),

    deleteInstance: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.deleteBusinessInstance(businessId, businessToken),
        'Instância deletada com sucesso'
      );
    }, [executeRequest]),

    refreshInstanceToken: useCallback(async (businessId: string, instanceId: string, data: Types.BusinessOldToken, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.refreshInstanceToken(businessId, instanceId, data, businessToken),
        'Token da instância atualizado'
      );
    }, [executeRequest]),

    toggleInstanceActivation: useCallback(async (businessId: string, instanceId: string, data: Types.ToggleActionDTO, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.toggleInstanceActivation(businessId, instanceId, data, businessToken),
        'Status da instância alterado'
      );
    }, [executeRequest]),

    getConnectedInstances: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getConnectedInstances(businessId, businessToken));
    }, [executeRequest]),

    searchInstances: useCallback(async (businessId: string, data: Types.SearchInstanceDTO, businessToken: string) => {
      return executeRequest(() => codechatV2CompleteApiService.searchInstances(businessId, data, businessToken));
    }, [executeRequest]),

    moveWhatsApp: useCallback(async (businessId: string, data: Types.MoveWhatsAppRequest, businessToken: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.moveWhatsApp(businessId, data, businessToken),
        'WhatsApp movido com sucesso'
      );
    }, [executeRequest])
  };

  // ============ INSTANCE FUNCTIONS ============
  const instance = {
    getInstance: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getInstance(instanceId, instanceJWT));
    }, [executeRequest]),

    setProxy: useCallback(async (instanceId: string, data: Types.ProxyRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.setProxy(instanceId, data, instanceJWT),
        'Proxy configurado com sucesso'
      );
    }, [executeRequest]),

    connect: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.connectInstance(instanceId, instanceJWT));
    }, [executeRequest]),

    reload: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.reloadInstance(instanceId, instanceJWT),
        'Instância recarregada com sucesso'
      );
    }, [executeRequest]),

    getConnectionState: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getConnectionState(instanceId, instanceJWT));
    }, [executeRequest]),

    logout: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.logoutInstance(instanceId, instanceJWT),
        'Instância desconectada com sucesso'
      );
    }, [executeRequest]),

    updateProfileName: useCallback(async (instanceId: string, data: Types.ProfileNameRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateProfileName(instanceId, data, instanceJWT),
        'Nome do perfil atualizado'
      );
    }, [executeRequest]),

    updateProfilePicture: useCallback(async (instanceId: string, data: Types.PictureUrlRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateProfilePicture(instanceId, data, instanceJWT),
        'Foto do perfil atualizada'
      );
    }, [executeRequest]),

    updateProfileStatus: useCallback(async (instanceId: string, data: Types.ProfileStatusRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateProfileStatus(instanceId, data, instanceJWT),
        'Status do perfil atualizado'
      );
    }, [executeRequest]),

    getQRCode: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getQRCode(instanceId, instanceJWT));
    }, [executeRequest])
  };

  // ============ WEBHOOK FUNCTIONS ============
  const webhook = {
    create: useCallback(async (instanceId: string, data: Types.WebhookCreateRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.createWebhook(instanceId, data, instanceJWT),
        'Webhook criado com sucesso'
      );
    }, [executeRequest]),

    getAll: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getWebhooks(instanceId, instanceJWT));
    }, [executeRequest]),

    getById: useCallback(async (instanceId: string, webhookId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getWebhookById(instanceId, webhookId, instanceJWT));
    }, [executeRequest]),

    update: useCallback(async (instanceId: string, webhookId: string, data: Types.WebhookUpdateRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateWebhook(instanceId, webhookId, data, instanceJWT),
        'Webhook atualizado com sucesso'
      );
    }, [executeRequest]),

    delete: useCallback(async (instanceId: string, webhookId: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.deleteWebhook(instanceId, webhookId, instanceJWT),
        'Webhook deletado com sucesso'
      );
    }, [executeRequest]),

    updateEvents: useCallback(async (instanceId: string, webhookId: string, data: Types.WebhookEventsRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateWebhookEvents(instanceId, webhookId, data, instanceJWT),
        'Eventos do webhook atualizados'
      );
    }, [executeRequest])
  };

  // ============ MESSAGE FUNCTIONS ============
  const message = {
    sendText: useCallback(async (instanceId: string, data: Types.TextMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendTextMessage(instanceId, data, instanceJWT),
        'Mensagem de texto enviada'
      );
    }, [executeRequest]),

    sendLinkPreview: useCallback(async (instanceId: string, data: Types.LinkPreviewRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendLinkPreview(instanceId, data, instanceJWT),
        'Preview de link enviado'
      );
    }, [executeRequest]),

    sendMedia: useCallback(async (instanceId: string, data: Types.MediaMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendMedia(instanceId, data, instanceJWT),
        'Mídia enviada com sucesso'
      );
    }, [executeRequest]),

    sendAudio: useCallback(async (instanceId: string, data: Types.AudioMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendAudio(instanceId, data, instanceJWT),
        'Áudio enviado com sucesso'
      );
    }, [executeRequest]),

    sendLocation: useCallback(async (instanceId: string, data: Types.LocationMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendLocation(instanceId, data, instanceJWT),
        'Localização enviada'
      );
    }, [executeRequest]),

    sendContact: useCallback(async (instanceId: string, data: Types.ContactMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendContact(instanceId, data, instanceJWT),
        'Contato enviado com sucesso'
      );
    }, [executeRequest]),

    sendButtons: useCallback(async (instanceId: string, data: Types.ButtonMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendButtons(instanceId, data, instanceJWT),
        'Botões enviados com sucesso'
      );
    }, [executeRequest]),

    sendList: useCallback(async (instanceId: string, data: Types.ListMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendList(instanceId, data, instanceJWT),
        'Lista enviada com sucesso'
      );
    }, [executeRequest]),

    sendForward: useCallback(async (instanceId: string, data: Types.ForwardsMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendForward(instanceId, data, instanceJWT),
        'Mensagem encaminhada'
      );
    }, [executeRequest]),

    sendReaction: useCallback(async (instanceId: string, data: Types.ReactionRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.sendReaction(instanceId, data, instanceJWT),
        'Reação enviada'
      );
    }, [executeRequest]),

    editMessage: useCallback(async (instanceId: string, data: Types.EditMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.editMessage(instanceId, data, instanceJWT),
        'Mensagem editada com sucesso'
      );
    }, [executeRequest])
  };

  // ============ CHAT FUNCTIONS ============
  const chat = {
    validateNumbers: useCallback(async (instanceId: string, data: Types.ValidateNumbersRequest, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.validateNumbers(instanceId, data, instanceJWT));
    }, [executeRequest]),

    getProfilePicture: useCallback(async (instanceId: string, contactId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getProfilePicture(instanceId, contactId, instanceJWT));
    }, [executeRequest]),

    getWhatsAppStatus: useCallback(async (instanceId: string, contactId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getWhatsAppStatus(instanceId, contactId, instanceJWT));
    }, [executeRequest]),

    getBusinessProfile: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getBusinessProfile(instanceId, instanceJWT));
    }, [executeRequest]),

    markAsRead: useCallback(async (instanceId: string, data: Types.MarkAsReadRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.markAsRead(instanceId, data, instanceJWT),
        'Mensagens marcadas como lidas'
      );
    }, [executeRequest]),

    archiveChat: useCallback(async (instanceId: string, chatId: string, data: Types.ArchiveChatRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.archiveChat(instanceId, chatId, data, instanceJWT),
        'Chat arquivado com sucesso'
      );
    }, [executeRequest]),

    deleteMessage: useCallback(async (instanceId: string, messageId: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.deleteMessage(instanceId, messageId, instanceJWT),
        'Mensagem deletada com sucesso'
      );
    }, [executeRequest]),

    searchMessages: useCallback(async (instanceId: string, data: Types.SearchMessagesRequest, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.searchMessages(instanceId, data, instanceJWT));
    }, [executeRequest]),

    searchContacts: useCallback(async (instanceId: string, query?: string, instanceJWT?: string) => {
      return executeRequest(() => codechatV2CompleteApiService.searchContacts(instanceId, query, instanceJWT));
    }, [executeRequest]),

    searchChats: useCallback(async (instanceId: string, query?: string, instanceJWT?: string) => {
      return executeRequest(() => codechatV2CompleteApiService.searchChats(instanceId, query, instanceJWT));
    }, [executeRequest]),

    rejectCall: useCallback(async (instanceId: string, data: Types.RejectCallRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.rejectCall(instanceId, data, instanceJWT),
        'Chamada rejeitada'
      );
    }, [executeRequest])
  };

  // ============ GROUP FUNCTIONS ============
  const group = {
    create: useCallback(async (instanceId: string, data: Types.GroupCreateRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.createGroup(instanceId, data, instanceJWT),
        'Grupo criado com sucesso'
      );
    }, [executeRequest]),

    get: useCallback(async (instanceId: string, groupJid: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getGroup(instanceId, groupJid, instanceJWT));
    }, [executeRequest]),

    update: useCallback(async (instanceId: string, groupJid: string, data: Types.GroupUpdateRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateGroup(instanceId, groupJid, data, instanceJWT),
        'Grupo atualizado com sucesso'
      );
    }, [executeRequest]),

    getParticipants: useCallback(async (instanceId: string, groupJid: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getGroupParticipants(instanceId, groupJid, instanceJWT));
    }, [executeRequest]),

    updateParticipants: useCallback(async (instanceId: string, groupJid: string, data: Types.GroupParticipantUpdateRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateGroupParticipants(instanceId, groupJid, data, instanceJWT),
        'Participantes atualizados'
      );
    }, [executeRequest]),

    updateSettings: useCallback(async (instanceId: string, groupJid: string, data: Types.GroupSettingsRequest, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.updateGroupSettings(instanceId, groupJid, data, instanceJWT),
        'Configurações do grupo atualizadas'
      );
    }, [executeRequest]),

    createInvitation: useCallback(async (instanceId: string, groupJid: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.createGroupInvitation(instanceId, groupJid, instanceJWT),
        'Convite do grupo criado'
      );
    }, [executeRequest]),

    revokeInvitation: useCallback(async (instanceId: string, groupJid: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.revokeGroupInvitation(instanceId, groupJid, instanceJWT),
        'Convite do grupo revogado'
      );
    }, [executeRequest]),

    getInvitation: useCallback(async (instanceId: string, code: string, instanceJWT: string) => {
      return executeRequest(() => codechatV2CompleteApiService.getGroupInvitation(instanceId, code, instanceJWT));
    }, [executeRequest]),

    acceptInvitation: useCallback(async (instanceId: string, code: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.acceptGroupInvitation(instanceId, code, instanceJWT),
        'Convite aceito com sucesso'
      );
    }, [executeRequest]),

    leave: useCallback(async (instanceId: string, groupJid: string, instanceJWT: string) => {
      return executeRequest(
        () => codechatV2CompleteApiService.leaveGroup(instanceId, groupJid, instanceJWT),
        'Saiu do grupo com sucesso'
      );
    }, [executeRequest])
  };

  return {
    loading,
    error,
    admin,
    business,
    instance,
    webhook,
    message,
    chat,
    group
  };
};

export default useCodeChatV2Complete;
