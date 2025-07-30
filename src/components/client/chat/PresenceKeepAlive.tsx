import { useEffect } from 'react';
import { onlineStatusManager } from '@/services/onlineStatusManager';

interface PresenceKeepAliveProps {
  clientId: string;
  instanceId: string;
  chatId: string;
  enabled?: boolean;
}

/**
 * Componente simplificado para presença online
 * Usa apenas endpoints válidos da API CodeChat v2.2.1
 */
export const PresenceKeepAlive = ({ 
  clientId, 
  instanceId, 
  chatId, 
  enabled = true 
}: PresenceKeepAliveProps) => {
  
  // Configurar perfil online uma única vez por sessão
  useEffect(() => {
    if (enabled && instanceId && clientId) {
      console.log('🔧 [PRESENCE-COMPONENT] Configurando perfil online (endpoints válidos)');
      onlineStatusManager.configureProfileOnce(instanceId, clientId, 'system')
        .then(success => {
          if (success) {
            console.log('✅ [PRESENCE-COMPONENT] Perfil online configurado com sucesso');
          } else {
            console.log('❌ [PRESENCE-COMPONENT] Falha na configuração do perfil');
          }
        })
        .catch(error => {
          console.error('💥 [PRESENCE-COMPONENT] Erro na configuração do perfil:', error);
        });
    }
  }, [instanceId, clientId, enabled]);

  // Este componente não renderiza nada
  return null;
};

export default PresenceKeepAlive;