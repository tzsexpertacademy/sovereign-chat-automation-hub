import React from 'react';
import { LegacyRedirect } from './LegacyRedirect';

export const InstanceCreationForm: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Instance Creation Form" 
      description="Criação de instâncias agora disponível na nova interface v2.2.1" 
    />
  );
};