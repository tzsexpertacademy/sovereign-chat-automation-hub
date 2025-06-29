
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { getConfig } from '@/config/environment';

interface ConnectionStatusProps {
  connectedInstance: string | null;
  isOnline: boolean;
}

const ConnectionStatus = ({ connectedInstance, isOnline }: ConnectionStatusProps) => {
  const [currentConfig, setCurrentConfig] = useState<{
    serverUrl: string;
    protocol: string;
    environment: string;
    fallbackUrl: string | null;
  } | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getConfig();
        setCurrentConfig(config);
      } catch (error) {
        console.error('Error loading config:', error);
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

  return (
    <div className="p-2 bg-green-50 border-b border-green-200 flex items-center gap-2 text-green-800">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span className="text-xs">Conectado: {connectedInstance}</span>
      {currentConfig && (
        <>
          <span className="text-xs">• {currentConfig.protocol.toUpperCase()}: {currentConfig.serverUrl}</span>
          {currentConfig.fallbackUrl && <span className="text-xs">• Fallback: ✓</span>}
        </>
      )}
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
