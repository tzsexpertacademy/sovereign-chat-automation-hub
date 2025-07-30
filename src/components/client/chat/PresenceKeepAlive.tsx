import { useEffect } from 'react';
import { onlineStatusManager } from '@/services/onlineStatusManager';
import { useSmartPresenceHeartbeat } from '@/hooks/useSmartPresenceHeartbeat';

interface PresenceKeepAliveProps {
  clientId: string;
  instanceId: string;
  chatId: string;
  enabled?: boolean;
}

/**
 * Componente inteligente para presença online
 * Combina configuração de perfil + heartbeat baseado em atividade
 */
export const PresenceKeepAlive = ({ 
  clientId, 
  instanceId, 
  chatId, 
  enabled = true 
}: PresenceKeepAliveProps) => {
  
  // Heartbeat inteligente baseado em atividade real
  const { markActivity, isActive } = useSmartPresenceHeartbeat({
    instanceId,
    chatId,
    clientId,
    enabled,
    activityTimeout: 120000 // 2 minutos de inatividade
  });
  
  // Configurar perfil online uma única vez por sessão + iniciar heartbeat contínuo
  useEffect(() => {
    if (enabled && instanceId && clientId && chatId) {
      console.log('🔧 [PRESENCE-COMPONENT] Configurando sistema de presença v2.2.1');
      
      // 1. Configurar perfil inicial
      onlineStatusManager.configureProfileOnce(instanceId, clientId, 'system')
        .then(success => {
          if (success) {
            console.log('✅ [PRESENCE-COMPONENT] Perfil configurado');
            
            // 2. Iniciar heartbeat contínuo para manter presença
            onlineStatusManager.startContinuousHeartbeat(instanceId, chatId, clientId, 25000); // 25s
            console.log('💓 [PRESENCE-COMPONENT] Heartbeat contínuo iniciado');
          } else {
            console.log('❌ [PRESENCE-COMPONENT] Falha na configuração do perfil');
          }
        })
        .catch(error => {
          console.error('💥 [PRESENCE-COMPONENT] Erro na configuração:', error);
        });
    }

    // Cleanup: parar heartbeat ao desmontar
    return () => {
      if (instanceId && chatId) {
        onlineStatusManager.stopContinuousHeartbeat(instanceId, chatId);
      }
    };
  }, [instanceId, clientId, chatId, enabled]);

  // Este componente não renderiza nada
  return null;
};

export default PresenceKeepAlive;