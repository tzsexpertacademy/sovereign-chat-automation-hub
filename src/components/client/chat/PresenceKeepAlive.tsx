import { usePresenceKeepAlive } from '@/hooks/usePresenceKeepAlive';

interface PresenceKeepAliveProps {
  clientId: string;
  instanceId: string;
  chatId: string;
  enabled?: boolean;
}

/**
 * Componente para manter presença online no chat ativo
 */
export const PresenceKeepAlive = ({ 
  clientId, 
  instanceId, 
  chatId, 
  enabled = true 
}: PresenceKeepAliveProps) => {
  
  usePresenceKeepAlive(instanceId, chatId, { 
    enabled,
    intervalSeconds: 30,
    clientId 
  });

  // Este componente não renderiza nada
  return null;
};

export default PresenceKeepAlive;