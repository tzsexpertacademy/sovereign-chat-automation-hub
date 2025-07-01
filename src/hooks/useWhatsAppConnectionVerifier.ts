
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
    console.log(`🔍 [VERIFIER v2.1] Verificando conexão real: ${instanceId}`);
    
    try {
      // 1. Verificar status oficial
      const statusResponse = await whatsappService.getClientStatus(instanceId);
      console.log(`📊 [VERIFIER v2.1] Status oficial: ${statusResponse.status}`);

      let canAccessChats = false;
      let reallyConnected = false;

      // 2. NOVA ESTRATÉGIA v2.1: NÃO tentar acessar chats, usar critérios alternativos
      console.log(`🧠 [VERIFIER v2.1] Usando detecção inteligente SEM /chats`);
      
      // 3. Verificar se tem telefone válido
      const hasValidPhone = statusResponse.phoneNumber && 
                           statusResponse.phoneNumber !== 'null' && 
                           statusResponse.phoneNumber !== '';

      if (hasValidPhone) {
        reallyConnected = true;
        canAccessChats = true; // Assumir que se tem telefone, pode acessar chats
        console.log(`📱 [VERIFIER v2.1] Telefone válido detectado: ${statusResponse.phoneNumber}`);
      }

      // 4. Se status é connected, provavelmente está conectado
      if (statusResponse.status === 'connected') {
        reallyConnected = true;
        canAccessChats = true; // Assumir que connected = pode acessar chats
        console.log(`✅ [VERIFIER v2.1] Status connected confirmado`);
      }

      // 5. NOVO v2.1: Se status é authenticated, também está conectado
      if (statusResponse.status === 'authenticated') {
        reallyConnected = true;
        canAccessChats = true; // Authenticated = conectado
        console.log(`🔐 [VERIFIER v2.1] Status authenticated confirmado`);
      }

      // 6. NOVO v2.1: Se qr_ready mas sem QR, pode estar conectado
      if (statusResponse.status === 'qr_ready' && !statusResponse.hasQrCode) {
        console.log(`🤔 [VERIFIER v2.1] QR foi escaneado - possível conexão`);
        // Não definir como conectado ainda, mas não é erro
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

      console.log(`🎯 [VERIFIER v2.1] Resultado final:`, {
        instanceId,
        serverStatus: statusResponse.status,
        reallyConnected,
        canAccessChats,
        hasValidPhone
      });

      return verification;
    } catch (error: any) {
      console.error(`❌ [VERIFIER v2.1] Erro na verificação:`, error);
      throw error;
    }
  }, []);

  const verifyAllConnections = useCallback(async (instanceIds: string[]) => {
    setIsVerifying(true);
    const results: Record<string, ConnectionVerification> = {};

    try {
      console.log(`🔍 [VERIFIER v2.1] Verificando ${instanceIds.length} instâncias...`);

      for (const instanceId of instanceIds) {
        try {
          const verification = await verifyRealConnection(instanceId);
          results[instanceId] = verification;
          
          // Log se detectou problema
          if (verification.serverStatus === 'qr_ready' && verification.reallyConnected) {
            console.log(`⚠️ [VERIFIER v2.1] INCONSISTÊNCIA DETECTADA: ${instanceId} está qr_ready mas realmente conectado!`);
            toast({
              title: "Inconsistência Detectada",
              description: `Instância ${instanceId} está conectada mas aparece como qr_ready`,
              variant: "destructive",
            });
          }
        } catch (error: any) {
          console.error(`❌ [VERIFIER v2.1] Erro ao verificar ${instanceId}:`, error);
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
      console.log(`✅ [VERIFIER v2.1] Verificação concluída:`, results);
      
      return results;
    } catch (error: any) {
      console.error('❌ [VERIFIER v2.1] Erro geral:', error);
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
