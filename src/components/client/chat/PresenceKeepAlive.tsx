import { useEffect } from 'react';
import { usePresenceKeepAlive } from '@/hooks/usePresenceKeepAlive';
import { onlineStatusManager } from '@/services/onlineStatusManager';

interface PresenceKeepAliveProps {
  clientId: string;
  instanceId: string;
  chatId: string;
  enabled?: boolean;
}

/**
 * Componente para manter presença online no chat ativo
 * Sistema híbrido: configuração de perfil (uma vez) + presença contínua no chat
 */
export const PresenceKeepAlive = ({ 
  clientId, 
  instanceId, 
  chatId, 
  enabled = true 
}: PresenceKeepAliveProps) => {
  
  // 1. Configurar perfil online uma única vez por instância
  useEffect(() => {
    if (enabled && instanceId && clientId) {
      console.log('🔧 [PRESENCE-COMPONENT] Configurando perfil online inicial');
      onlineStatusManager.configureProfileOnce(instanceId, clientId, 'system')
        .then(success => {
          if (success) {
            console.log('✅ [PRESENCE-COMPONENT] Perfil configurado com sucesso');
          } else {
            console.log('❌ [PRESENCE-COMPONENT] Falha na configuração do perfil');
          }
        })
        .catch(error => {
          console.error('💥 [PRESENCE-COMPONENT] Erro na configuração do perfil:', error);
        });
    }
  }, [instanceId, clientId, enabled]);

  // 2. Manter presença contínua no chat específico (25 segundos)
  usePresenceKeepAlive(instanceId, chatId, { 
    enabled,
    intervalSeconds: 25, // Mais frequente para garantir visibilidade
    clientId 
  });

  // Este componente não renderiza nada
  return null;
};

export default PresenceKeepAlive;