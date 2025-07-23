
import React from 'react';
import { LegacyRedirect } from '../admin/LegacyRedirect';

export const QueueConnectionManager: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Queue Connection Manager" 
      description="O gerenciador de conexão de filas foi migrado para a nova interface unificada da API v2.2.1" 
    />
  );
};

export default QueueConnectionManager;
