
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useSimpleInstances = () => {
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});

  const connectInstance = useCallback(async (instanceName: string) => {
    try {
      setIsConnecting(prev => ({ ...prev, [instanceName]: true }));
      
      const result = await whatsappService.connectInstance(instanceName);
      
      if (result) {
        console.log(`✅ Instância ${instanceName} conectada com sucesso`);
        return { success: true };
      } else {
        console.log(`❌ Falha ao conectar instância ${instanceName}`);
        return { success: false, error: 'Falha na conexão' };
      }
    } catch (error: any) {
      console.error('Erro ao conectar instância:', error);
      return { success: false, error: error.message };
    } finally {
      setIsConnecting(prev => ({ ...prev, [instanceName]: false }));
    }
  }, []);

  const createInstance = useCallback(async (instanceName: string) => {
    try {
      const result = await whatsappService.createInstance(instanceName);
      return { success: result };
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const getQRCode = useCallback(async (instanceName: string) => {
    try {
      const qrCode = await whatsappService.getQRCode(instanceName);
      return { success: !!qrCode, qrCode };
    } catch (error: any) {
      console.error('Erro ao obter QR Code:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return {
    connectInstance,
    createInstance,
    getQRCode,
    isConnecting
  };
};
