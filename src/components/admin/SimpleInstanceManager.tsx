import React from 'react';
import { LegacyRedirect } from './LegacyRedirect';

export const SimpleInstanceManager: React.FC = () => {
  return (
    <LegacyRedirect 
      componentName="Simple Instance Manager" 
      description="Interface simplificada migrada para o novo sistema unificado v2.2.1" 
    />
  );
};