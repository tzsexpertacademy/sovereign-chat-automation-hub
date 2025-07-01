
import { useState, useCallback } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface ConnectionVerification {
  instanceId: string;
  serverStatus: string;
  hasQrCode: boolean;
  phoneNumber?: string;
  reallyConnected: boolean;
  canAccessChats: boolean;
  timestamp: string;
}

export const useWhatsAppConnectionVerifier = () => {
  const [verificationResults, setVerificationResults] = useState<Record<string, ConnectionVerification>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const verifyRealConnection = useCallback(async (instanceId: string): Promise<ConnectionVerification> => {
    console.log(`🔍 [VERIFIER] Verificando conexão real: ${instanceId}`);
    
    try {
      // 1. Verificar status oficial
      const statusResponse = await whatsappService.getClientStatus(instanceId);
      console.log(`📊 [VERIFIER] Status oficial: ${statusResponse.status}`);

      let canAccessChats = false;
      let reallyConnected = false;

      // 2. Tentar acessar chats para verificar conexão real
      try {
        const chats = await whatsappService.getChats(instanceId);
        canAccessChats = true;
        reallyConnected = Array.isArray(chats) && chats.length >= 0;
        console.log(`💬 [VERIFIER] Acesso a chats: ${canAccessChats}, Total: ${chats?.length || 0}`);
      } catch (error: any) {
        console.log(`❌ [VERIFIER] Não consegue acessar chats: ${error.message}`);
        canAccessChats = false;
        reallyConnected = false;
      }

      // 3. Verificar se tem telefone válido
      const hasValidPhone = statusResponse.phoneNumber && 
                           statusResponse.phoneNumber !== 'null' && 
                           statusResponse.phoneNumber !== '';

      if (hasValidPhone) {
        reallyConnected = true;
        console.log(`📱 [VERIFIER] Telefone válido detectado: ${statusResponse.phoneNumber}`);
      }

      // 4. Se status é connected, provavelmente está conectado
      if (statusResponse.status === 'connected') {
        reallyConnected = true;
        console.log(`✅ [VERIFIER] Status connected confirmado`);
      }

      const verification: ConnectionVerification = {
        instanceId,
        serverStatus: statusResponse.status,
        hasQrCode: statusResponse.hasQrCode || false,
        phoneNumber: statusResponse.phoneNumber,
        reallyConnected,
        canAccessChats,
        timestamp: new Date().toISOString()
      };

      console.log(`🎯 [VERIFIER] Resultado final:`, {
        instanceId,
        serverStatus: statusResponse.status,
        reallyConnected,
        canAccessChats,
        hasValidPhone
      });

      return verification;
    } catch (error: any) {
      console.error(`❌ [VERIFIER] Erro na verificação:`, error);
      throw error;
    }
  }, []);

  const verifyAllConnections = useCallback(async (instanceIds: string[]) => {
    setIsVerifying(true);
    const results: Record<string, ConnectionVerification> = {};

    try {
      console.log(`🔍 [VERIFIER] Verificando ${instanceIds.length} instâncias...`);

      for (const instanceId of instanceIds) {
        try {
          const verification = await verifyRealConnection(instanceId);
          results[instanceId] = verification;
          
          // Log se detectou problema
          if (verification.serverStatus === 'qr_ready' && verification.reallyConnected) {
            console.log(`⚠️ [VERIFIER] INCONSISTÊNCIA DETECTADA: ${instanceId} está qr_ready mas realmente conectado!`);
            toast({
              title: "Inconsistência Detectada",
              description: `Instância ${instanceId} está conectada mas aparecem como qr_ready`,
              variant: "destructive",
            });
          }
        } catch (error: any) {
          console.error(`❌ [VERIFIER] Erro ao verificar ${instanceId}:`, error);
          results[instanceId] = {
            instanceId,
            serverStatus: 'error',
            hasQrCode: false,
            reallyConnected: false,
            canAccessChats: false,
            timestamp: new Date().toISOString()
          };
        }

        // Aguardar 500ms entre verificações
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setVerificationResults(results);
      console.log(`✅ [VERIFIER] Verificação concluída:`, results);
      
      return results;
    } catch (error: any) {
      console.error('❌ [VERIFIER] Erro geral:', error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [verifyRealConnection, toast]);

  return {
    verifyRealConnection,
    verifyAllConnections,
    verificationResults,
    isVerifying
  };
};
