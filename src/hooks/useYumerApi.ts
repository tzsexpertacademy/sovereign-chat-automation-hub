
import { useState, useCallback } from 'react';
import { yumerApiService } from '@/services/yumerApiService';
import type {
  AdminBusinessCreateRequest,
  AdminBusinessCreateResponse,
  AdminBusinessFindResponse,
  AdminBusinessUpdateRequest,
  BusinessInstanceCreateRequest,
  BusinessInstanceCreateResponse,
  InstanceConnectResponse,
  InstanceConnectionStateResponse,
  WebhookSetRequest,
  WebhookResponse,
  SendTextMessageRequest,
  SendMediaMessageRequest,
  MessageResponse,
  WhatsAppNumbersRequest,
  WhatsAppNumbersResponse
} from '@/services/yumerApiService';
import { useToast } from '@/hooks/use-toast';

export const useYumerApi = () => {
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
    createBusiness: useCallback(async (data: AdminBusinessCreateRequest) => {
      return executeRequest(
        () => yumerApiService.createBusiness(data),
        'Business criado com sucesso'
      );
    }, [executeRequest]),

    getAllBusinesses: useCallback(async () => {
      return executeRequest(() => yumerApiService.getAllBusinesses());
    }, [executeRequest]),

    getBusinessById: useCallback(async (businessId: string) => {
      return executeRequest(() => yumerApiService.getBusinessById(businessId));
    }, [executeRequest]),

    updateBusiness: useCallback(async (businessId: string, data: AdminBusinessUpdateRequest) => {
      return executeRequest(
        () => yumerApiService.updateBusiness(businessId, data),
        'Business atualizado com sucesso'
      );
    }, [executeRequest]),

    refreshBusinessToken: useCallback(async (businessId: string, oldToken: string) => {
      return executeRequest(
        () => yumerApiService.refreshBusinessToken(businessId, { oldToken }),
        'Token atualizado com sucesso'
      );
    }, [executeRequest]),

    moveInstance: useCallback(async (sourceInstanceId: string, businessIdTarget: string) => {
      return executeRequest(
        () => yumerApiService.moveInstance({ sourceInstanceId, businessIdTarget }),
        'Instância movida com sucesso'
      );
    }, [executeRequest]),

    deleteBusiness: useCallback(async (businessId: string, force?: boolean) => {
      return executeRequest(
        () => yumerApiService.deleteBusiness(businessId, force),
        'Business deletado com sucesso'
      );
    }, [executeRequest])
  };

  // ============ BUSINESS FUNCTIONS ============
  const business = {
    getInfo: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(() => yumerApiService.getBusinessInfo(businessId, businessToken));
    }, [executeRequest]),

    updateInfo: useCallback(async (businessId: string, data: AdminBusinessUpdateRequest, businessToken: string) => {
      return executeRequest(
        () => yumerApiService.updateBusinessInfo(businessId, data, businessToken),
        'Business atualizado com sucesso'
      );
    }, [executeRequest]),

    createInstance: useCallback(async (businessId: string, data: BusinessInstanceCreateRequest, businessToken: string) => {
      return executeRequest(
        () => yumerApiService.createBusinessInstance(businessId, data, businessToken),
        'Instância criada com sucesso'
      );
    }, [executeRequest]),

    deleteInstance: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(
        () => yumerApiService.deleteBusinessInstance(businessId, businessToken),
        'Instância deletada com sucesso'
      );
    }, [executeRequest]),

    getConnectedInstances: useCallback(async (businessId: string, businessToken: string) => {
      return executeRequest(() => yumerApiService.getConnectedInstances(businessId, businessToken));
    }, [executeRequest])
  };

  // ============ INSTANCE FUNCTIONS ============
  const instance = {
    get: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.getInstance(instanceId, instanceJWT));
    }, [executeRequest]),

    connect: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.connectInstance(instanceId, instanceJWT));
    }, [executeRequest]),

    getConnectionState: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.getConnectionState(instanceId, instanceJWT));
    }, [executeRequest]),

    reload: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.reloadInstance(instanceId, instanceJWT),
        'Instância recarregada com sucesso'
      );
    }, [executeRequest]),

    logout: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.logoutInstance(instanceId, instanceJWT),
        'Instância desconectada com sucesso'
      );
    }, [executeRequest]),

    getQRCode: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.getQRCode(instanceId, instanceJWT));
    }, [executeRequest])
  };

  // ============ WEBHOOK FUNCTIONS ============
  const webhook = {
    set: useCallback(async (instanceId: string, data: WebhookSetRequest, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.setWebhook(instanceId, data, instanceJWT),
        'Webhook configurado com sucesso'
      );
    }, [executeRequest]),

    find: useCallback(async (instanceId: string, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.findWebhook(instanceId, instanceJWT));
    }, [executeRequest])
  };

  // ============ MESSAGE FUNCTIONS ============
  const message = {
    sendText: useCallback(async (instanceId: string, data: SendTextMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.sendTextMessage(instanceId, data, instanceJWT),
        'Mensagem enviada com sucesso'
      );
    }, [executeRequest]),

    sendMedia: useCallback(async (instanceId: string, data: SendMediaMessageRequest, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.sendMediaMessage(instanceId, data, instanceJWT),
        'Mídia enviada com sucesso'
      );
    }, [executeRequest])
  };

  // ============ CHAT FUNCTIONS ============
  const chat = {
    validateNumbers: useCallback(async (instanceId: string, data: WhatsAppNumbersRequest, instanceJWT: string) => {
      return executeRequest(() => yumerApiService.validateWhatsAppNumbers(instanceId, data, instanceJWT));
    }, [executeRequest]),

    markAsRead: useCallback(async (instanceId: string, messageIds: string[], instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.markAsRead(instanceId, messageIds, instanceJWT),
        'Mensagens marcadas como lidas'
      );
    }, [executeRequest]),

    archiveChat: useCallback(async (instanceId: string, chatId: string, archive: boolean, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.archiveChat(instanceId, chatId, archive, instanceJWT),
        archive ? 'Chat arquivado' : 'Chat desarquivado'
      );
    }, [executeRequest]),

    deleteMessage: useCallback(async (instanceId: string, messageId: string, instanceJWT: string) => {
      return executeRequest(
        () => yumerApiService.deleteMessage(instanceId, messageId, instanceJWT),
        'Mensagem deletada com sucesso'
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
    chat
  };
};
