import React from 'react';
import { LegacyRedirect } from './LegacyRedirect';

export const RealInstancesManager: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Real Instances Manager" 
      description="O gerenciador de instâncias foi totalmente migrado para a nova API v2.2.1 com funcionalidades aprimoradas" 
    />
  );
};