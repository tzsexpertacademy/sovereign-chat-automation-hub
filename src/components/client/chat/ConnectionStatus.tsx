
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { getServerConfig, getAlternativeServerConfig } from '@/config/environment';

interface ConnectionStatusProps {
  connectedInstance: string | null;
  isOnline: boolean;
}

const ConnectionStatus = ({ connectedInstance, isOnline }: ConnectionStatusProps) => {
  const [serverConfig, setServerConfig] = useState<any>(null);
  const [hasAlternative, setHasAlternative] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getServerConfig();
        setServerConfig(config);
        setHasAlternative(!!getAlternativeServerConfig());
      } catch (error) {
        console.error('Erro ao carregar configuração:', error);
      }
    };

    loadConfig();
  }, []);

  if (!connectedInstance) {
    return (
      <div className="p-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2 text-yellow-800">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Nenhuma instância WhatsApp conectada. As mensagens não poderão ser enviadas.</span>
      </div>
    );
  }

  if (!serverConfig) {
    return (
      <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-gray-600">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span className="text-xs">Carregando configuração...</span>
      </div>
    );
  }

  return (
    <div className="p-2 bg-green-50 border-b border-green-200 flex items-center gap-2 text-green-800">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span className="text-xs">Conectado: {connectedInstance}</span>
      <span className="text-xs">• {serverConfig.protocol.toUpperCase()}: {serverConfig.serverUrl}</span>
      {hasAlternative && <span className="text-xs">• Fallback: ✓</span>}
      {isOnline && (
        <>
          <span className="text-xs">•</span>
          <span className="text-xs font-medium">🤖 IA Online</span>
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
