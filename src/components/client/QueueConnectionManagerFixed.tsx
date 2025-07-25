
import React from 'react';
import { LegacyRedirect } from '../admin/LegacyRedirect';

interface QueueConnectionManagerProps {
  clientId: string;
  onConnectionChange?: () => void;
}

export const QueueConnectionManagerFixed: React.FC<QueueConnectionManagerProps> = () => {
  return (
    <LegacyRedirect 
      componentName="Queue Connection Manager Fixed" 
      description="O gerenciador de conexão de filas foi migrado para a nova interface unificada da API v2.2.1" 
    />
  );
};

export default QueueConnectionManagerFixed;
