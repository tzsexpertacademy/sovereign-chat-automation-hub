
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

  return (
    <div className="w-full bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-green-800 font-medium">Comunicação Online</span>
        {status.realtime.connected && (
          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
            Conectado
          </Badge>
        )}
      </div>
    </div>
  );
};

export default SystemHealthIndicator;
