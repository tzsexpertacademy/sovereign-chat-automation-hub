
import { useState } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

export const useWhatsAppSessionCleaner = () => {
  const [isCleaningSession, setIsCleaningSession] = useState(false);
  const { toast } = useToast();

  const cleanAllSessions = async () => {
    try {
      setIsCleaningSession(true);
      console.log('🧹 [CLEANER] Iniciando limpeza completa de sessões...');

      // 1. Obter todas as instâncias ativas
      const clients = await whatsappService.getAllClients();
      console.log(`🔍 [CLEANER] Encontradas ${clients.length} instâncias para limpar`);

      // 2. Desconectar todas as instâncias (ignorar erros 500)
      for (const client of clients) {
        try {
          console.log(`🔌 [CLEANER] Desconectando ${client.clientId}...`);
          await whatsappService.disconnectClient(client.clientId);
          console.log(`✅ [CLEANER] ${client.clientId} desconectado`);
        } catch (error: any) {
          console.warn(`⚠️ [CLEANER] Erro ao desconectar ${client.clientId} (ignorando):`, error.message);
          // Ignorar erros de disconnect - pode ser que já esteja desconectado
        }
        
        // Aguardar 1 segundo entre desconexões
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 3. Aguardar 5 segundos para sessões limparem
      console.log('⏳ [CLEANER] Aguardando limpeza completa...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('✅ [CLEANER] Limpeza de sessões concluída');
      
      toast({
        title: "Sessões Limpas",
        description: `${clients.length} sessões foram limpas com sucesso`,
      });

      return true;
    } catch (error: any) {
      console.error('❌ [CLEANER] Erro na limpeza:', error);
      toast({
        title: "Erro na Limpeza",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCleaningSession(false);
    }
  };

  return {
    cleanAllSessions,
    isCleaningSession
  };
};
