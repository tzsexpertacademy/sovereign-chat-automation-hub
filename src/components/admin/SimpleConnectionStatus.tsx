import React from 'react';
import { LegacyRedirect } from './LegacyRedirect';

export const SimpleConnectionStatus: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Simple Connection Status" 
      description="Status de conexão agora disponível na interface unificada v2.2.1" 
    />
  );
};