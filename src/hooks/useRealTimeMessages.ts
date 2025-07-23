
import { useState, useEffect, useCallback } from 'react';
import { realTimeMessageSync } from '@/services/realTimeMessageSync';
import { useToast } from '@/hooks/use-toast';

interface UseRealTimeMessagesProps {
  clientId: string;
  instanceId: string;
  onNewMessage?: (message: any) => void;
  onNewTicket?: (ticket: any) => void;
}

export const useRealTimeMessages = ({
  clientId,
  instanceId,
  onNewMessage,
  onNewTicket
}: UseRealTimeMessagesProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const { toast } = useToast();

  const handleNewMessage = useCallback((message: any) => {
    console.log('📨 [HOOK] Nova mensagem recebida:', message);
    onNewMessage?.(message);
    
    toast({
      title: "Nova mensagem",
      description: `Mensagem de ${message.sender_name}`,
      duration: 3000,
    });
  }, [onNewMessage, toast]);

  const handleNewTicket = useCallback((ticket: any) => {
    console.log('🎫 [HOOK] Novo ticket criado:', ticket);
    onNewTicket?.(ticket);
    
    toast({
      title: "Nova conversa",
      description: `Conversa iniciada com ${ticket.title}`,
      duration: 3000,
    });
  }, [onNewTicket, toast]);

  const handleConnectionChange = useCallback((status: string) => {
    console.log('📡 [HOOK] Status de conexão alterado:', status);
    setConnectionStatus(status);
    setIsConnected(status === 'connected');
    
    if (status === 'connected') {
      toast({
        title: "Conectado",
        description: "WhatsApp conectado com sucesso",
        duration: 2000,
      });
    } else if (status === 'disconnected') {
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado",
        variant: "destructive",
        duration: 2000,
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!clientId || !instanceId) return;

    console.log('🚀 [HOOK] Iniciando tempo real para:', { clientId, instanceId });

    // Iniciar sistema de tempo real
    realTimeMessageSync.start({
      clientId,
      instanceId,
      onNewMessage: handleNewMessage,
      onNewTicket: handleNewTicket,
      onConnectionChange: handleConnectionChange
    });

    // Cleanup ao desmontar
    return () => {
      console.log('⏹️ [HOOK] Parando tempo real');
      realTimeMessageSync.stop();
    };
  }, [clientId, instanceId, handleNewMessage, handleNewTicket, handleConnectionChange]);

  return {
    isConnected,
    connectionStatus,
    startRealTime: () => {
      if (clientId && instanceId) {
        realTimeMessageSync.start({
          clientId,
          instanceId,
          onNewMessage: handleNewMessage,
          onNewTicket: handleNewTicket,
          onConnectionChange: handleConnectionChange
        });
      }
    },
    stopRealTime: () => {
      realTimeMessageSync.stop();
    }
  };
};
