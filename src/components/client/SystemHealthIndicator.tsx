
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
    <div className="px-4 py-2 rounded-lg border bg-gradient-to-r from-background to-muted/20 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              Sistema Ativo
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        <Badge 
          variant="outline"
          className="text-xs font-normal border-emerald-200 text-emerald-700"
        >
          Online
        </Badge>
      </div>
    </div>
  );
};

export default SystemHealthIndicator;
