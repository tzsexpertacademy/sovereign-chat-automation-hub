// Hook para gerenciar CodeChat API v2.1.3 - Business/Instance Model
import { useState, useCallback } from 'react';
import { codeChatV2Service, type BusinessData, type InstanceData } from '@/services/codechatV2Service';
import { useToast } from '@/hooks/use-toast';

interface BusinessState {
  businessId?: string;
  businessToken?: string;
  name?: string;
  slug?: string;
}

interface InstanceState {
  instanceId?: string;
  instanceJWT?: string;
  name?: string;
  state?: string;
  connection?: string;
}

export const useCodeChatV2 = () => {
  const [business, setBusiness] = useState<BusinessState>({});
  const [instance, setInstance] = useState<InstanceState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const { toast } = useToast();

  // ADMINISTRAÇÃO - Criar Business
  const createBusiness = useCallback(async (businessData: {
    name: string;
    slug: string;
    email: string;
    phone: string;
    country?: string;
    timezone?: string;
    language?: string;
  }): Promise<BusinessData | null> => {
    setIsLoading(true);
    
    try {
      console.log('🏢 [CODECHAT-V2] Criando business:', businessData);
      
      const result = await codeChatV2Service.createBusiness(businessData);
      
      if (result.success && result.data) {
        setBusiness({
          businessId: result.data.businessId,
          businessToken: result.data.businessToken,
          name: result.data.name,
          slug: result.data.slug
        });
        
        // Salvar no localStorage para persistência
        localStorage.setItem('codechat_v2_business', JSON.stringify({
          businessId: result.data.businessId,
          businessToken: result.data.businessToken,
          name: result.data.name,
          slug: result.data.slug
        }));
        
        toast({
          title: "Business criado",
          description: `Business "${result.data.name}" criado com sucesso`,
          variant: "default"
        });
        
        return result.data;
      } else {
        throw new Error(result.error || 'Erro ao criar business');
      }
    } catch (error: any) {
      console.error('❌ [CODECHAT-V2] Erro ao criar business:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao criar business',
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // BUSINESS - Criar Instância
  const createInstance = useCallback(async (instanceName?: string): Promise<InstanceData | null> => {
    if (!business.businessToken) {
      toast({
        title: "Erro",
        description: "Business Token não encontrado. Crie um business primeiro.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    
    try {
      console.log('📱 [CODECHAT-V2] Criando instância:', instanceName);
      
      const result = await codeChatV2Service.createInstance(business.businessToken, instanceName);
      
      if (result.success && result.data) {
        const instanceData = {
          instanceId: result.data.instanceId,
          instanceJWT: result.data.Auth.jwt,
          name: result.data.name,
          state: result.data.state,
          connection: result.data.connection
        };
        
        setInstance(instanceData);
        setConnectionStatus(result.data.connection);
        
        // Salvar no localStorage para persistência
        localStorage.setItem('codechat_v2_instance', JSON.stringify(instanceData));
        
        toast({
          title: "Instância criada",
          description: `Instância "${result.data.name}" criada com sucesso`,
          variant: "default"
        });
        
        return result.data;
      } else {
        throw new Error(result.error || 'Erro ao criar instância');
      }
    } catch (error: any) {
      console.error('❌ [CODECHAT-V2] Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao criar instância',
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [business.businessToken, toast]);

  // INSTANCE - Conectar e obter QR
  const connectInstance = useCallback(async (): Promise<{ qrCode?: string; success: boolean }> => {
    if (!instance.instanceJWT) {
      toast({
        title: "Erro",
        description: "Instance JWT não encontrado. Crie uma instância primeiro.",
        variant: "destructive"
      });
      return { success: false };
    }

    setIsLoading(true);
    
    try {
      console.log('🔌 [CODECHAT-V2] Conectando instância...');
      
      const result = await codeChatV2Service.connectInstance(instance.instanceJWT);
      
      if (result.success && result.data) {
        setConnectionStatus('connecting');
        
        toast({
          title: "Conectando",
          description: "Escaneie o QR Code para conectar",
          variant: "default"
        });
        
        return { success: true, qrCode: result.data.base64 };
      } else {
        throw new Error(result.error || 'Erro ao conectar instância');
      }
    } catch (error: any) {
      console.error('❌ [CODECHAT-V2] Erro ao conectar instância:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao conectar instância',
        variant: "destructive"
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [instance.instanceJWT, toast]);

  // INSTANCE - Verificar status da conexão
  const checkConnectionState = useCallback(async (): Promise<string> => {
    if (!instance.instanceJWT) return 'no-instance';
    
    try {
      const result = await codeChatV2Service.getConnectionState(instance.instanceJWT);
      
      if (result.success && result.data) {
        const newStatus = result.data.connection || result.data.state || 'unknown';
        setConnectionStatus(newStatus);
        return newStatus;
      }
      
      return 'error';
    } catch (error: any) {
      console.error('❌ [CODECHAT-V2] Erro ao verificar status:', error);
      return 'error';
    }
  }, [instance.instanceJWT]);

  // INSTANCE - Enviar mensagem
  const sendMessage = useCallback(async (number: string, text: string): Promise<boolean> => {
    if (!instance.instanceJWT) {
      toast({
        title: "Erro",
        description: "Instance JWT não encontrado",
        variant: "destructive"
      });
      return false;
    }

    try {
      const result = await codeChatV2Service.sendTextMessage(instance.instanceJWT, {
        number,
        text
      });
      
      if (result.success) {
        toast({
          title: "Mensagem enviada",
          description: "Mensagem enviada com sucesso",
          variant: "default"
        });
        return true;
      } else {
        throw new Error(result.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('❌ [CODECHAT-V2] Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao enviar mensagem',
        variant: "destructive"
      });
      return false;
    }
  }, [instance.instanceJWT, toast]);

  // Carregar dados persistidos
  const loadPersistedData = useCallback(() => {
    try {
      const savedBusiness = localStorage.getItem('codechat_v2_business');
      const savedInstance = localStorage.getItem('codechat_v2_instance');
      
      if (savedBusiness) {
        setBusiness(JSON.parse(savedBusiness));
      }
      
      if (savedInstance) {
        setInstance(JSON.parse(savedInstance));
      }
    } catch (error) {
      console.error('❌ [CODECHAT-V2] Erro ao carregar dados persistidos:', error);
    }
  }, []);

  // Limpar dados
  const clearData = useCallback(() => {
    setBusiness({});
    setInstance({});
    setConnectionStatus('disconnected');
    localStorage.removeItem('codechat_v2_business');
    localStorage.removeItem('codechat_v2_instance');
  }, []);

  return {
    // Estado
    business,
    instance,
    isLoading,
    connectionStatus,
    
    // Métodos
    createBusiness,
    createInstance,
    connectInstance,
    checkConnectionState,
    sendMessage,
    loadPersistedData,
    clearData,
    
    // Helpers
    hasBusinessToken: !!business.businessToken,
    hasInstanceJWT: !!instance.instanceJWT,
    isConnected: connectionStatus === 'open' || connectionStatus === 'connected'
  };
};