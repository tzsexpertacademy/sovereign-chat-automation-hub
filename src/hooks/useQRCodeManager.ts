
import { useState, useEffect } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface QRCodeData {
  instanceId: string;
  qrCode: string | null;
  status: string;
  hasQrCode: boolean;
  lastUpdate: Date;
}

export const useQRCodeManager = (instanceId?: string) => {
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!instanceId) return;

    console.log(`🔍 Iniciando gerenciamento QR Code para instância: ${instanceId}`);
    
    // Conectar ao WebSocket
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      socket.on('connect', () => {
        console.log('🔌 WebSocket conectado para QR Code Manager');
        setWebsocketConnected(true);
        
        // Entrar na sala da instância
        whatsappService.joinClientRoom(instanceId);
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setWebsocketConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
        setWebsocketConnected(false);
      });

      // Escutar status da instância
      whatsappService.onClientStatus(instanceId, (clientData) => {
        console.log(`📱 Status recebido para ${instanceId}:`, clientData);
        
        const newQRData: QRCodeData = {
          instanceId: clientData.clientId,
          qrCode: clientData.qrCode || null,
          status: clientData.status,
          hasQrCode: clientData.hasQrCode || false,
          lastUpdate: new Date()
        };

        setQrCodeData(newQRData);

        if (clientData.hasQrCode && clientData.qrCode) {
          console.log('📱 QR Code recebido via WebSocket!');
          toast({
            title: "QR Code Disponível!",
            description: `Escaneie o QR Code para conectar a instância ${instanceId}`,
          });
        }

        if (clientData.status === 'connected') {
          toast({
            title: "WhatsApp Conectado!",
            description: `Instância ${instanceId} conectada com sucesso`,
          });
        }
      });
    }

    return () => {
      console.log(`🧹 Limpando gerenciamento QR Code para ${instanceId}`);
      if (socket) {
        whatsappService.offClientStatus(instanceId);
      }
    };
  }, [instanceId, toast]);

  const connectInstance = async () => {
    if (!instanceId) return;

    try {
      setLoading(true);
      console.log(`🚀 Conectando instância: ${instanceId}`);
      
      await whatsappService.connectClient(instanceId);
      
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar instância:', error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInstanceStatus = async () => {
    if (!instanceId) return null;

    try {
      const status = await whatsappService.getClientStatus(instanceId);
      console.log(`📊 Status obtido para ${instanceId}:`, status);
      
      const qrData: QRCodeData = {
        instanceId: status.clientId,
        qrCode: status.qrCode || null,
        status: status.status,
        hasQrCode: status.hasQrCode || false,
        lastUpdate: new Date()
      };

      setQrCodeData(qrData);
      return qrData;
    } catch (error) {
      console.error('❌ Erro ao obter status:', error);
      return null;
    }
  };

  const disconnectInstance = async () => {
    if (!instanceId) return;

    try {
      setLoading(true);
      await whatsappService.disconnectClient(instanceId);
      
      setQrCodeData(prev => prev ? {
        ...prev,
        status: 'disconnected',
        qrCode: null,
        hasQrCode: false,
        lastUpdate: new Date()
      } : null);

      toast({
        title: "Desconectado",
        description: `Instância ${instanceId} desconectada`,
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    qrCodeData,
    websocketConnected,
    loading,
    connectInstance,
    disconnectInstance,
    getInstanceStatus
  };
};
