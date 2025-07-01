
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface InstanceStatus {
  instanceId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrCode?: string;
  hasQrCode?: boolean;
  phoneNumber?: string;
  error?: string;
}

export const useSimpleInstanceManager = () => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const fullUrl = `https://146.59.227.248${url}`;
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  };

  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      
      console.log(`🚀 Conectando instância: ${instanceId}`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'connecting'
        }
      }));

      const response = await makeRequest(`/clients/${instanceId}/connect`, {
        method: 'POST'
      });

      console.log('Resposta da conexão:', response);

      // Verificar status após conexão
      setTimeout(() => {
        getInstanceStatus(instanceId);
      }, 2000);

      toast({
        title: "Conectando...",
        description: `Iniciando conexão da instância ${instanceId}`,
      });

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'disconnected',
          error: error.message
        }
      }));

      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      
      await makeRequest(`/clients/${instanceId}/disconnect`, {
        method: 'POST'
      });

      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'disconnected'
        }
      }));

      toast({
        title: "Desconectado",
        description: `Instância ${instanceId} desconectada`,
      });

    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast]);

  const getInstanceStatus = useCallback(async (instanceId: string) => {
    try {
      const response = await makeRequest(`/clients/${instanceId}/status`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: response.status,
          qrCode: response.qrCode,
          hasQrCode: response.hasQrCode,
          phoneNumber: response.phoneNumber
        }
      }));

      return response;
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'disconnected',
          error: error.message
        }
      }));
    }
  }, []);

  const getStatus = useCallback((instanceId: string) => {
    return instances[instanceId] || {
      instanceId,
      status: 'disconnected'
    };
  }, [instances]);

  const isInstanceLoading = useCallback((instanceId: string) => {
    return loading[instanceId] || false;
  }, [loading]);

  return {
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    getStatus,
    isInstanceLoading,
    instances
  };
};
