
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Server,
  Globe
} from "lucide-react";
import { SERVER_URL, getConfig } from '@/config/environment';
import { connectionManager } from '@/services/connectionManager';

interface ConnectionStatus {
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

const SystemHealthMonitor = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSystemHealth();
    
    // Monitor de conexão em tempo real
    const handleStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = connectionManager.onStatusChange(handleStatusChange);
    } catch (error) {
      console.warn('ConnectionManager não disponível:', error);
    }

    // Verificar saúde a cada 30 segundos
    const interval = setInterval(checkSystemHealth, 30000);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      const config = await getConfig();
      const response = await fetch(`${config.serverUrl}/health`);
      
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        console.log('✅ Sistema saudável:', data);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Falha no health check:', error);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatusColor = () => {
    if (!connectionStatus) return 'bg-gray-500';
    return connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500';
  };

  const getServerStatusColor = () => {
    if (!healthData) return 'bg-red-500';
    return healthData.status === 'ok' ? 'bg-green-500' : 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <CardTitle>Monitor de Saúde do Sistema</CardTitle>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={checkSystemHealth}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>
        <CardDescription>
          Monitoramento em tempo real da conectividade e saúde do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status da Conexão */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`} />
            <div>
              <p className="font-medium">Status da Conexão</p>
              <p className="text-sm text-gray-600">
                {connectionStatus ? 
                  (connectionStatus.isConnected ? 'Conectado' : 'Desconectado') : 
                  'Verificando...'
                }
              </p>
            </div>
          </div>
          {connectionStatus?.isConnected ? 
            <CheckCircle className="w-5 h-5 text-green-500" /> : 
            <WifiOff className="w-5 h-5 text-red-500" />
          }
        </div>

        {/* Status do Servidor */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getServerStatusColor()}`} />
            <div>
              <p className="font-medium">Servidor WhatsApp</p>
              <p className="text-sm text-gray-600">
                {healthData ? 
                  `${healthData.status.toUpperCase()} - ${SERVER_URL}` : 
                  'Offline ou inacessível'
                }
              </p>
            </div>
          </div>
          {healthData ? 
            <Server className="w-5 h-5 text-green-500" /> : 
            <AlertTriangle className="w-5 h-5 text-red-500" />
          }
        </div>

        {/* Aviso sobre Limitações do Lovable */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Globe className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Limitação do Ambiente Lovable</p>
              <p className="text-sm text-yellow-700">
                O Lovable pode ter restrições CORS para conectar com servidores externos. 
                Para teste completo, publique o app ou use um ambiente local.
              </p>
            </div>
          </div>
        </div>

        {/* Informações do Sistema */}
        {healthData && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
              <p className="text-lg font-bold text-blue-600">
                {healthData.activeClients || 0}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Uptime</p>
              <p className="text-sm text-gray-900">
                {healthData.uptime ? `${Math.floor(healthData.uptime / 60)}min` : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Informações de Reconexão */}
        {connectionStatus && !connectionStatus.isConnected && connectionStatus.reconnectAttempts > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
              <span className="text-sm text-yellow-800">
                Tentando reconectar... ({connectionStatus.reconnectAttempts}/{connectionStatus.maxReconnectAttempts})
              </span>
            </div>
          </div>
        )}

        {/* Status dos Endpoints */}
        {healthData && healthData.routes && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Endpoints Disponíveis</p>
            <div className="flex flex-wrap gap-1">
              {Object.keys(healthData.routes).slice(0, 6).map((route) => (
                <Badge key={route} variant="outline" className="text-xs">
                  {route.split('/').pop()}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sugestões para Resolução */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Soluções Recomendadas</p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Publique o app no Lovable para ter acesso completo</li>
                <li>• Use um ambiente local para desenvolvimento</li>
                <li>• Configure HTTPS no servidor para melhor compatibilidade</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemHealthMonitor;
