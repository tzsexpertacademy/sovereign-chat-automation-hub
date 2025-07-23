
import { useState, useEffect, useCallback } from 'react';
import { whatsappService, type WhatsAppClient } from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface QRCodeStatus {
  clientId: string;
  qrCode: string | null;
  status: 'disconnected' | 'qr_ready' | 'connected' | 'connecting';
  hasQrCode: boolean;
}

export const useQRCodeManager = () => {
  const [qrCodes, setQrCodes] = useState<Record<string, QRCodeStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const socket = whatsappService.connectSocket();

  useEffect(() => {
    if (socket) {
      socket.on('qr-code', (data: { clientId: string; qrCode: string }) => {
        setQrCodes(prev => ({
          ...prev,
          [data.clientId]: {
            clientId: data.clientId,
            qrCode: data.qrCode,
            status: 'qr_ready',
            hasQrCode: true
          }
        }));
      });

      socket.on('connection-update', (client: WhatsAppClient) => {
        setQrCodes(prev => ({
          ...prev,
          [client.instanceId]: {
            clientId: client.instanceId,
            qrCode: client.status === 'connected' ? null : prev[client.instanceId]?.qrCode || null,
            status: client.status,
            hasQrCode: client.hasQrCode || false
          }
        }));
      });

      socket.on('disconnect', () => {
        console.log('Socket desconectado');
      });
    }

    return () => {
      if (socket) {
        whatsappService.disconnect();
      }
    };
  }, []);

  const generateQRCode = useCallback(async (clientId: string) => {
    try {
      setLoading(prev => ({ ...prev, [clientId]: true }));
      
      await whatsappService.connectInstance(clientId);
      
      // Simular geração de QR Code
      const qrCode = await whatsappService.getQRCode(clientId);
      
      if (qrCode) {
        setQrCodes(prev => ({
          ...prev,
          [clientId]: {
            clientId,
            qrCode,
            status: 'qr_ready',
            hasQrCode: true
          }
        }));
        
        toast({
          title: "QR Code Gerado",
          description: "QR Code está pronto para escaneamento",
        });
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar QR Code",
        variant: "destructive",  
      });
    } finally {
      setLoading(prev => ({ ...prev, [clientId]: false }));
    }
  }, [toast]);

  const refreshQRCode = useCallback(async (clientId: string) => {
    await generateQRCode(clientId);
  }, [generateQRCode]);

  const getQRCodeStatus = useCallback((clientId: string): QRCodeStatus => {
    return qrCodes[clientId] || {
      clientId,
      qrCode: null,
      status: 'disconnected',
      hasQrCode: false
    };
  }, [qrCodes]);

  const isGenerating = useCallback((clientId: string): boolean => {
    return loading[clientId] || false;
  }, [loading]);

  const startListening = useCallback((clientId: string) => {
    if (socket) {
      whatsappService.joinClientRoom(clientId);
    }
  }, []);

  const stopListening = useCallback((clientId: string) => {
    // Remover listener específico se necessário
    setQrCodes(prev => {
      const updated = { ...prev };
      delete updated[clientId];
      return updated;
    });
  }, []);

  return {
    qrCodes,
    generateQRCode,
    refreshQRCode,
    getQRCodeStatus,
    isGenerating,
    startListening,
    stopListening
  };
};
