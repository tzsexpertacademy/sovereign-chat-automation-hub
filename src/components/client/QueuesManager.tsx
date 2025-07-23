
import React from 'react';
import { LegacyRedirect } from '../admin/LegacyRedirect';

export const QueuesManager: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Queues Manager" 
      description="O gerenciador de filas foi migrado para a nova interface unificada da API v2.2.1" 
    />
  );
};

export default QueuesManager;
