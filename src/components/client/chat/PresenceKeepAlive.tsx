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
  
  // Configurar perfil online uma única vez por sessão
  useEffect(() => {
    if (enabled && instanceId && clientId) {
      console.log('🔧 [PRESENCE-COMPONENT] Configurando perfil online com heartbeat inteligente');
      onlineStatusManager.configureProfileOnce(instanceId, clientId, 'system')
        .then(success => {
          if (success) {
            console.log('✅ [PRESENCE-COMPONENT] Perfil configurado - heartbeat ativo:', isActive);
          } else {
            console.log('❌ [PRESENCE-COMPONENT] Falha na configuração do perfil');
          }
        })
        .catch(error => {
          console.error('💥 [PRESENCE-COMPONENT] Erro na configuração do perfil:', error);
        });
    }
  }, [instanceId, clientId, enabled, isActive]);

  // Este componente não renderiza nada
  return null;
};

export default PresenceKeepAlive;