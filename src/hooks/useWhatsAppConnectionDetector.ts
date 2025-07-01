
import { useState, useEffect, useCallback } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface ConnectionDetectorConfig {
  instanceId: string;
  onConnectionDetected?: (phoneNumber: string) => void;
  onConnectionLost?: () => void;
}

export const useWhatsAppConnectionDetector = (config: ConnectionDetectorConfig) => {
  const { instanceId, onConnectionDetected, onConnectionLost } = config;
  const [isReallyConnected, setIsReallyConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  // Função para verificar se realmente está conectado
  const checkRealConnection = useCallback(async (): Promise<{connected: boolean, phone?: string}> => {
    try {
      setIsChecking(true);
      console.log(`🔍 [DETECTOR] Verificando conexão real para ${instanceId}`);
      
      // Método 1: Tentar buscar chats
      try {
        const chats = await whatsappService.getChats(instanceId);
        if (chats && chats.length >= 0) {
          console.log(`✅ [DETECTOR] ${instanceId} pode acessar chats - CONECTADO!`);
          
          // Tentar obter o número do telefone
          try {
            const status = await whatsappService.getClientStatus(instanceId);
            const phone = status.phoneNumber || 'Conectado';
            console.log(`📱 [DETECTOR] Telefone detectado: ${phone}`);
            return { connected: true, phone };
          } catch (error) {
            console.log(`📱 [DETECTOR] Não foi possível obter telefone, mas está conectado`);
            return { connected: true, phone: 'Conectado' };
          }
        }
      } catch (error) {
        console.log(`❌ [DETECTOR] Não consegue acessar chats - não conectado`);
      }

      // Método 2: Verificar status detalhado
      try {
        const status = await whatsappService.getClientStatus(instanceId);
        if (status.phoneNumber && status.phoneNumber !== 'null' && status.phoneNumber !== null) {
          console.log(`✅ [DETECTOR] Status com telefone: ${status.phoneNumber} - CONECTADO!`);
          return { connected: true, phone: status.phoneNumber };
        }
      } catch (error) {
        console.log(`❌ [DETECTOR] Erro ao verificar status detalhado`);
      }

      console.log(`❌ [DETECTOR] ${instanceId} NÃO conectado`);
      return { connected: false };
      
    } catch (error) {
      console.error(`❌ [DETECTOR] Erro na verificação:`, error);
      return { connected: false };
    } finally {
      setIsChecking(false);
    }
  }, [instanceId]);

  // Verificação contínua
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const runCheck = async () => {
      const result = await checkRealConnection();
      
      if (result.connected && !isReallyConnected) {
        // Conexão detectada pela primeira vez
        console.log(`🎉 [DETECTOR] CONEXÃO DETECTADA! ${instanceId} - ${result.phone}`);
        setIsReallyConnected(true);
        setPhoneNumber(result.phone || null);
        
        toast({
          title: "🎉 WhatsApp Conectado!",
          description: `Conexão detectada com sucesso: ${result.phone}`,
        });
        
        if (onConnectionDetected) {
          onConnectionDetected(result.phone || 'Conectado');
        }
        
      } else if (!result.connected && isReallyConnected) {
        // Conexão perdida
        console.log(`❌ [DETECTOR] CONEXÃO PERDIDA! ${instanceId}`);
        setIsReallyConnected(false);
        setPhoneNumber(null);
        
        toast({
          title: "❌ Conexão Perdida",
          description: "WhatsApp desconectado",
          variant: "destructive",
        });
        
        if (onConnectionLost) {
          onConnectionLost();
        }
      }
    };

    // Verificar imediatamente
    runCheck();
    
    // Verificar a cada 3 segundos se não conectado, 10 segundos se conectado
    const intervalTime = isReallyConnected ? 10000 : 3000;
    interval = setInterval(runCheck, intervalTime);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [instanceId, isReallyConnected, checkRealConnection, onConnectionDetected, onConnectionLost, toast]);

  const forceCheck = useCallback(async () => {
    console.log(`🔄 [DETECTOR] Verificação forçada para ${instanceId}`);
    const result = await checkRealConnection();
    return result;
  }, [checkRealConnection, instanceId]);

  return {
    isReallyConnected,
    phoneNumber,
    isChecking,
    forceCheck
  };
};
