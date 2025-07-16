import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertCircle, 
  Key, 
  Wifi, 
  WifiOff,
  Settings
} from "lucide-react";
import { yumerNativeWebSocketService } from '@/services/yumerNativeWebSocketService';
import { useNavigate } from 'react-router-dom';

interface JwtStatusIndicatorProps {
  jwtConfigured: boolean;
  websocketConnected: boolean;
}

const JwtStatusIndicator: React.FC<JwtStatusIndicatorProps> = ({ 
  jwtConfigured, 
  websocketConnected 
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"}>
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  const getConnectionDetails = () => {
    const info = yumerNativeWebSocketService.getConnectionInfo();
    return info;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Key className="w-5 h-5" />
          <span>Status da Configuração JWT</span>
        </CardTitle>
        <CardDescription>
          Verificação do sistema de autenticação e conectividade
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              {jwtConfigured ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="font-medium">JWT Authentication</p>
                <p className="text-sm text-gray-600">
                  {getStatusBadge(jwtConfigured, "Configurado", "Não Configurado")}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {websocketConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="font-medium">WebSocket Connection</p>
                <p className="text-sm text-gray-600">
                  {getStatusBadge(websocketConnected, "Conectado", "Desconectado")}
                </p>
              </div>
            </div>
          </div>

          {/* Status Geral */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {jwtConfigured && websocketConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-800 font-medium">
                      ✅ Sistema pronto para criar instâncias
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-800 font-medium">
                      ⚠️ Configuração necessária
                    </span>
                  </>
                )}
              </div>
              
              <Button 
                size="sm"
                variant="outline"
                onClick={() => navigate('/admin/instances')}
              >
                <Settings className="w-4 h-4 mr-1" />
                Configurar
              </Button>
            </div>
          </div>

          {/* Informações de Debug */}
          {websocketConnected && (
            <div className="text-xs text-gray-500">
              <p>JWT Secret: sfdgs8152g5s1s5 (Hardcoded)</p>
              <p>WebSocket: {getConnectionDetails()?.url || 'N/A'}</p>
              <p>Status: {yumerNativeWebSocketService.isConnected() ? 'Connected' : 'Disconnected'}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JwtStatusIndicator;