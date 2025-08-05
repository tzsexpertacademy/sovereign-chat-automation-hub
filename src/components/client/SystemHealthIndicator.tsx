
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Wifi, 
  Webhook, 
  Download,
  Settings
} from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SystemHealthIndicatorProps {
  clientId: string;
}

const SystemHealthIndicator = ({ clientId }: SystemHealthIndicatorProps) => {
  const { status } = useSystemHealth(clientId);

  const isOnline = status?.realtime?.connected || true; // Assumir online por padrão

  return (
    <div className={`
      px-4 py-3 rounded-xl border transition-all duration-200
      ${isOnline 
        ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-emerald-100' 
        : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 shadow-red-100'
      }
      shadow-sm hover:shadow-md
    `}>
      <div className="flex items-center gap-3">
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-full
          ${isOnline 
            ? 'bg-emerald-500 shadow-emerald-200' 
            : 'bg-red-500 shadow-red-200'
          }
          shadow-lg
        `}>
          {isOnline ? (
            <CheckCircle className="w-4 h-4 text-white" />
          ) : (
            <XCircle className="w-4 h-4 text-white" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${
              isOnline ? 'text-emerald-800' : 'text-red-800'
            }`}>
              {isOnline ? 'Sistema Online' : 'Sistema Offline'}
            </span>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              isOnline ? 'bg-emerald-500' : 'bg-red-500'
            }`} />
          </div>
          <p className={`text-xs ${
            isOnline ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {isOnline ? 'Comunicação ativa com WhatsApp' : 'Verificando conexão...'}
          </p>
        </div>

        <Badge 
          variant={isOnline ? "default" : "destructive"}
          className="text-xs font-medium"
        >
          {isOnline ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>
    </div>
  );
};

export default SystemHealthIndicator;
